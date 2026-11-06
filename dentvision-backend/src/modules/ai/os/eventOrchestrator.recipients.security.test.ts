import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  organizationFindFirst,
  personFindMany,
  patientFindFirst,
  patientAssignmentFindMany,
  resolvePatientBranchContext,
  canAccessPatientBranch,
} = vi.hoisted(() => ({
  organizationFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  patientFindFirst: vi.fn(),
  patientAssignmentFindMany: vi.fn(),
  resolvePatientBranchContext: vi.fn(),
  canAccessPatientBranch: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    organization: { findFirst: organizationFindFirst },
    person: { findMany: personFindMany },
    patient: { findFirst: patientFindFirst },
    patientAssignment: { findMany: patientAssignmentFindMany },
  },
}));
vi.mock('../../../lib/patientBranchScope.js', () => ({
  resolvePatientBranchContext,
  canAccessPatientBranch,
}));
vi.mock('../../events/index.js', () => ({
  eventBus: { subscribe: vi.fn() },
  eventStore: { markProcessing: vi.fn(), markCompleted: vi.fn(), markFailed: vi.fn() },
}));
vi.mock('./eventRules.js', () => ({ matchEventRules: vi.fn() }));
vi.mock('./eventActions.js', () => ({ getActionHandler: vi.fn() }));
vi.mock('../ai.notifications.routes.js', () => ({ sseManager: { broadcast: vi.fn() } }));
vi.mock('../llm/client.js', () => ({ simpleChat: vi.fn() }));
vi.mock('../lib/providerFetch.js', () => ({ isProviderUnavailableError: vi.fn(() => false) }));

import { EventOrchestrator } from './eventOrchestrator.js';
import type { CRMEvent } from '../../events/EventTypes.js';
import type { EventActionResult } from './eventActions.js';
import type { EventRuleAction } from './eventRules.js';

const action = { agent: 'doctor', action: 'analyzeComplaints' } as EventRuleAction;

function event(payload: Record<string, unknown> = { patientId: 'patient-a' }): CRMEvent {
  return {
    id: 'event-a',
    type: 'PatientCreated' as CRMEvent['type'],
    timestamp: new Date('2026-11-06T00:00:00.000Z'),
    source: 'test',
    clinicId: 'clinic-a',
    userId: 'actor-a',
    payload,
  };
}

function result(data: Record<string, unknown> = { patientId: 'patient-a' }, notifyUserIds?: string[]): EventActionResult {
  return {
    success: true,
    action: 'analyzeComplaints',
    agent: 'doctor',
    message: 'Clinical result is ready.',
    data,
    ...(notifyUserIds === undefined ? {} : { notifyUserIds }),
  };
}

function resolveRecipients(sourceEvent: CRMEvent, sourceResult: EventActionResult): Promise<string[]> {
  const orchestrator = new EventOrchestrator({ logLevel: 'silent' });
  const access = orchestrator as unknown as {
    resolveRecipients: (event: CRMEvent, action: EventRuleAction, result: EventActionResult) => Promise<string[]>;
  };
  return access.resolveRecipients(sourceEvent, action, sourceResult);
}

describe('clinical AI notification recipient authorization', () => {
  beforeEach(() => {
    organizationFindFirst.mockReset().mockResolvedValue({ id: 'organization-a' });
    personFindMany.mockReset().mockResolvedValue([{ userId: 'doctor-a' }, { userId: 'doctor-b' }]);
    patientFindFirst.mockReset().mockResolvedValue({ id: 'patient-a', branchId: 'branch-a' });
    patientAssignmentFindMany.mockReset().mockResolvedValue([{ userId: 'doctor-a' }, { userId: 'doctor-b' }]);
    resolvePatientBranchContext.mockReset().mockImplementation(async (userId: string) => ({
      scope: { branchIds: userId === 'doctor-a' ? ['branch-a'] : ['branch-b'] },
    }));
    canAccessPatientBranch.mockReset().mockImplementation(
      (context: unknown, branchId: string | null) => Boolean(
        branchId && (context as { scope: { branchIds: string[] } }).scope.branchIds.includes(branchId),
      ),
    );
  });

  it('sends clinical results only to active treating doctors with the patient branch', async () => {
    await expect(resolveRecipients(event(), result())).resolves.toEqual(['doctor-a']);
    expect(patientFindFirst).toHaveBeenCalledWith({
      where: { id: 'patient-a', clinicId: 'clinic-a', deletedAt: null },
      select: { id: true, branchId: true },
    });
    expect(patientAssignmentFindMany).toHaveBeenCalledWith({
      where: { clinicId: 'clinic-a', patientId: 'patient-a', role: 'treating_doctor', active: true },
      select: { userId: true },
      take: 50,
    });
    expect(personFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization-a',
        userId: { in: ['doctor-a', 'doctor-b'] },
        personRoles: {
          some: {
            scopeType: 'organization',
            scopeId: 'organization-a',
            scopeKey: 'organization:organization-a',
            role: { key: 'doctor' },
          },
        },
      },
      select: { userId: true },
      take: 50,
    });
  });

  it('denies a doctor who is not actively assigned to the patient', async () => {
    patientAssignmentFindMany.mockResolvedValue([]);
    await expect(resolveRecipients(event(), result())).resolves.toEqual([]);
    expect(personFindMany).not.toHaveBeenCalled();
  });

  it('denies a doctor whose active branch does not contain the patient', async () => {
    resolvePatientBranchContext.mockResolvedValue({
      scope: { branchIds: ['branch-other'] },
    } as never);
    await expect(resolveRecipients(event(), result())).resolves.toEqual([]);
  });

  it('treats an explicit empty notifyUserIds list as deny-all', async () => {
    await expect(resolveRecipients(event(), result({ patientId: 'patient-a' }, []))).resolves.toEqual([]);
    expect(patientFindFirst).not.toHaveBeenCalled();
    expect(patientAssignmentFindMany).not.toHaveBeenCalled();
    expect(personFindMany).not.toHaveBeenCalled();
  });

  it('intersects explicit recipients with the active treating-doctor assignment', async () => {
    // Prisma applies `userId in [...]`; the mock must return only that filtered row.
    patientAssignmentFindMany.mockResolvedValueOnce([{ userId: 'doctor-b' }]);
    await expect(resolveRecipients(event(), result({ patientId: 'patient-a' }, ['doctor-b']))).resolves.toEqual([]);
    expect(patientAssignmentFindMany).toHaveBeenCalledWith({
      where: {
        clinicId: 'clinic-a',
        patientId: 'patient-a',
        role: 'treating_doctor',
        active: true,
        userId: { in: ['doctor-b'] },
      },
      select: { userId: true },
      take: 50,
    });
  });

  it('denies a patient missing from the active clinic scope', async () => {
    patientFindFirst.mockResolvedValue(null);
    await expect(resolveRecipients(event(), result())).resolves.toEqual([]);
    expect(patientAssignmentFindMany).not.toHaveBeenCalled();
  });

  it('denies a result whose event patient and result patient conflict', async () => {
    await expect(
      resolveRecipients(event({ patientId: 'patient-a' }), result({ patientId: 'patient-b' })),
    ).resolves.toEqual([]);
    expect(patientFindFirst).not.toHaveBeenCalled();
  });

  it('does not fall back to organization-wide doctors when a patient id is absent', async () => {
    await expect(resolveRecipients(event({ appointmentId: 'appointment-a' }), result({}))).resolves.toEqual([]);
    expect(organizationFindFirst).not.toHaveBeenCalled();
    expect(personFindMany).not.toHaveBeenCalled();
  });
});
