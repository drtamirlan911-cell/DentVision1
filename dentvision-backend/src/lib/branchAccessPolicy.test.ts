import { describe, expect, it } from 'vitest';
import { canAccessBranch } from './branchAccessPolicy.js';

describe('branchAccessPolicy', () => {
  const base = {
    organizationId: 'org-1',
    userOrganizationId: 'org-1',
    assignedBranchIds: ['branch-1'],
  } as const;

  it('allows organization-scoped users across branches in their organization', () => {
    expect(canAccessBranch({ ...base, scope: 'ORGANIZATION', requestedBranchId: 'branch-99' }))
      .toEqual({ allowed: true, reason: 'ORGANIZATION_SCOPE' });
  });

  it('denies cross-organization access even for organization scope', () => {
    expect(canAccessBranch({ ...base, organizationId: 'org-2', scope: 'ORGANIZATION', requestedBranchId: 'branch-1' }))
      .toEqual({ allowed: false, reason: 'ORGANIZATION_MISMATCH' });
  });

  it('requires a branch for branch-scoped access', () => {
    expect(canAccessBranch({ ...base, scope: 'BRANCH', requestedBranchId: null }))
      .toEqual({ allowed: false, reason: 'BRANCH_REQUIRED' });
  });

  it('denies a branch outside the caller assignment', () => {
    expect(canAccessBranch({ ...base, scope: 'BRANCH', requestedBranchId: 'branch-2' }))
      .toEqual({ allowed: false, reason: 'BRANCH_NOT_ASSIGNED' });
  });

  it('allows an assigned branch', () => {
    expect(canAccessBranch({ ...base, scope: 'ASSIGNED', requestedBranchId: 'branch-1' }))
      .toEqual({ allowed: true, reason: 'ASSIGNED_BRANCH' });
  });

  it('fails closed when organization context is missing', () => {
    expect(canAccessBranch({ ...base, userOrganizationId: null, scope: 'ORGANIZATION', requestedBranchId: 'branch-1' }))
      .toEqual({ allowed: false, reason: 'NO_ORGANIZATION' });
  });
});
