import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock('./prisma.js', () => ({
  default: { $queryRaw: queryRaw },
}));

import { canAccessReferralBranch } from './diagnosticReferralBranchPolicy.js';

beforeEach(() => {
  queryRaw.mockReset();
});

const clinicDoctor = {
  id: 'doctor-1',
  role: 'DOCTOR',
  organizationId: 'clinic-org-1',
  assignedBranchId: null,
  branchIds: [],
  clinicId: 'clinic-1',
};

describe('diagnostic referral branch archive enforcement', () => {
  it('denies a doctor whose only legacy clinic-member assignment points to an archived branch', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: 'branch-old', branch_active: false }]);

    await expect(canAccessReferralBranch(clinicDoctor, {
      clinicId: 'clinic-1',
      branchId: 'branch-old',
    })).resolves.toBe(false);
  });

  it('does not grant an owner access to an archived branch through a legacy assignment', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: 'branch-old', branch_active: false }])
      .mockResolvedValueOnce([]);

    await expect(canAccessReferralBranch({ ...clinicDoctor, role: 'OWNER' }, {
      clinicId: 'clinic-1',
      branchId: 'branch-old',
    })).resolves.toBe(false);
  });

  it('continues to allow an assigned doctor in an active branch', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: 'branch-active', branch_active: true }]);

    await expect(canAccessReferralBranch(clinicDoctor, {
      clinicId: 'clinic-1',
      branchId: 'branch-active',
    })).resolves.toBe(true);
  });
});
