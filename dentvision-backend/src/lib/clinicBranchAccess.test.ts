import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  organizationFindFirst,
  personFindFirst,
  branchFindMany,
  branchFindFirst,
  clinicMemberFindUnique,
} = vi.hoisted(() => ({
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  branchFindMany: vi.fn(),
  branchFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
    branch: { findMany: branchFindMany, findFirst: branchFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique },
  },
}));

import { resolveClinicBranchAccess } from './clinicBranchAccess.js';

const accessInput = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  clinicId: 'clinic-1',
  organizationId: 'org-1',
  role: 'DOCTOR',
  requestedBranchId: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  organizationFindFirst.mockResolvedValue({
    id: 'org-1', type: 'CLINIC', originalId: 'clinic-1', archivedAt: null,
  });
  personFindFirst.mockResolvedValue({
    id: 'person-1',
    personRoles: [{ role: { key: 'doctor' } }],
  });
  branchFindMany.mockResolvedValue([{ id: 'branch-1' }]);
  branchFindFirst.mockResolvedValue({ id: 'branch-legacy' });
  clinicMemberFindUnique.mockResolvedValue({ role: 'DOCTOR', branchId: 'branch-legacy' });
});

describe('resolveClinicBranchAccess — canonical IAM', () => {
  it('resolves one active BranchMember branch for a doctor without trusting JWT branchIds', async () => {
    await expect(resolveClinicBranchAccess(accessInput())).resolves.toEqual({
      roleScope: 'ASSIGNED',
      branchId: 'branch-1',
      allowedBranchIds: ['branch-1'],
    });
    expect(branchFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-1',
        active: true,
        members: { some: { personId: 'person-1', active: true } },
      }),
    }));
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('uses an explicitly selected branch only when it is a current BranchMember assignment', async () => {
    branchFindMany.mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);
    await expect(resolveClinicBranchAccess(accessInput({ requestedBranchId: 'branch-2' }))).resolves.toMatchObject({
      roleScope: 'ASSIGNED',
      branchId: 'branch-2',
      allowedBranchIds: ['branch-1', 'branch-2'],
    });
    await expect(resolveClinicBranchAccess(accessInput({ requestedBranchId: 'branch-victim' }))).resolves.toBeNull();
  });

  it('fails closed when a narrow role has multiple branches but no selected context', async () => {
    branchFindMany.mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);
    await expect(resolveClinicBranchAccess(accessInput())).resolves.toBeNull();
  });

  it('allows an organization owner across all active branches when no branch is selected', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personRoles: [{ role: { key: 'owner' } }],
    });
    branchFindMany.mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);
    await expect(resolveClinicBranchAccess(accessInput({ role: 'OWNER' }))).resolves.toEqual({
      roleScope: 'ORGANIZATION',
      branchId: null,
      allowedBranchIds: ['branch-1', 'branch-2'],
    });
  });

  it('narrows organization reads when an owner selects one verified branch', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personRoles: [{ role: { key: 'owner' } }],
    });
    branchFindMany.mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);
    await expect(resolveClinicBranchAccess(accessInput({
      role: 'OWNER', requestedBranchId: 'branch-2',
    }))).resolves.toMatchObject({ roleScope: 'ORGANIZATION', branchId: 'branch-2' });
  });

  it('maps canonical director membership to the authenticated owner alias', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personRoles: [{ role: { key: 'director' } }],
    });
    await expect(resolveClinicBranchAccess(accessInput({ role: 'OWNER' }))).resolves.toMatchObject({
      roleScope: 'ORGANIZATION',
    });
  });

  it('does not promote the cashier alias to organization-wide ADMIN authority', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personRoles: [{ role: { key: 'cashier' } }],
    });
    await expect(resolveClinicBranchAccess(accessInput({ role: 'ADMIN' }))).resolves.toBeNull();
  });

  it('rejects archived organizations and revoked organization roles', async () => {
    organizationFindFirst.mockResolvedValueOnce({
      id: 'org-1', type: 'CLINIC', originalId: 'clinic-1', archivedAt: new Date(),
    });
    await expect(resolveClinicBranchAccess(accessInput())).resolves.toBeNull();

    personFindFirst.mockResolvedValue({ id: 'person-1', personRoles: [] });
    await expect(resolveClinicBranchAccess(accessInput())).resolves.toBeNull();
  });

  it('rejects a foreign organization selector before reading memberships', async () => {
    await expect(resolveClinicBranchAccess(accessInput({ organizationId: 'org-victim' }))).resolves.toBeNull();
  });
});

describe('resolveClinicBranchAccess — legacy ClinicMember compatibility', () => {
  it('keeps legacy clinic branch access with a verified ClinicMember role and active branch', async () => {
    organizationFindFirst.mockResolvedValue(null);
    await expect(resolveClinicBranchAccess(accessInput({ organizationId: 'clinic-1' }))).resolves.toEqual({
      roleScope: 'ASSIGNED',
      branchId: 'branch-legacy',
      allowedBranchIds: ['branch-legacy'],
    });
    expect(branchFindFirst).toHaveBeenCalledWith({
      where: { id: 'branch-legacy', clinicId: 'clinic-1', active: true },
      select: { id: true },
    });
  });

  it('rejects a stale or mismatched legacy role', async () => {
    organizationFindFirst.mockResolvedValue(null);
    clinicMemberFindUnique.mockResolvedValue({ role: 'DOCTOR', branchId: 'branch-legacy' });
    await expect(resolveClinicBranchAccess(accessInput({
      organizationId: 'clinic-1', role: 'MANAGER',
    }))).resolves.toBeNull();
  });

  it('does not let a cashier be interpreted as organization-wide admin', async () => {
    organizationFindFirst.mockResolvedValue(null);
    clinicMemberFindUnique.mockResolvedValue({ role: 'CASHIER', branchId: 'branch-legacy' });
    await expect(resolveClinicBranchAccess(accessInput({
      organizationId: 'clinic-1', role: 'ADMIN',
    }))).resolves.toBeNull();
  });
});
