import { describe, expect, it } from 'vitest';
import { assertBranchAccess, authorizeBranchScope, canAccessBranch } from './branchAuthorization.js';

describe('branch authorization', () => {
  const branchA = { organizationId: 'org-1', branchId: 'branch-a' };
  const branchB = { organizationId: 'org-1', branchId: 'branch-b' };

  it('allows organization scope across branches in the same organization', () => {
    expect(canAccessBranch({ organizationId: 'org-1', roleScope: 'ORGANIZATION' }, branchA)).toBe(true);
    expect(canAccessBranch({ organizationId: 'org-1', roleScope: 'ORGANIZATION' }, branchB)).toBe(true);
  });

  it('denies every scope when the organization does not match', () => {
    expect(authorizeBranchScope({ organizationId: 'org-2', roleScope: 'ORGANIZATION' }, branchA)).toEqual({
      allowed: false,
      reason: 'ORGANIZATION_MISMATCH',
    });
    expect(canAccessBranch({ organizationId: 'org-2', roleScope: 'BRANCH', branchIds: ['branch-a'] }, branchA)).toBe(false);
  });

  it('allows branch managers only for explicitly assigned branches', () => {
    const actor = { organizationId: 'org-1', roleScope: 'BRANCH' as const, branchIds: ['branch-a'] };
    expect(canAccessBranch(actor, branchA)).toBe(true);
    expect(authorizeBranchScope(actor, branchB)).toEqual({
      allowed: false,
      reason: 'BRANCH_NOT_ASSIGNED',
    });
  });

  it('fails closed when a branch-scoped resource has no branch', () => {
    expect(authorizeBranchScope(
      { organizationId: 'org-1', roleScope: 'BRANCH', branchIds: ['branch-a'] },
      { organizationId: 'org-1' },
    )).toEqual({ allowed: false, reason: 'BRANCH_REQUIRED' });
  });

  it('allows assigned specialists only in their assigned branch', () => {
    const actor = { organizationId: 'org-1', roleScope: 'ASSIGNED' as const, assignedBranchId: 'branch-a' };
    expect(canAccessBranch(actor, branchA)).toBe(true);
    expect(canAccessBranch(actor, branchB)).toBe(false);
  });

  it('supports ownership scope without weakening organization isolation', () => {
    const actor = { organizationId: 'org-1', roleScope: 'OWN' as const, userId: 'user-1' };
    expect(canAccessBranch(actor, { ...branchA, ownerUserId: 'user-1' })).toBe(true);
    expect(canAccessBranch(actor, { ...branchA, ownerUserId: 'user-2' })).toBe(false);
    expect(canAccessBranch(actor, { ...branchA, ownerUserId: 'user-1', organizationId: 'org-2' })).toBe(false);
  });

  it('asserts with a stable authorization error', () => {
    expect(() => assertBranchAccess(
      { organizationId: 'org-1', roleScope: 'BRANCH', branchIds: ['branch-a'] },
      branchB,
    )).toThrow('Branch access denied: BRANCH_NOT_ASSIGNED');
  });
});
