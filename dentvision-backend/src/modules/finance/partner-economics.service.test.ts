import { describe, expect, it } from 'vitest';
import { calculatePartnerEconomics, canonicalPartnerEconomicsRules } from './partner-economics.service.js';

const [diagnostic, analysis, dentalLab] = canonicalPartnerEconomicsRules();

const base = {
  partnerId: 'partner-1',
  paymentCostMinor: 0n,
  aiCostMinor: 0n,
  storageCostMinor: 0n,
  supportCostMinor: 0n,
  refundReserveMinor: 0n,
  taxMinor: 0n,
};

describe('partner economics calculator', () => {
  it('applies diagnostic 7% with a 500 KZT floor', () => {
    const result = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 5_000n * 100n }, diagnostic);
    expect(result.commissionMinor).toBe(50_000n);

    const normal = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 10_000n * 100n }, diagnostic);
    expect(normal.commissionMinor).toBe(70_000n);
  });

  it('applies diagnostic 3,000 KZT cap', () => {
    const result = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 100_000n * 100n }, diagnostic);
    expect(result.commissionMinor).toBe(300_000n);
  });

  it('applies medical analysis 6% with floor and cap', () => {
    const floor = calculatePartnerEconomics({ ...base, vertical: 'MEDICAL_ANALYSIS', grossMinor: 1_000n * 100n }, analysis);
    const normal = calculatePartnerEconomics({ ...base, vertical: 'MEDICAL_ANALYSIS', grossMinor: 10_000n * 100n }, analysis);
    const cap = calculatePartnerEconomics({ ...base, vertical: 'MEDICAL_ANALYSIS', grossMinor: 100_000n * 100n }, analysis);
    expect(floor.commissionMinor).toBe(15_000n);
    expect(normal.commissionMinor).toBe(60_000n);
    expect(cap.commissionMinor).toBe(250_000n);
  });

  it('selects dental-lab volume tiers from monthly GMV', () => {
    const low = calculatePartnerEconomics({ ...base, vertical: 'DENTAL_LAB', grossMinor: 100_000n * 100n, monthlyGmvMinor: 500_000n * 100n }, dentalLab);
    const high = calculatePartnerEconomics({ ...base, vertical: 'DENTAL_LAB', grossMinor: 100_000n * 100n, monthlyGmvMinor: 40_000_000n * 100n }, dentalLab);
    expect(low.commissionMinor).toBe(100_000n * 100n / 10n);
    expect(high.commissionMinor).toBe(100_000n * 100n / 20n);
  });

  it('never reports a healthy contribution margin when operating costs exceed commission', () => {
    const result = calculatePartnerEconomics({
      ...base,
      vertical: 'DIAGNOSTIC_3D',
      grossMinor: 10_000n * 100n,
      paymentCostMinor: 100_000n,
      aiCostMinor: 50_000n,
    }, diagnostic);
    expect(result.status).toBe('LOSS');
    expect(result.contributionMarginMinor).toBeLessThan(0n);
  });

  it('preserves the exact rule snapshot used for the calculation', () => {
    const result = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 20_000n * 100n }, diagnostic);
    expect(result.rule.version).toBe(1);
    expect(result.rule.minFeeMinor).toBe(50_000n);
    expect(result.rule.maxFeeMinor).toBe(300_000n);
  });
});
