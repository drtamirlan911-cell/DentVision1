import { describe, expect, it } from 'vitest';
import { calculatePartnerEconomics, canonicalPartnerEconomicsRules, PARTNER_VERTICALS } from './partner-economics.service.js';

describe('partner economics vertical matrix', () => {
  it('has a canonical rule for every operational partner vertical', () => {
    const rules = canonicalPartnerEconomicsRules();
    expect(rules.map((r) => r.vertical).sort()).toEqual([
      PARTNER_VERTICALS.DENTAL_LAB,
      PARTNER_VERTICALS.DIAGNOSTIC_3D,
      PARTNER_VERTICALS.MEDICAL_ANALYSIS,
    ].sort());
    for (const rule of rules) {
      expect(rule.version).toBeGreaterThan(0);
      expect(rule.percentBps).toBeGreaterThan(0);
      expect(rule.minFeeMinor).toBeGreaterThanOrEqual(0n);
    }
  });

  it('keeps gross = partner payout + platform commission', () => {
    for (const vertical of Object.values(PARTNER_VERTICALS)) {
      const rule = canonicalPartnerEconomicsRules().find((r) => r.vertical === vertical)!;
      const row = calculatePartnerEconomics({ vertical, partnerId: 'partner-1', grossMinor: 1_000_000n }, rule);
      expect(row.partnerRevenueMinor + row.commissionMinor).toBe(row.grossMinor);
    }
  });

  it('records cost impact only in contribution margin, not partner payout', () => {
    const rule = canonicalPartnerEconomicsRules().find((r) => r.vertical === PARTNER_VERTICALS.MEDICAL_ANALYSIS)!;
    const row = calculatePartnerEconomics({
      vertical: PARTNER_VERTICALS.MEDICAL_ANALYSIS,
      partnerId: 'partner-1',
      grossMinor: 1_000_000n,
      paymentCostMinor: 10_000n,
      aiCostMinor: 20_000n,
    }, rule);
    expect(row.partnerRevenueMinor + row.commissionMinor).toBe(1_000_000n);
    expect(row.contributionMarginMinor).toBe(row.commissionMinor - 30_000n);
  });

  it('preserves historical rule version in the calculated result', () => {
    const rule = canonicalPartnerEconomicsRules().find((r) => r.vertical === PARTNER_VERTICALS.DENTAL_LAB)!;
    const historical = { ...rule, version: 7, percentBps: 500, volumeTiers: undefined };
    const row = calculatePartnerEconomics({
      vertical: PARTNER_VERTICALS.DENTAL_LAB,
      partnerId: 'partner-1',
      grossMinor: 2_000_000n,
      monthlyGmvMinor: 2_000_000n,
    }, historical);
    expect(row.rule.version).toBe(7);
    expect(row.rule.percentBps).toBe(500);
  });
});
