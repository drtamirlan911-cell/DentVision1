/**
 * Canonical partner transaction economics.
 * Amounts are whole KZT (not tiyn/minor units).
 * Call only after confirmed commercial settlement and persist the returned snapshot.
 * Source: docs/business/DENTVISION_PARTNER_ECONOMICS.md v1.2.
 */
export const PARTNER_ECONOMICS_POLICY_VERSION = '1.2';

export type PartnerBranchSubscriptionVertical = 'DIAGNOSTIC_3D' | 'MEDICAL_ANALYSIS' | 'DENTAL_LAB';

export interface PartnerBranchSubscriptionQuote {
  policyVersion: string;
  vertical: PartnerBranchSubscriptionVertical;
  currency: 'KZT';
  organizationActivated: boolean;
  activeBillableBranchCount: number;
  billableBranchCount: number;
  unitPriceKzt: number;
  monthlyTotalKzt: number;
}

const PARTNER_BRANCH_MONTHLY_PRICE_KZT: Record<PartnerBranchSubscriptionVertical, number> = {
  DIAGNOSTIC_3D: 49_900,
  MEDICAL_ANALYSIS: 19_900,
  DENTAL_LAB: 29_900,
};

/**
 * Quotes only the approved branch subscription layer. Transaction commission
 * is calculated and settled separately. An activated branch-priced partner
 * has a one-branch minimum; an inactive organization has no billable branches.
 * This is a quote primitive, not an invoice, proration or payment operation.
 */
export function calculatePartnerBranchSubscriptionQuote(input: {
  vertical: PartnerBranchSubscriptionVertical;
  organizationActivated: boolean;
  activeBillableBranchCount: number;
}): PartnerBranchSubscriptionQuote {
  const { vertical, organizationActivated, activeBillableBranchCount } = input;
  if (typeof organizationActivated !== 'boolean') {
    throw new Error('organizationActivated must be a boolean');
  }
  if (!Number.isSafeInteger(activeBillableBranchCount) || activeBillableBranchCount < 0) {
    throw new Error('activeBillableBranchCount must be a non-negative safe integer');
  }

  const unitPriceKzt = PARTNER_BRANCH_MONTHLY_PRICE_KZT[vertical];
  if (!Number.isSafeInteger(unitPriceKzt) || unitPriceKzt <= 0) {
    throw new Error('Unsupported branch subscription vertical');
  }

  const billableBranchCount = organizationActivated ? Math.max(1, activeBillableBranchCount) : 0;
  const monthlyTotal = BigInt(unitPriceKzt) * BigInt(billableBranchCount);
  if (monthlyTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Branch subscription quote exceeds the safe KZT amount range');
  }

  return {
    policyVersion: PARTNER_ECONOMICS_POLICY_VERSION,
    vertical,
    currency: 'KZT',
    organizationActivated,
    activeBillableBranchCount,
    billableBranchCount,
    unitPriceKzt,
    monthlyTotalKzt: Number(monthlyTotal),
  };
}

export type PartnerTransactionDomain = 'DIAGNOSTIC_STUDY' | 'MEDICAL_ANALYSIS' | 'DENTAL_LAB_CASE' | 'MARKETPLACE_SALE';
export type SupplierTier = 'STANDARD' | 'HIGH_VOLUME' | 'STRATEGIC';
export type AcademyAcquisitionSource = 'LECTURER_OWN_AUDIENCE' | 'DENTVISION_ACQUISITION' | 'DENTVISION_FULL_SERVICE';

export interface PartnerFeeSnapshot {
  policyVersion: string;
  domain: PartnerTransactionDomain;
  grossAmountKzt: number;
  rateBps: number;
  minimumFeeKzt: number;
  maximumFeeKzt: number | null;
  commissionKzt: number;
  partnerNetBeforeExternalDeductionsKzt: number;
  effectiveRateBps: number;
}

function assertValidAmount(amountKzt: number): void {
  if (!Number.isSafeInteger(amountKzt) || amountKzt <= 0) {
    throw new Error('grossAmountKzt must be a positive safe integer in KZT');
  }
}

function feeSnapshot(input: {
  domain: PartnerTransactionDomain;
  grossAmountKzt: number;
  rateBps: number;
  minimumFeeKzt: number;
  maximumFeeKzt: number | null;
}): PartnerFeeSnapshot {
  assertValidAmount(input.grossAmountKzt);
  // Match the finance ledger's integer-minor-unit contract: never round a fee up.
  // BigInt keeps multiplication exact even for large safe-integer KZT amounts.
  if (!Number.isSafeInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 10_000) {
    throw new Error('rateBps must be an integer between 0 and 10000');
  }
  const percentageFee = Number((BigInt(input.grossAmountKzt) * BigInt(input.rateBps)) / 10_000n);
  const calculatedCommissionKzt = input.maximumFeeKzt === null
    ? Math.max(input.minimumFeeKzt, percentageFee)
    : Math.min(input.maximumFeeKzt, Math.max(input.minimumFeeKzt, percentageFee));
  // A minimum fee cannot exceed the actual sale amount; partner net stays non-negative.
  const commissionKzt = Math.min(input.grossAmountKzt, calculatedCommissionKzt);

  return {
    policyVersion: PARTNER_ECONOMICS_POLICY_VERSION,
    domain: input.domain,
    grossAmountKzt: input.grossAmountKzt,
    rateBps: input.rateBps,
    minimumFeeKzt: input.minimumFeeKzt,
    maximumFeeKzt: input.maximumFeeKzt,
    commissionKzt,
    partnerNetBeforeExternalDeductionsKzt: input.grossAmountKzt - commissionKzt,
    effectiveRateBps: Math.round((commissionKzt / input.grossAmountKzt) * 10_000),
  };
}

export function calculatePartnerTransactionFee(input: {
  domain: PartnerTransactionDomain;
  grossAmountKzt: number;
  monthlyOrganizationGmvKzt?: number;
  supplierTier?: SupplierTier;
  strategicSupplierRateBps?: number;
}): PartnerFeeSnapshot {
  const { domain, grossAmountKzt } = input;

  switch (domain) {
    case 'DIAGNOSTIC_STUDY':
      return feeSnapshot({ domain, grossAmountKzt, rateBps: 700, minimumFeeKzt: 500, maximumFeeKzt: 3_000 });
    case 'MEDICAL_ANALYSIS':
      return feeSnapshot({ domain, grossAmountKzt, rateBps: 600, minimumFeeKzt: 150, maximumFeeKzt: 2_500 });
    case 'DENTAL_LAB_CASE': {
      const gmv = input.monthlyOrganizationGmvKzt;
      if (!Number.isSafeInteger(gmv) || (gmv as number) < 0) {
        throw new Error('monthlyOrganizationGmvKzt is required as a non-negative safe integer');
      }
      const rateBps = gmv! <= 1_000_000 ? 1_000
        : gmv! <= 5_000_000 ? 800
        : gmv! <= 15_000_000 ? 700
        : gmv! <= 30_000_000 ? 600
        : 500;
      return feeSnapshot({ domain, grossAmountKzt, rateBps, minimumFeeKzt: 500, maximumFeeKzt: 15_000 });
    }
    case 'MARKETPLACE_SALE': {
      const tier = input.supplierTier ?? 'STANDARD';
      const rateBps = tier === 'STANDARD' ? 800
        : tier === 'HIGH_VOLUME' ? 600
        : input.strategicSupplierRateBps;
      if (tier === 'STRATEGIC' && (!Number.isInteger(rateBps) || (rateBps as number) < 400 || (rateBps as number) > 500)) {
        throw new Error('Strategic supplier rate must be explicitly approved between 400 and 500 bps');
      }
      return feeSnapshot({ domain, grossAmountKzt, rateBps: rateBps as number, minimumFeeKzt: 0, maximumFeeKzt: null });
    }
  }
}

export function resolveAcademyRevenueSplit(source: AcademyAcquisitionSource): {
  policyVersion: string;
  dentVisionBps: number;
  lecturerBps: number;
} {
  const dentVisionBps = source === 'LECTURER_OWN_AUDIENCE' ? 1_000
    : source === 'DENTVISION_ACQUISITION' ? 2_500
    : 3_000;
  return { policyVersion: PARTNER_ECONOMICS_POLICY_VERSION, dentVisionBps, lecturerBps: 10_000 - dentVisionBps };
}
