import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * mark-paid/cashier-collect used to check `referral.paid` (a plain read),
 * then unconditionally `referral.update`. Two concurrent requests for the
 * same referral could both pass the read and both call `recordSale`,
 * double-recording the ledger entry. `claimReferralPaid` replaces that with
 * a conditional `updateMany({where:{id, paid:false}})` — the same atomic
 * pattern already used for payment settlement (`claimPaymentForSettlement`).
 */

const { referralUpdateMany } = vi.hoisted(() => ({ referralUpdateMany: vi.fn() }));

vi.mock('../../lib/prisma.js', () => ({
  default: { referral: { updateMany: referralUpdateMany } },
}));

import { claimReferralPaid } from './diagnostics.routes.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('claimReferralPaid', () => {
  it('wins when the referral is not already paid', async () => {
    referralUpdateMany.mockResolvedValue({ count: 1 });
    const won = await claimReferralPaid('ref-1', { paid: true });
    expect(won).toBe(true);
    expect(referralUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ref-1', paid: false },
      data: { paid: true },
    });
  });

  it('loses when the referral was already paid (by itself or a racer)', async () => {
    referralUpdateMany.mockResolvedValue({ count: 0 });
    const won = await claimReferralPaid('ref-1', { paid: true });
    expect(won).toBe(false);
  });

  it('under true concurrency, only one of two racing claims wins', async () => {
    let paid = false;
    referralUpdateMany.mockImplementation(async () => {
      if (paid) return { count: 0 };
      paid = true;
      return { count: 1 };
    });

    const [first, second] = await Promise.all([
      claimReferralPaid('ref-race', { paid: true }),
      claimReferralPaid('ref-race', { paid: true }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
  });
});
