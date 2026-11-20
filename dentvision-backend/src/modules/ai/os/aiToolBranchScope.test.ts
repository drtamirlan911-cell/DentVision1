import { beforeEach, describe, expect, it, vi } from 'vitest';

const { organizationFindFirst, personFindFirst, resolveOrganizationBranches, resolveLegacyClinicBranches } = vi.hoisted(() => ({
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  resolveOrganizationBranches: vi.fn(),
  resolveLegacyClinicBranches: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({
  PERSON_ROLE_MAP: { doctor: 'DOCTOR', owner: 'OWNER', admin: 'ADMIN' },
}));
vi.mock('./aiEmployeeTaskScope.js', () => ({
  resolveOrganizationBranches,
  resolveLegacyClinicBranches,
}));

import {
  resolveAiToolBranchScope,
  isNarrowAiToolBranchScope,
  patientBranchWhere,
  appointmentBranchWhere,
  invoiceBranchWhere,
  inventoryBranchWhere,
  labOrderBranchWhere,
} from './aiToolBranchScope.js';

const input = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  clinicId: 'clinic-1',
  organizationId: 'org-1',
  role: 'DOCTOR',
  requestedBranchId: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  organizationFindFirst.mockResolvedValue({ id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' });
  personFindFirst.mockResolvedValue({
    id: 'person-1',
    personType: 'DOCTOR',
    originalId: 'user-1',
    personRoles: [{ role: { key: 'doctor' } }],
  });
  resolveOrganizationBranches.mockResolvedValue(['branch-1']);
  resolveLegacyClinicBranches.mockResolvedValue(['branch-1']);
});

describe('resolveAiToolBranchScope', () => {
  it('derives a doctor branch from current canonical membership', async () => {
    await expect(resolveAiToolBranchScope(input())).resolves.toEqual({
      roleScope: 'ASSIGNED',
      branchId: 'branch-1',
      allowedBranchIds: ['branch-1'],
    });
    expect(organizationFindFirst).toHaveBeenCalledWith({
      where: { id: 'org-1', archivedAt: null },
      select: { id: true, type: true, originalId: true },
    });
    expect(resolveOrganizationBranches).toHaveBeenCalledWith(
      'org-1',
      'ASSIGNED',
      expect.objectContaining({ id: 'person-1' }),
    );
  });

  it('rejects a forged branch selector outside DB-resolved membership', async () => {
    await expect(resolveAiToolBranchScope(input({ requestedBranchId: 'branch-victim' }))).resolves.toBeNull();
  });

  it('requires an explicit branch when a narrow role is a member of several branches', async () => {
    resolveOrganizationBranches.mockResolvedValue(['branch-1', 'branch-2']);
    await expect(resolveAiToolBranchScope(input())).resolves.toBeNull();
    await expect(resolveAiToolBranchScope(input({ requestedBranchId: 'branch-2' }))).resolves.toMatchObject({
      roleScope: 'ASSIGNED',
      branchId: 'branch-2',
    });
  });

  it('allows organization roles across the clinic only when no branch is selected', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personType: 'OWNER',
      originalId: 'user-1',
      personRoles: [{ role: { key: 'owner' } }],
    });
    resolveOrganizationBranches.mockResolvedValue(['branch-1', 'branch-2']);

    const scope = await resolveAiToolBranchScope(input({ role: 'OWNER' }));
    expect(scope).toEqual({
      roleScope: 'ORGANIZATION',
      branchId: null,
      allowedBranchIds: ['branch-1', 'branch-2'],
    });
    expect(isNarrowAiToolBranchScope(scope!)).toBe(false);
  });

  it('narrows an organization role when it selects a verified branch', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personType: 'OWNER',
      originalId: 'user-1',
      personRoles: [{ role: { key: 'owner' } }],
    });
    resolveOrganizationBranches.mockResolvedValue(['branch-1', 'branch-2']);

    const scope = await resolveAiToolBranchScope(input({ role: 'OWNER', requestedBranchId: 'branch-2' }));
    expect(scope).toMatchObject({ roleScope: 'ORGANIZATION', branchId: 'branch-2' });
    expect(isNarrowAiToolBranchScope(scope!)).toBe(true);
  });

  it('does not treat the legacy cashier-to-ADMIN alias as organization-wide authority', async () => {
    personFindFirst.mockResolvedValue({
      id: 'person-1',
      personType: 'CASHIER',
      originalId: 'user-1',
      personRoles: [{ role: { key: 'cashier' } }],
    });
    await expect(resolveAiToolBranchScope(input({ role: 'ADMIN' }))).resolves.toBeNull();
  });

  it('rejects archived organizations and revoked current organization roles', async () => {
    organizationFindFirst.mockResolvedValueOnce(null);
    await expect(resolveAiToolBranchScope(input())).resolves.toBeNull();

    personFindFirst.mockResolvedValue({ id: 'person-1', personRoles: [] });
    await expect(resolveAiToolBranchScope(input())).resolves.toBeNull();
  });

  it('uses legacy ClinicMember branch resolution only without canonical organization', async () => {
    await expect(resolveAiToolBranchScope(input({ organizationId: null }))).resolves.toMatchObject({
      roleScope: 'ASSIGNED',
      branchId: 'branch-1',
    });
    expect(resolveLegacyClinicBranches).toHaveBeenCalledWith('user-1', 'clinic-1', 'ASSIGNED');
    expect(personFindFirst).not.toHaveBeenCalled();
  });

  it('denies unsupported and platform roles', async () => {
    await expect(resolveAiToolBranchScope(input({ role: 'SUPERADMIN' }))).resolves.toBeNull();
    await expect(resolveAiToolBranchScope(input({ role: 'STUDENT' }))).resolves.toBeNull();
  });

  it('rejects an Organization that does not represent the selected clinic', async () => {
    organizationFindFirst.mockResolvedValue({ id: 'org-1', type: 'CLINIC', originalId: 'clinic-other' });
    await expect(resolveAiToolBranchScope(input())).resolves.toBeNull();
  });
});

describe('branch-aware Prisma predicates', () => {
  const narrow = { roleScope: 'ASSIGNED' as const, branchId: 'branch-1', allowedBranchIds: ['branch-1'] };

  it('filters patients, inventory and patient-linked lab orders', () => {
    expect(patientBranchWhere(narrow)).toEqual({ branchId: 'branch-1' });
    expect(inventoryBranchWhere(narrow)).toEqual({ branchId: 'branch-1' });
    expect(labOrderBranchWhere(narrow)).toEqual({ patient: { branchId: 'branch-1' } });
  });

  it('requires appointment and invoice branch to agree with linked patient branch', () => {
    const expected = {
      patient: { branchId: 'branch-1' },
      OR: [{ branchId: 'branch-1' }, { branchId: null }],
    };
    expect(appointmentBranchWhere(narrow)).toEqual(expected);
    expect(invoiceBranchWhere(narrow)).toEqual(expected);
  });

  it('does not narrow an organization-wide scope with no selected branch', () => {
    const wide = { roleScope: 'ORGANIZATION' as const, branchId: null, allowedBranchIds: ['branch-1', 'branch-2'] };
    expect(patientBranchWhere(wide)).toEqual({});
    expect(appointmentBranchWhere(wide)).toEqual({});
    expect(invoiceBranchWhere(wide)).toEqual({});
    expect(inventoryBranchWhere(wide)).toEqual({});
    expect(labOrderBranchWhere(wide)).toEqual({});
  });
});
