import { describe, expect, it } from 'vitest';
import { calculateReferralCommissionMinor, referralVertical } from './referral-economics.service.js';
import { PARTNER_VERTICALS, type PartnerEconomicsRule } from './partner-economics.service.js';

const diagnosticsRule: PartnerEconomicsRule = {
  vertical: PARTNER_VERTICALS.DIAGNOSTIC_3D,
  version: 1,
  effectiveFrom: '2026-09-11T00:00:00.000Z',
  percentBps: 700,
  minFeeMinor: 50_000n,
  maxFeeMinor: 300_000n,
  subscriptionMinor: 4_990_000n,
};

const analysisRule: PartnerEconomicsRule = {
  vertical: PARTNER_VERTICALS.MEDICAL_ANALYSIS,
  version: 1,
  effectiveFrom: '2026-09-11T00:00:00.000Z',
  percentBps: 600,
  minFeeMinor: 15_000n,
  maxFeeMinor: 250_000n,
  subscriptionMinor: 1_990_000n,
};

describe('referralVertical', () => {
  it('routes center referrals to 3D diagnostics', () => {
    expect(referralVertical({ centerId: 'center-1', labId: null })).toBe(PARTNER_VERTICALS.DIAGNOSTIC_3D);
  });

  it('routes lab referrals to medical analysis', () => {
    expect(referralVertical({ centerId: null, labId: 'lab-1' })).toBe(PARTNER_VERTICALS.MEDICAL_ANALYSIS);
  });

  it('returns null for an unowned referral', () => {
    expect(referralVertical({ centerId: null, labId: null })).toBeNull();
  });
});

describe('calculateReferralCommissionMinor', () => {
  it('uses the canonical 7% diagnostic rule with its minimum', () => {
    expect(calculateReferralCommissionMinor(PARTNER_VERTICALS.DIAGNOSTIC_3D, 1_000_000n, diagnosticsRule)).toBe(70_000n);
    expect(calculateReferralCommissionMinor(PARTNER_VERTICALS.DIAGNOSTIC_3D, 1_000n, diagnosticsRule)).toBe(50_000n);
  });

  it('uses the canonical 6% medical-analysis rule with its cap', () => {
    expect(calculateReferralCommissionMinor(PARTNER_VERTICALS.MEDICAL_ANALYSIS, 1_000_000n, analysisRule)).toBe(60_000n);
    expect(calculateReferralCommissionMinor(PARTNER_VERTICALS.MEDICAL_ANALYSIS, 10_000_000n, analysisRule)).toBe(250_000n);
  });
});
