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

/** Existing subscription data uses ENTERPRISE for the clinic tier that maps
 * to the canonical NETWORK branch model. Keep this compatibility mapping
 * centralized so individual routes do not invent plan aliases. */
export function isClinicNetworkPlan(plan?: string | null): boolean {
  const normalized = String(plan || '').trim().toUpperCase();
  return normalized === 'NETWORK' || normalized === 'ENTERPRISE';
}

/** A clinic may keep its first/default branch on its organization SaaS plan.
 * A second active branch requires NETWORK/enterprise-equivalent economics. */
export function canCreateClinicBranch(activeBranches: number, plan?: string | null): boolean {
  if (!Number.isInteger(activeBranches) || activeBranches < 0) {
    throw new Error('activeBranches must be a non-negative integer');
  }
  return activeBranches === 0 || isClinicNetworkPlan(plan);
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

  if (organizationType === 'CLINIC' && !isClinicNetworkPlan(plan)) {
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
  // No active branch means no branch capacity is being consumed and therefore
  // no branch subscription may be charged. This also keeps billing idempotent
  // when the last branch is deactivated.
  const billableBranches = activeBranches === 0
    ? 0
    : Math.max(activeBranches, policy.minBillableBranches);

  return {
    organizationType,
    plan: plan || undefined,
    activeBranches,
    billableBranches,
    unitPriceTenge: policy.priceTenge,
    monthlyAmountTenge: billableBranches * policy.priceTenge,
    billingUnit: policy.billingUnit,
    enabled: billableBranches > 0,
    ...(billableBranches === 0 ? { reason: 'Нет активных филиалов для биллинга' } : {}),
  };
}
