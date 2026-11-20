import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicBranchAccess } = vi.hoisted(() => ({
  resolveClinicBranchAccess: vi.fn(),
}));

vi.mock('./clinicBranchAccess.js', () => ({ resolveClinicBranchAccess }));

import {
  assertReferralBranchAccess,
  canAccessReferralBranch,
} from './diagnosticReferralBranchPolicy.js';

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-a',
  role: 'DOCTOR',
  organizationId: 'org-a',
  clinicId: 'clinic-a',
  branchId: null,
  ...overrides,
});

const referral = (overrides: Record<string, unknown> = {}) => ({
  clinicId: 'clinic-a',
  branchId: 'branch-a',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('diagnostic referral branch policy', () => {
  it('fails closed when clinic or referral branch context is missing', async () => {
    await expect(canAccessReferralBranch(user() as never, referral({ clinicId: '' }))).resolves.toBe(false);
    await expect(canAccessReferralBranch(user() as never, referral({ branchId: null }))).resolves.toBe(false);
    expect(resolveClinicBranchAccess).not.toHaveBeenCalled();
  });

  it('allows SUPERADMIN through its explicit platform bypass', async () => {
    await expect(canAccessReferralBranch(
      user({ role: 'SUPERADMIN' }) as never,
      referral(),
    )).resolves.toBe(true);
    expect(resolveClinicBranchAccess).not.toHaveBeenCalled();
  });

  it('allows an unselected organization role across verified active branches', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION',
      branchId: null,
      allowedBranchIds: ['branch-a', 'branch-b'],
    });

    await expect(canAccessReferralBranch(
      user({ role: 'OWNER' }) as never,
      referral({ branchId: 'branch-b' }),
    )).resolves.toBe(true);
    expect(resolveClinicBranchAccess).toHaveBeenCalledWith({
      userId: 'user-a',
      clinicId: 'clinic-a',
      organizationId: 'org-a',
      role: 'OWNER',
      requestedBranchId: null,
    });
  });

  it('narrows an organization role to the selected active branch', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION',
      branchId: 'branch-a',
      allowedBranchIds: ['branch-a', 'branch-b'],
    });

    await expect(canAccessReferralBranch(
      user({ role: 'ADMIN', branchId: 'branch-a' }) as never,
      referral({ branchId: 'branch-a' }),
    )).resolves.toBe(true);
    await expect(canAccessReferralBranch(
      user({ role: 'ADMIN', branchId: 'branch-a' }) as never,
      referral({ branchId: 'branch-b' }),
    )).resolves.toBe(false);
  });

  it('allows a narrow role only in its DB-verified active branch', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ASSIGNED',
      branchId: 'branch-a',
      allowedBranchIds: ['branch-a'],
    });

    await expect(canAccessReferralBranch(user() as never, referral())).resolves.toBe(true);
    await expect(canAccessReferralBranch(user() as never, referral({ branchId: 'branch-b' }))).resolves.toBe(false);
  });

  it('denies missing, revoked, ambiguous or forged branch membership', async () => {
    resolveClinicBranchAccess.mockResolvedValue(null);
    await expect(canAccessReferralBranch(user({ branchId: 'branch-victim' }) as never, referral())).resolves.toBe(false);
    expect(resolveClinicBranchAccess).toHaveBeenCalledWith(expect.objectContaining({
      requestedBranchId: 'branch-victim',
    }));
  });

  it('provides a fail-closed assertion for callers that need exceptions', () => {
    expect(() => assertReferralBranchAccess(true)).not.toThrow();
    expect(() => assertReferralBranchAccess(false)).toThrow('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
  });
});
