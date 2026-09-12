import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const referral = {
    id: 'ref-1',
    centerId: 'center-1',
    labId: null,
    cost: 10_000,
  };
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const findUnique = vi.fn(async () => referral);
  const rule = {
    vertical: 'DIAGNOSTIC_3D',
    version: 1,
    effectiveFrom: '2026-09-11T00:00:00.000Z',
    percentBps: 700,
    minFeeMinor: 50_000n,
    maxFeeMinor: 300_000n,
    subscriptionMinor: 4_990_000n,
  };
  const getPartnerEconomicsRule = vi.fn(async () => rule);
  const calculatePartnerEconomics = vi.fn(({ grossMinor }: any) => ({ commissionMinor: (grossMinor * 700n) / 10_000n }));
  return { referral, updateMany, findUnique, rule, getPartnerEconomicsRule, calculatePartnerEconomics };
});

vi.mock('../../lib/prisma.js', () => ({
  default: {
    referral: {
      findUnique: state.findUnique,
      updateMany: state.updateMany,
    },
  },
}));

vi.mock('./partner-economics.service.js', () => ({
  PARTNER_VERTICALS: { DIAGNOSTIC_3D: 'DIAGNOSTIC_3D', MEDICAL_ANALYSIS: 'MEDICAL_ANALYSIS' },
  getPartnerEconomicsRule: state.getPartnerEconomicsRule,
  calculatePartnerEconomics: state.calculatePartnerEconomics,
}));

const { applyCanonicalReferralEconomics } = await import('./referral-economics.service.js');

describe('canonical referral economics reconciliation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reconciles accepted referrals to the canonical commission', async () => {
    const fee = await applyCanonicalReferralEconomics('ref-1');

    expect(fee?.toString()).toBe('7000');
    expect(state.updateMany).toHaveBeenCalledWith({
      where: { id: 'ref-1', status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
      data: { platformFee: expect.anything() },
    });
  });

  it('does not mutate a referral after the async event becomes stale', async () => {
    state.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(applyCanonicalReferralEconomics('ref-1')).resolves.toBeNull();
    expect(state.updateMany).toHaveBeenCalledTimes(1);
  });
});
