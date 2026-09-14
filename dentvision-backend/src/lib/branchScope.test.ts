import { describe, expect, it } from 'vitest';
import { canAccessBranch, visibleBranches } from './branchScope';

describe('branch scope policy', () => {
  const base = { organizationId: 'org-1', assignedBranchIds: ['branch-a'] };

  it('allows organization roles to access any branch in their organization', () => {
    expect(canAccessBranch('OWNER', base, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(true);
    expect(canAccessBranch('ADMIN', base, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(true);
    expect(canAccessBranch('ACCOUNTANT', base, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(true);
  });

  it('restricts branch roles to assigned branches', () => {
    for (const role of ['MANAGER', 'RECEPTIONIST', 'CASHIER'] as const) {
      expect(canAccessBranch(role, base, { organizationId: 'org-1', branchId: 'branch-a' })).toBe(true);
      expect(canAccessBranch(role, base, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(false);
    }
  });

  it('restricts doctor and assistant to assigned branches', () => {
    expect(canAccessBranch('DOCTOR', base, { organizationId: 'org-1', branchId: 'branch-a' })).toBe(true);
    expect(canAccessBranch('DOCTOR', base, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(false);
    expect(canAccessBranch('ASSISTANT', base, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(false);
  });

  it('denies every cross-organization branch request', () => {
    for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'DOCTOR', 'ASSISTANT', 'RECEPTIONIST', 'CASHIER', 'ACCOUNTANT'] as const) {
      expect(canAccessBranch(role, base, { organizationId: 'org-2', branchId: 'branch-a' })).toBe(false);
    }
  });

  it('fails closed when target branch is missing', () => {
    expect(canAccessBranch('OWNER', base, { organizationId: 'org-1' })).toBe(false);
  });

  it('returns a structural organization predicate for organization roles', () => {
    expect(visibleBranches('OWNER', base)).toEqual({ mode: 'ORGANIZATION', organizationId: 'org-1' });
  });

  it('returns assigned branch IDs for branch-scoped roles', () => {
    expect(visibleBranches('MANAGER', base)).toEqual({
      mode: 'ASSIGNED',
      organizationId: 'org-1',
      branchIds: ['branch-a'],
    });
  });
});
