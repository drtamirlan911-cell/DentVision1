import { beforeEach, describe, expect, it, vi } from 'vitest';

const { agentActivityFindMany, resolveOrganizationIdForClinic, organizationFindUnique, clinicFindUnique, supplierFindUnique, lecturerFindUnique, clinicMemberFindMany, supplierMemberFindMany, personFindMany } = vi.hoisted(() => ({
  agentActivityFindMany: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  organizationFindUnique: vi.fn(),
  clinicFindUnique: vi.fn(),
  supplierFindUnique: vi.fn(),
  lecturerFindUnique: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  supplierMemberFindMany: vi.fn(),
  personFindMany: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    agentActivity: { findMany: agentActivityFindMany },
    organization: { findUnique: organizationFindUnique },
    clinic: { findUnique: clinicFindUnique },
    supplier: { findUnique: supplierFindUnique },
    lecturer: { findUnique: lecturerFindUnique },
    clinicMember: { findMany: clinicMemberFindMany },
    supplierMember: { findMany: supplierMemberFindMany },
    person: { findMany: personFindMany },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({
  resolveOrganizationIdForClinic,
  resolveClinicAccess: vi.fn().mockResolvedValue({ role: 'DOCTOR' }),
}));

import { buildAiContext } from './context.js';

function req(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      role: 'DOCTOR',
      firstName: 'Аида',
      lastName: 'Ержанова',
      clinicId: 'clinic-1',
      ...overrides,
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrganizationIdForClinic.mockResolvedValue('org-1');
  agentActivityFindMany.mockResolvedValue([]);
  organizationFindUnique.mockResolvedValue(null);
  clinicFindUnique.mockResolvedValue({ id: 'clinic-1', name: 'Клиника 1' });
  supplierFindUnique.mockResolvedValue(null);
  lecturerFindUnique.mockResolvedValue(null);
  clinicMemberFindMany.mockResolvedValue([]);
  supplierMemberFindMany.mockResolvedValue([]);
  personFindMany.mockResolvedValue([]);
});

describe('buildAiContext', () => {
  it('resolves organizationId via the verified clinic lookup, never the JWT claim directly', async () => {
    const ctx = await buildAiContext(req(), {});

    expect(resolveOrganizationIdForClinic).toHaveBeenCalledWith('clinic-1');
    expect(ctx.organizationId).toBe('org-1');
    expect(ctx.clinicId).toBe('clinic-1');
    expect(ctx.workspace).toEqual(expect.objectContaining({ scopeType: 'CLINIC', scopeId: 'clinic-1', name: 'Клиника 1' }));
  });

  it('derives page.pageId from pathname via the shared stage classifier', async () => {
    const ctx = await buildAiContext(req(), { pathname: '/crm/patients/list' });

    expect(ctx.page).toEqual({ pathname: '/crm/patients/list', pageId: 'patients' });
  });

  it('resolves entity from focusType/focusId when a real entity is open', async () => {
    const ctx = await buildAiContext(req(), { focusType: 'patient', focusId: 'p-1' });

    expect(ctx.entity).toEqual({ type: 'patient', id: 'p-1' });
  });

  it('resolves no entity for the plain workspace focus', async () => {
    const ctx = await buildAiContext(req(), { focusType: 'workspace', focusId: 'whatever' });

    expect(ctx.entity).toBeNull();
  });

  it('resolves no entity when focusId is missing even if focusType is set', async () => {
    const ctx = await buildAiContext(req(), { focusType: 'patient' });

    expect(ctx.entity).toBeNull();
  });

  it('always reports workflow as null — no per-user active-workflow concept exists yet', async () => {
    const ctx = await buildAiContext(req(), {});

    expect(ctx.workflow).toBeNull();
  });

  it('maps recent AgentActivity rows to type/at', async () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    agentActivityFindMany.mockResolvedValueOnce([{ tool: 'getPatientCard', createdAt: at }]);

    const ctx = await buildAiContext(req(), {});

    expect(ctx.recentEvents).toEqual([{ type: 'getPatientCard', at: at.toISOString() }]);
    expect(agentActivityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorUserId: 'user-1' }, take: 5 }),
    );
  });

  it('returns an empty recentEvents list rather than throwing on a fresh boot (query failure)', async () => {
    agentActivityFindMany.mockRejectedValueOnce(new Error('P2021'));

    const ctx = await buildAiContext(req(), {});

    expect(ctx.recentEvents).toEqual([]);
  });

  it('reports the caller identity from the verified request user, not any hint', async () => {
    const ctx = await buildAiContext(req({ id: 'user-9', role: 'OWNER' }), {});

    expect(ctx.user).toEqual({ id: 'user-9', role: 'OWNER', name: 'Аида Ержанова' });
  });
});
