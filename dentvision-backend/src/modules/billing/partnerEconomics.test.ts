import { describe, expect, it } from 'vitest';
import { calculatePartnerTransactionFee, resolveAcademyRevenueSplit } from './partnerEconomics.js';

describe('canonical partner economics v1.2', () => {
  it.each([[5_000, 500], [10_000, 700], [50_000, 3_000]])('calculates diagnostic fee', (gross, expected) => {
    expect(calculatePartnerTransactionFee({ domain: 'DIAGNOSTIC_STUDY', grossAmountKzt: gross }).commissionKzt).toBe(expected);
  });

  it.each([[1_000, 150], [5_000, 300], [50_000, 2_500]])('calculates medical laboratory fee', (gross, expected) => {
    expect(calculatePartnerTransactionFee({ domain: 'MEDICAL_ANALYSIS', grossAmountKzt: gross }).commissionKzt).toBe(expected);
  });

  it.each([[1_000_000, 1_000], [1_000_001, 800], [5_000_000, 800], [5_000_001, 700], [15_000_001, 600], [30_000_001, 500]])('resolves dental-lab tier from organization GMV', (gmv, expectedBps) => {
    expect(calculatePartnerTransactionFee({
      domain: 'DENTAL_LAB_CASE', grossAmountKzt: 20_000, monthlyOrganizationGmvKzt: gmv,
    }).rateBps).toBe(expectedBps);
  });

  it('uses exact floor arithmetic for marketplace commission like the finance ledger', () => {
    const snapshot = calculatePartnerTransactionFee({
      domain: 'MARKETPLACE_SALE', grossAmountKzt: 1_007, supplierTier: 'STANDARD',
    });
    // 1,007 × 8% = 80.56 KZT; commission is floored to 80, never rounded up to 81.
    expect(snapshot.commissionKzt).toBe(80);
    expect(snapshot.partnerNetBeforeExternalDeductionsKzt).toBe(927);
  });

  it('does not invent a strategic supplier rate', () => {
    expect(() => calculatePartnerTransactionFee({
      domain: 'MARKETPLACE_SALE', grossAmountKzt: 10_000, supplierTier: 'STRATEGIC',
    })).toThrow(/explicitly approved/);
  });

  it('calculates academy splits by acquisition source', () => {
    expect(resolveAcademyRevenueSplit('LECTURER_OWN_AUDIENCE')).toEqual({
      policyVersion: '1.2', dentVisionBps: 1_000, lecturerBps: 9_000,
    });
    expect(resolveAcademyRevenueSplit('DENTVISION_ACQUISITION').dentVisionBps).toBe(2_500);
    expect(resolveAcademyRevenueSplit('DENTVISION_FULL_SERVICE').dentVisionBps).toBe(3_000);
  });

  it('rejects invalid gross amounts', () => {
    expect(() => calculatePartnerTransactionFee({ domain: 'DIAGNOSTIC_STUDY', grossAmountKzt: 0 }))
      .toThrow(/positive safe integer/);
  });

  it('shows effective rate when minimum fee applies', () => {
    const snapshot = calculatePartnerTransactionFee({ domain: 'MEDICAL_ANALYSIS', grossAmountKzt: 1_000 });
    expect(snapshot.commissionKzt).toBe(150);
    expect(snapshot.effectiveRateBps).toBe(1_500);
    expect(snapshot.partnerNetBeforeExternalDeductionsKzt).toBe(850);
  });
});
