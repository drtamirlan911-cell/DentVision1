import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock('./prisma.js', () => ({
  default: { $queryRaw: queryRaw },
}));

import { canAccessReferralBranch } from './diagnosticReferralBranchPolicy.js';

const resource = { clinicId: 'clinic-1', branchId: 'branch-1' };
const clinicUser = (role: string, branchIds: string[] = []) => ({
  id: 'user-1',
  role,
  organizationId: 'org-1',
  organizationOriginalId: 'clinic-1',
  organizationType: 'CLINIC',
  clinicId: 'clinic-1',
  assignedBranchId: null,
  branchIds,
});

beforeEach(() => {
  queryRaw.mockReset().mockResolvedValue([{ id: 'branch-1' }]);
});

describe('diagnostic referral branch policy', () => {
  it('requires the exact active clinic context and a trusted active branch allow-list', async () => {
    expect(await canAccessReferralBranch(clinicUser('DOCTOR'), resource)).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();

    expect(await canAccessReferralBranch(clinicUser('DOCTOR', ['branch-1']), resource)).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not let organization role names widen access beyond the branch allow-list', async () => {
    for (const role of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'MANAGER']) {
      expect(await canAccessReferralBranch(clinicUser(role), resource)).toBe(false);
    }
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('denies a branch that is archived or belongs to a different clinic', async () => {
    queryRaw.mockResolvedValueOnce([]);
    expect(await canAccessReferralBranch(clinicUser('OWNER', ['branch-1']), resource)).toBe(false);
  });

  it('keeps the explicit platform superadmin exception', async () => {
    expect(await canAccessReferralBranch(clinicUser('SUPERADMIN'), resource)).toBe(true);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
