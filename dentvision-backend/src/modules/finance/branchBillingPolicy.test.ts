import { describe, expect, it } from 'vitest';
import {
  BRANCH_BILLING_POLICIES,
  canCreateClinicBranch,
  isBranchBillingOrganizationType,
  isClinicNetworkPlan,
  quoteBranchSubscription,
} from './branchBillingPolicy.js';

describe('branch billing policy', () => {
  it('uses one billable branch for a single-location diagnostic organization', () => {
    expect(quoteBranchSubscription('DIAGNOSTIC_CENTER', 1)).toMatchObject({
      activeBranches: 1,
      billableBranches: 1,
      unitPriceTenge: 49_900,
      monthlyAmountTenge: 49_900,
      enabled: true,
    });
  });

  it('scales subscription by active branches without adding a branch commission', () => {
    expect(quoteBranchSubscription('DIAGNOSTIC_CENTER', 3)).toMatchObject({
      activeBranches: 3,
      billableBranches: 3,
      monthlyAmountTenge: 149_700,
    });
    expect(BRANCH_BILLING_POLICIES.DIAGNOSTIC_CENTER.billingUnit).toBe('ACTIVE_BRANCH');
  });

  it('keeps medical and dental laboratory branch prices distinct', () => {
    expect(quoteBranchSubscription('MEDICAL_LAB', 2).monthlyAmountTenge).toBe(39_800);
    expect(quoteBranchSubscription('DENTAL_LAB', 2).monthlyAmountTenge).toBe(59_800);
  });

  it('allows branch pricing for a clinic only on NETWORK', () => {
    expect(quoteBranchSubscription('CLINIC', 2, 'NETWORK')).toMatchObject({
      enabled: true,
      billableBranches: 2,
      monthlyAmountTenge: 299_800,
    });
    expect(quoteBranchSubscription('CLINIC', 2, 'PRO')).toMatchObject({
      enabled: false,
      billableBranches: 0,
      monthlyAmountTenge: 0,
    });
  });

  it('keeps the existing ENTERPRISE subscription alias compatible with NETWORK economics', () => {
    expect(isClinicNetworkPlan('enterprise')).toBe(true);
    expect(quoteBranchSubscription('CLINIC', 2, 'enterprise')).toMatchObject({
      enabled: true,
      billableBranches: 2,
      monthlyAmountTenge: 299_800,
    });
  });

  it('allows the first clinic branch but requires NETWORK economics for additional branches', () => {
    expect(canCreateClinicBranch(0, 'PRO')).toBe(true);
    expect(canCreateClinicBranch(1, 'PRO')).toBe(false);
    expect(canCreateClinicBranch(1, 'NETWORK')).toBe(true);
    expect(canCreateClinicBranch(2, 'enterprise')).toBe(true);
  });

  it('rejects invalid branch counts', () => {
    expect(() => quoteBranchSubscription('DENTAL_LAB', -1)).toThrow();
    expect(() => quoteBranchSubscription('DENTAL_LAB', 1.5)).toThrow();
    expect(() => canCreateClinicBranch(-1, 'NETWORK')).toThrow();
  });

  it('does not silently treat unsupported organization types as billable branches', () => {
    expect(isBranchBillingOrganizationType('SUPPLIER')).toBe(false);
    expect(isBranchBillingOrganizationType('ACADEMY')).toBe(false);
  });
});
