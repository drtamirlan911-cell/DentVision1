/**
 * Canonical partner transaction economics.
 * Amounts are whole KZT (not tiyn/minor units).
 * Call only after confirmed commercial settlement and persist the returned snapshot.
 * Source: docs/business/DENTVISION_PARTNER_ECONOMICS.md v1.2.
 */
export const PARTNER_ECONOMICS_POLICY_VERSION = '1.2';

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
  const percentageFee = Math.round((input.grossAmountKzt * input.rateBps) / 10_000);
  const commissionKzt = input.maximumFeeKzt === null
    ? Math.max(input.minimumFeeKzt, percentageFee)
    : Math.min(input.maximumFeeKzt, Math.max(input.minimumFeeKzt, percentageFee));

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
