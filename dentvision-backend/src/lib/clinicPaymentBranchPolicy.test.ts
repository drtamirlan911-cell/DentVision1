import { describe, expect, it } from 'vitest';
import { canAccessClinicPaymentBranch } from './clinicPaymentBranchPolicy.js';

describe('clinic payment branch access', () => {
  it('allows a canonical reference in the authenticated active branch list', () => {
    expect(canAccessClinicPaymentBranch({
      role: 'OWNER',
      activeBranchIds: ['branch-a', 'branch-b'],
      referenceBranchId: 'branch-b',
    })).toBe(true);
  });

  it('denies references from archived or unassigned branches', () => {
    expect(canAccessClinicPaymentBranch({
      role: 'OWNER',
      activeBranchIds: ['branch-a'],
      referenceBranchId: 'branch-archived',
    })).toBe(false);
  });

  it('uses only server-persisted branch metadata for unreferenced cashier payments', () => {
    expect(canAccessClinicPaymentBranch({
      role: 'CASHIER',
      activeBranchIds: ['branch-a'],
      persistedBranchId: 'branch-a',
    })).toBe(true);
    expect(canAccessClinicPaymentBranch({
      role: 'CASHIER',
      activeBranchIds: ['branch-a'],
      persistedBranchId: 'branch-b',
    })).toBe(false);
    expect(canAccessClinicPaymentBranch({
      role: 'CASHIER',
      activeBranchIds: ['branch-a'],
    })).toBe(false);
  });

  it('fails closed when no active branches remain', () => {
    expect(canAccessClinicPaymentBranch({
      role: 'OWNER',
      activeBranchIds: [],
      persistedBranchId: 'branch-a',
    })).toBe(false);
  });

  it('retains the explicit SUPERADMIN platform exception', () => {
    expect(canAccessClinicPaymentBranch({
      role: 'SUPERADMIN',
      activeBranchIds: [],
      referenceBranchId: null,
    })).toBe(true);
  });
});
