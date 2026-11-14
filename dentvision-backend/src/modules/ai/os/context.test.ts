import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { agentActivityFindMany, resolveOrganizationIdForClinic, organizationFindUnique, clinicFindUnique, supplierFindUnique, lecturerFindUnique, clinicMemberFindMany, supplierMemberFindMany, diagnosticCenterMemberFindMany, laboratoryMemberFindMany, personFindMany, personFindFirst, branchFindUnique } = vi.hoisted(() => ({
  agentActivityFindMany: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  organizationFindUnique: vi.fn(),
  clinicFindUnique: vi.fn(),
  supplierFindUnique: vi.fn(),
  lecturerFindUnique: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  supplierMemberFindMany: vi.fn(),
  diagnosticCenterMemberFindMany: vi.fn(),
  laboratoryMemberFindMany: vi.fn(),
  personFindMany: vi.fn(),
  personFindFirst: vi.fn(),
  branchFindUnique: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    agentActivity: { findMany: agentActivityFindMany },
    organization: { findUnique: organizationFindUnique },
    clinic: { findUnique: clinicFindUnique },
    branch: { findUnique: branchFindUnique },
    supplier: { findUnique: supplierFindUnique },
    lecturer: { findUnique: lecturerFindUnique },
    clinicMember: { findMany: clinicMemberFindMany },
    supplierMember: { findMany: supplierMemberFindMany },
    diagnosticCenterMember: { findMany: diagnosticCenterMemberFindMany },
    laboratoryMember: { findMany: laboratoryMemberFindMany },
    person: { findMany: personFindMany, findFirst: personFindFirst },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({
  resolveOrganizationIdForClinic,
  resolveClinicAccess: vi.fn().mockResolvedValue({ role: 'DOCTOR' }),
}));

import { activeAiClinicId, buildAiContext } from './context.js';

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
  diagnosticCenterMemberFindMany.mockResolvedValue([]);
  laboratoryMemberFindMany.mockResolvedValue([]);
  personFindMany.mockResolvedValue([]);
  personFindFirst.mockResolvedValue(null);
  branchFindUnique.mockResolvedValue(null);
});

describe('buildAiContext', () => {
  it('does not manufacture an active Academy workspace for an orphan lecturer', async () => {
    lecturerFindUnique.mockResolvedValueOnce({
      id: 'lec-1',
      academy: null,
    });

    const ctx = await buildAiContext(req({
      role: 'STUDENT',
      clinicId: null,
      organizationId: null,
      organizationType: undefined,
      lecturerId: 'lec-1',
    }));

    expect(ctx.workspace).toBeNull();
  });

  it('returns no clinic scope for a partner or guest token with a legacy clinicId', () => {
    expect(activeAiClinicId(req().user)).toBe('clinic-1');
    expect(activeAiClinicId(req({
      organizationId: 'org-supplier',
      organizationType: 'SUPPLIER_COMPANY',
      supplierId: 'supplier-1',
    }).user)).toBeNull();
    expect(activeAiClinicId(req({ isGuest: true }).user)).toBeNull();
  });

  it('does not reuse a legacy clinic branch in a partner workspace', async () => {
    organizationFindUnique.mockResolvedValueOnce({
      id: 'org-supplier',
      name: 'Supplier',
      type: 'SUPPLIER_COMPANY',
      originalId: 'supplier-1',
    });
    personFindFirst.mockResolvedValueOnce({
      personRoles: [{
        scopeType: 'organization',
        scopeId: 'org-supplier',
        role: { key: 'supplier' },
      }],
    });
    branchFindUnique.mockResolvedValueOnce({
      id: 'legacy-clinic-branch',
      name: 'Legacy Clinic Branch',
      code: 'OLD',
      organizationId: 'org-old-clinic',
      clinicId: 'clinic-1',
    });

    const ctx = await buildAiContext(req({
      clinicId: 'clinic-1',
      organizationId: 'org-supplier',
      organizationType: 'SUPPLIER_COMPANY',
      supplierId: 'supplier-1',
      branchId: 'legacy-clinic-branch',
      branchIds: ['legacy-clinic-branch'],
      assignedBranchId: 'legacy-clinic-branch',
    }), {});

    expect(ctx.clinicId).toBeNull();
    expect(ctx.organizationId).toBe('org-supplier');
    expect(ctx.workspace).toMatchObject({ scopeType: 'SUPPLIER', scopeId: 'supplier-1' });
    expect(ctx.branch).toBeNull();
    expect(resolveOrganizationIdForClinic).not.toHaveBeenCalled();
    expect(clinicFindUnique).not.toHaveBeenCalled();
  });

  it('accepts omitted UI hints for server-side callers', async () => {
    const ctx = await buildAiContext(req());

    expect(ctx.page).toEqual({ pathname: '', pageId: null });
  });

  it('resolves organizationId via the verified clinic lookup, never the JWT claim directly', async () => {
    const ctx = await buildAiContext(req(), {});

    expect(resolveOrganizationIdForClinic).toHaveBeenCalledWith('clinic-1');
    expect(ctx.organizationId).toBe('org-1');
    expect(ctx.clinicId).toBe('clinic-1');
    expect(ctx.workspace).toEqual(expect.objectContaining({ scopeType: 'CLINIC', scopeId: 'clinic-1', name: 'Клиника 1' }));
  });


  it('keeps diagnostic and laboratory legacy workspaces in the AI inventory', async () => {
    diagnosticCenterMemberFindMany.mockResolvedValueOnce([
      { id: 'dm-1', role: 'owner', centerId: 'center-1', createdAt: new Date(), center: { id: 'center-1', name: 'Diagnostics' } },
    ]);
    laboratoryMemberFindMany.mockResolvedValueOnce([
      { id: 'lm-1', role: 'manager', labId: 'lab-1', createdAt: new Date(), lab: { id: 'lab-1', name: 'Dental Lab' } },
    ]);

    const ctx = await buildAiContext(req());

    expect(ctx.availableWorkspaces.map((w) => w.scopeType)).toEqual(expect.arrayContaining(['DIAGNOSTIC_CENTER', 'LABORATORY']));
    expect(ctx.availableWorkspaces.find((w) => w.scopeId === 'center-1')?.roleLabel).toBe('Владелец');
    expect(ctx.availableWorkspaces.find((w) => w.scopeId === 'lab-1')?.roleLabel).toBe('Управляющий');
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

describe('AI partner workspace proactive context', () => {
  it('keeps partner workspace explicit and never guesses a clinic when no active clinic is supplied', async () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/ai/core/digitalTwin.ts'), 'utf8');
    expect(source).toContain('const activeClinicId = clinicId || null');
    expect(source).not.toContain('resolveAnyClinicMembership');
    expect(source).toContain("if (!clinicId) {");
    expect(source).toContain("type: 'workspace'");
  });
});
