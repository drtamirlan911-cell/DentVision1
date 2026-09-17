export type BranchBillingOrganizationType =
  | 'CLINIC'
  | 'DIAGNOSTIC_CENTER'
  | 'MEDICAL_LAB'
  | 'DENTAL_LAB';

export interface BranchBillingPolicy {
  organizationType: BranchBillingOrganizationType;
  priceTenge: number;
  currency: 'KZT';
  billingUnit: 'ACTIVE_BRANCH';
  minBillableBranches: number;
}

/**
 * Branch subscription prices inherited from the canonical partner economics
 * policy. A clinic is branch-priced only on NETWORK; START/PRO/BUSINESS remain
 * organization SaaS plans. Partner verticals listed here are branch-priced by
 * their current policy.
 */
export const BRANCH_BILLING_POLICIES: Record<BranchBillingOrganizationType, BranchBillingPolicy> = {
  CLINIC: {
    organizationType: 'CLINIC',
    priceTenge: 149_900,
    currency: 'KZT',
    billingUnit: 'ACTIVE_BRANCH',
    minBillableBranches: 1,
  },
  DIAGNOSTIC_CENTER: {
    organizationType: 'DIAGNOSTIC_CENTER',
    priceTenge: 49_900,
    currency: 'KZT',
    billingUnit: 'ACTIVE_BRANCH',
    minBillableBranches: 1,
  },
  MEDICAL_LAB: {
    organizationType: 'MEDICAL_LAB',
    priceTenge: 19_900,
    currency: 'KZT',
    billingUnit: 'ACTIVE_BRANCH',
    minBillableBranches: 1,
  },
  DENTAL_LAB: {
    organizationType: 'DENTAL_LAB',
    priceTenge: 29_900,
    currency: 'KZT',
    billingUnit: 'ACTIVE_BRANCH',
    minBillableBranches: 1,
  },
};

export interface BranchSubscriptionQuote {
  organizationType: BranchBillingOrganizationType;
  plan?: string;
  activeBranches: number;
  billableBranches: number;
  unitPriceTenge: number;
  monthlyAmountTenge: number;
  billingUnit: 'ACTIVE_BRANCH';
  enabled: boolean;
  reason?: string;
}

export function isBranchBillingOrganizationType(value: string): value is BranchBillingOrganizationType {
  return Object.prototype.hasOwnProperty.call(BRANCH_BILLING_POLICIES, value);
}

export function quoteBranchSubscription(
  organizationType: BranchBillingOrganizationType,
  activeBranches: number,
  plan?: string | null,
): BranchSubscriptionQuote {
  if (!Number.isInteger(activeBranches) || activeBranches < 0) {
    throw new Error('activeBranches must be a non-negative integer');
  }

  if (organizationType === 'CLINIC' && String(plan || '').toUpperCase() !== 'NETWORK') {
    return {
      organizationType,
      plan: plan || undefined,
      activeBranches,
      billableBranches: 0,
      unitPriceTenge: 0,
      monthlyAmountTenge: 0,
      billingUnit: 'ACTIVE_BRANCH',
      enabled: false,
      reason: 'Дополнительные филиалы для клиники доступны на тарифе NETWORK',
    };
  }

  const policy = BRANCH_BILLING_POLICIES[organizationType];
  const billableBranches = Math.max(activeBranches, policy.minBillableBranches);

  return {
    organizationType,
    plan: plan || undefined,
    activeBranches,
    billableBranches,
    unitPriceTenge: policy.priceTenge,
    monthlyAmountTenge: billableBranches * policy.priceTenge,
    billingUnit: policy.billingUnit,
    enabled: true,
  };
}
