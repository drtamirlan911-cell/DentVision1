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
 * Canonical branch subscription prices. Transaction commissions are deliberately
 * not represented here: branch existence is subscription economics, while
 * DentVision-generated orders/cases/studies are commission economics.
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
  activeBranches: number;
  billableBranches: number;
  unitPriceTenge: number;
  monthlyAmountTenge: number;
  billingUnit: 'ACTIVE_BRANCH';
}

export function isBranchBillingOrganizationType(value: string): value is BranchBillingOrganizationType {
  return Object.prototype.hasOwnProperty.call(BRANCH_BILLING_POLICIES, value);
}

export function quoteBranchSubscription(
  organizationType: BranchBillingOrganizationType,
  activeBranches: number,
): BranchSubscriptionQuote {
  if (!Number.isInteger(activeBranches) || activeBranches < 0) {
    throw new Error('activeBranches must be a non-negative integer');
  }

  const policy = BRANCH_BILLING_POLICIES[organizationType];
  const billableBranches = Math.max(activeBranches, policy.minBillableBranches);

  return {
    organizationType,
    activeBranches,
    billableBranches,
    unitPriceTenge: policy.priceTenge,
    monthlyAmountTenge: billableBranches * policy.priceTenge,
    billingUnit: policy.billingUnit,
  };
}
