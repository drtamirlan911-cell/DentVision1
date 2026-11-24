import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock('./prisma.js', () => ({
  default: { $queryRaw: queryRaw },
}));

import { canAccessReferralBranch, isActiveClinicContext } from './diagnosticReferralBranchPolicy.js';

beforeEach(() => {
  queryRaw.mockReset();
});

const clinicDoctor = {
  id: 'doctor-1',
  role: 'DOCTOR',
  organizationId: 'clinic-org-1',
  organizationOriginalId: 'clinic-1',
  organizationType: 'CLINIC',
  assignedBranchId: null,
  branchIds: [],
  clinicId: 'clinic-1',
};

describe('diagnostic referral clinic context enforcement', () => {
  it('accepts only the exact active clinic context', () => {
    expect(isActiveClinicContext(clinicDoctor, 'clinic-1')).toBe(true);
    expect(isActiveClinicContext({ ...clinicDoctor, organizationOriginalId: undefined, organizationId: 'clinic-1' }, 'clinic-1')).toBe(true);
    expect(isActiveClinicContext(clinicDoctor, 'clinic-other')).toBe(false);
    expect(isActiveClinicContext({
      ...clinicDoctor,
      organizationId: 'diagnostic-org-1',
      organizationOriginalId: 'center-1',
      organizationType: 'DIAGNOSTIC_CENTER',
    }, 'clinic-1')).toBe(false);
    expect(isActiveClinicContext({
      ...clinicDoctor,
      organizationOriginalId: 'clinic-other',
    }, 'clinic-1')).toBe(false);
  });

  it('does not let a partner workspace use retained clinic membership to read a referral', async () => {
    const partnerUser = {
      ...clinicDoctor,
      organizationId: 'diagnostic-org-1',
      organizationOriginalId: 'center-1',
      organizationType: 'DIAGNOSTIC_CENTER',
    };

    await expect(canAccessReferralBranch(partnerUser, {
      clinicId: 'clinic-1',
      branchId: 'branch-active',
    })).resolves.toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe('diagnostic referral branch archive enforcement', () => {
  it('denies a doctor whose active branch allow-list does not include the referral branch', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: null, branch_active: false }]);
    await expect(canAccessReferralBranch(clinicDoctor, {
      clinicId: 'clinic-1',
      branchId: 'branch-old',
    })).resolves.toBe(false);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not grant an owner access to an archived branch through an organization-wide role', async () => {
    queryRaw
      .mockResolvedValueOnce([{ branch_id: 'branch-old', branch_active: false }])
      .mockResolvedValueOnce([]);

    await expect(canAccessReferralBranch({
      ...clinicDoctor,
      role: 'OWNER',
      branchIds: ['branch-old'],
    }, {
      clinicId: 'clinic-1',
      branchId: 'branch-old',
    })).resolves.toBe(false);
  });

  it('allows a canonical-only clinic member with an active BranchMember assignment', async () => {
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'branch-active' }]);

    await expect(canAccessReferralBranch({
      ...clinicDoctor,
      branchIds: ['branch-active'],
    }, {
      clinicId: 'clinic-1',
      branchId: 'branch-active',
    })).resolves.toBe(true);
  });

  it('allows an organization manager only within its active branch allow-list', async () => {
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'branch-active' }]);

    await expect(canAccessReferralBranch({
      ...clinicDoctor,
      role: 'OWNER',
      branchIds: ['branch-active'],
    }, {
      clinicId: 'clinic-1',
      branchId: 'branch-active',
    })).resolves.toBe(true);
  });

  it('denies a branch mapped to a different organization, even when its legacy clinic id matches', async () => {
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(canAccessReferralBranch({
      ...clinicDoctor,
      branchIds: ['branch-foreign'],
    }, {
      clinicId: 'clinic-1',
      branchId: 'branch-foreign',
    })).resolves.toBe(false);
  });

  it('rechecks branch active state even when a stale token still lists the branch', async () => {
    queryRaw
      .mockResolvedValueOnce([{ branch_id: 'branch-old', branch_active: false }])
      .mockResolvedValueOnce([]);

    await expect(canAccessReferralBranch({
      ...clinicDoctor,
      assignedBranchId: 'branch-old',
      branchIds: ['branch-old'],
    }, {
      clinicId: 'clinic-1',
      branchId: 'branch-old',
    })).resolves.toBe(false);
  });
});
