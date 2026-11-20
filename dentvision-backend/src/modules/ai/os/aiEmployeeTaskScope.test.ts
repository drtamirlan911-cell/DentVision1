import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../types/index.js';

const {
  resolveAccess,
  resolvePermissions,
  organizationFindFirst,
  personFindFirst,
  branchFindMany,
  branchFindFirst,
  clinicMemberFindUnique,
} = vi.hoisted(() => ({
  resolveAccess: vi.fn(),
  resolvePermissions: vi.fn(),
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  branchFindMany: vi.fn(),
  branchFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
    branch: { findMany: branchFindMany, findFirst: branchFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique },
  },
}));
vi.mock('./access.js', () => ({ resolveAiToolAccess: resolveAccess }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions: resolvePermissions }));

import { resolveAiEmployeeTaskScope } from './aiEmployeeTaskScope.js';

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  email: 'user@example.test',
  firstName: 'Test',
  lastName: 'User',
  role: 'DOCTOR',
  ...overrides,
});

const partnerAccess = (overrides: Record<string, unknown> = {}) => ({
  role: 'DIAGNOSTIC_MANAGER',
  clinicId: null,
  organizationId: 'org-1',
  organizationType: 'DIAGNOSTIC_CENTER',
  organizationOriginalId: 'center-1',
  allowed: new Set<string>(),
  employee: { role: 'DIAGNOSTIC_MANAGER', title: 'Diagnostic Manager', autonomy: 'suggest_only' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  resolveAccess.mockResolvedValue(partnerAccess());
  resolvePermissions.mockResolvedValue(['diagnostics.read', 'diagnostics.write']);
  organizationFindFirst.mockResolvedValue({
    id: 'org-1',
    type: 'DIAGNOSTIC_CENTER',
    originalType: 'DiagnosticCenter',
    originalId: 'center-1',
    archivedAt: null,
  });
  personFindFirst.mockResolvedValue({
    id: 'person-1',
    personType: 'RADIOLOGIST',
    originalId: null,
    personRoles: [{ role: { key: 'DIAGNOSTIC_MANAGER' } }],
  });
  branchFindMany.mockResolvedValue([]);
  branchFindFirst.mockResolvedValue(null);
  clinicMemberFindUnique.mockResolvedValue(null);
});

describe('AI Employee active task scope resolver', () => {
  it('resolves canonical organization, scoped role, active branch membership and DB permissions', async () => {
    branchFindMany.mockResolvedValueOnce([{ id: 'branch-a' }]);
    const activeUser = user({
      role: 'OWNER',
      organizationId: 'org-1',
      organizationType: 'DIAGNOSTIC_CENTER',
      branchId: 'branch-a',
      // JWT branch lists are not used as an authorization source.
      branchIds: ['branch-forged'],
      assignedBranchId: 'branch-forged',
    });

    const scope = await resolveAiEmployeeTaskScope(activeUser);

    expect(scope).toMatchObject({
      scopeType: 'DIAGNOSTIC_CENTER',
      scopeId: 'center-1',
      organizationId: 'org-1',
      clinicId: null,
      branchId: 'branch-a',
      roleKey: 'DIAGNOSTIC_MANAGER',
      roleScope: 'BRANCH',
      allowedBranchIds: ['branch-a'],
    });
    expect([...scope!.permissions]).toEqual(['diagnostics.read', 'diagnostics.write']);
    expect(organizationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-1', archivedAt: null },
    }));
    expect(branchFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-1',
        active: true,
        members: { some: { personId: 'person-1', active: true } },
      }),
      select: { id: true },
    }));
    expect(resolvePermissions).toHaveBeenCalledWith('user-1', 'org-1', 'DIAGNOSTIC_MANAGER');
  });

  it('does not let a forged JWT branch claim override BranchMember membership', async () => {
    branchFindMany.mockResolvedValueOnce([{ id: 'branch-a' }]);
    const scope = await resolveAiEmployeeTaskScope(user({
      organizationId: 'org-1',
      organizationType: 'DIAGNOSTIC_CENTER',
      branchId: 'branch-victim',
      branchIds: ['branch-victim'],
      assignedBranchId: 'branch-victim',
    }));

    expect(scope).toBeNull();
    expect(branchFindMany).toHaveBeenCalled();
  });

  it('denies a branch after BranchMember becomes inactive or is revoked', async () => {
    branchFindMany.mockResolvedValueOnce([]);
    const scope = await resolveAiEmployeeTaskScope(user({
      organizationId: 'org-1',
      organizationType: 'DIAGNOSTIC_CENTER',
      branchId: 'branch-a',
    }));

    expect(scope).toBeNull();
    const membershipFilter = branchFindMany.mock.calls[0][0].where;
    expect(membershipFilter.active).toBe(true);
    expect(membershipFilter.members.some.active).toBe(true);
  });

  it('never accepts a branch belonging to a different organization', async () => {
    branchFindMany.mockResolvedValueOnce([]);
    const scope = await resolveAiEmployeeTaskScope(user({
      organizationId: 'org-1',
      organizationType: 'DIAGNOSTIC_CENTER',
      branchId: 'branch-from-org-2',
      branchIds: ['branch-from-org-2'],
    }));

    expect(scope).toBeNull();
    expect(branchFindMany.mock.calls[0][0].where.organizationId).toBe('org-1');
  });

  it('keeps organization-wide authority inside active branches of the same organization', async () => {
    resolveAccess.mockResolvedValueOnce(partnerAccess({ role: 'DIAGNOSTIC_OWNER' }));
    personFindFirst.mockResolvedValueOnce({
      id: 'person-1',
      personType: 'RADIOLOGIST',
      originalId: null,
      personRoles: [{ role: { key: 'DIAGNOSTIC_OWNER' } }],
    });
    branchFindMany.mockResolvedValueOnce([{ id: 'branch-a' }, { id: 'branch-b' }]);
    const scope = await resolveAiEmployeeTaskScope(user({
      organizationId: 'org-1',
      organizationType: 'DIAGNOSTIC_CENTER',
      branchId: 'branch-b',
    }));

    expect(scope).toMatchObject({
      roleScope: 'ORGANIZATION',
      branchId: 'branch-b',
      allowedBranchIds: ['branch-a', 'branch-b'],
    });
    expect(branchFindMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      active: true,
    });
  });

  it('preserves pre-canonical clinic compatibility without fabricating an Organization id', async () => {
    resolveAccess.mockResolvedValueOnce({
      role: 'DOCTOR',
      clinicId: 'legacy-clinic',
      organizationId: null,
      organizationType: null,
      organizationOriginalId: null,
      allowed: new Set<string>(),
      employee: { role: 'DOCTOR', title: 'Doctor', autonomy: 'suggest_only' },
    });
    clinicMemberFindUnique.mockResolvedValueOnce({ branchId: 'legacy-branch' });
    branchFindFirst.mockResolvedValueOnce({ id: 'legacy-branch' });

    const scope = await resolveAiEmployeeTaskScope(user({
      clinicId: 'legacy-clinic',
      branchId: 'legacy-branch',
    }));

    expect(scope).toMatchObject({
      scopeType: 'CLINIC',
      scopeId: 'legacy-clinic',
      organizationId: null,
      clinicId: 'legacy-clinic',
      branchId: 'legacy-branch',
      roleKey: 'DOCTOR',
      roleScope: 'ASSIGNED',
      allowedBranchIds: ['legacy-branch'],
    });
    expect(clinicMemberFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_clinicId: { userId: 'user-1', clinicId: 'legacy-clinic' } },
    }));
    expect(branchFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'legacy-branch', clinicId: 'legacy-clinic', active: true },
    }));
    expect(resolvePermissions).toHaveBeenCalledWith('user-1', 'legacy-clinic', 'DOCTOR');
  });

  it('denies guest and unresolved membership contexts', async () => {
    resolveAccess.mockResolvedValueOnce({
      role: 'GUEST',
      clinicId: null,
      organizationId: null,
      organizationType: null,
      organizationOriginalId: null,
      allowed: new Set<string>(),
      employee: { role: 'GUEST', title: 'Guest', autonomy: 'suggest_only' },
    });

    await expect(resolveAiEmployeeTaskScope(user({ isGuest: true }))).resolves.toBeNull();
    expect(organizationFindFirst).not.toHaveBeenCalled();
    expect(resolvePermissions).not.toHaveBeenCalled();
  });

  it('denies platform-wide superadmin task scope until a separate platform policy exists', async () => {
    resolveAccess.mockResolvedValueOnce({
      role: 'SUPERADMIN',
      clinicId: 'clinic-claim',
      organizationId: 'org-claim',
      organizationType: 'CLINIC',
      organizationOriginalId: null,
      allowed: new Set<string>(),
      employee: { role: 'SUPERADMIN', title: 'Platform', autonomy: 'suggest_only' },
    });

    await expect(resolveAiEmployeeTaskScope(user({ role: 'SUPERADMIN' }))).resolves.toBeNull();
    expect(organizationFindFirst).not.toHaveBeenCalled();
    expect(resolvePermissions).not.toHaveBeenCalled();
  });


  it('fails closed for a partner role without an explicit canonical task-scope policy', async () => {
    resolveAccess.mockResolvedValueOnce(partnerAccess({
      role: 'EMPLOYER_VIEWER',
      organizationType: 'EMPLOYER',
    }));
    organizationFindFirst.mockResolvedValueOnce({
      id: 'org-1',
      type: 'EMPLOYER',
      originalType: null,
      originalId: null,
      archivedAt: null,
    });
    personFindFirst.mockResolvedValueOnce({
      id: 'person-1',
      personType: 'STAFF',
      originalId: null,
      personRoles: [{ role: { key: 'EMPLOYER_VIEWER' } }],
    });

    await expect(resolveAiEmployeeTaskScope(user({
      organizationId: 'org-1',
      organizationType: 'EMPLOYER',
    }))).resolves.toBeNull();
    expect(branchFindMany).not.toHaveBeenCalled();
  });

  it('denies archived or missing canonical organizations', async () => {
    resolveAccess.mockResolvedValueOnce(partnerAccess({ organizationId: 'org-archived' }));
    organizationFindFirst.mockResolvedValueOnce(null);

    const scope = await resolveAiEmployeeTaskScope(user({
      organizationId: 'org-archived',
      organizationType: 'DIAGNOSTIC_CENTER',
    }));

    expect(scope).toBeNull();
    expect(resolvePermissions).not.toHaveBeenCalled();
  });
});
