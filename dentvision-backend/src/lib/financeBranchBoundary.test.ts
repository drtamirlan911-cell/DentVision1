import { describe, expect, it } from 'vitest';
import { canAccessFinanceScope } from './financeBranchBoundary.js';

const base = {
  organizationId: 'org-1',
  assignedBranchId: 'branch-a',
  branchIds: ['branch-a'],
};

describe('finance branch boundary', () => {
  it('allows organization finance roles across their organization', () => {
    for (const role of ['OWNER', 'ADMIN', 'ACCOUNTANT']) {
      expect(canAccessFinanceScope({ ...base, role }, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(true);
    }
  });

  it('restricts non-organization roles to assigned branches', () => {
    expect(canAccessFinanceScope({ ...base, role: 'MANAGER' }, { organizationId: 'org-1', branchId: 'branch-a' })).toBe(true);
    expect(canAccessFinanceScope({ ...base, role: 'MANAGER' }, { organizationId: 'org-1', branchId: 'branch-b' })).toBe(false);
  });

  it('fails closed without branch context', () => {
    expect(canAccessFinanceScope({ ...base, role: 'MANAGER', assignedBranchId: undefined, branchIds: [] }, { organizationId: 'org-1', branchId: 'branch-a' })).toBe(false);
    expect(canAccessFinanceScope({ ...base, role: 'MANAGER' }, { organizationId: 'org-1' })).toBe(false);
  });

  it('denies cross-organization access for every role', () => {
    for (const role of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'DOCTOR', 'ASSISTANT']) {
      expect(canAccessFinanceScope({ ...base, role }, { organizationId: 'org-2', branchId: 'branch-a' })).toBe(false);
    }
  });
});
