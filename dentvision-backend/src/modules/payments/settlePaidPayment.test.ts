import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * settlePaidPayment used to call recordSale/activateClinicSubscriptionFromPayment/
 * markSettlementPaid without ever passing along the `tx` the caller's route handler
 * opened — each of those callees then wrote through the module-level `prisma`
 * singleton, so money could commit even when the outer transaction (the one
 * flipping payment.status to 'paid') later rolled back. These tests assert the
 * `db` argument given to settlePaidPayment is the *exact* object threaded into
 * every branch's callee — not the global prisma client, not a new default.
 */

const { recordSaleTx, activateClinicSubscriptionFromPayment, isSaasPlanId, accrueSaasCashback, markSettlementPaid } =
  vi.hoisted(() => ({
    recordSaleTx: vi.fn(),
    activateClinicSubscriptionFromPayment: vi.fn(),
    isSaasPlanId: vi.fn(() => true),
    accrueSaasCashback: vi.fn(),
    markSettlementPaid: vi.fn(),
  }));

vi.mock('../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../finance/finance.service.js', () => ({ recordSaleTx }));
vi.mock('../billing/clinicSubscription.service.js', () => ({
  activateClinicSubscriptionFromPayment,
  isSaasPlanId,
}));
vi.mock('../dentcash/cashback.engine.js', () => ({ accrueSaasCashback }));
vi.mock('../diagnostics/settlement.service.js', () => ({ markSettlementPaid }));

import { settlePaidPayment, claimPaymentForSettlement } from './payments.routes.js';

beforeEach(() => {
  vi.clearAllMocks();
  recordSaleTx.mockResolvedValue({ id: 'txn' });
  activateClinicSubscriptionFromPayment.mockResolvedValue({});
  accrueSaasCashback.mockResolvedValue(undefined);
  markSettlementPaid.mockResolvedValue(true);
});

// A stand-in transaction client, deliberately a different object identity
// than anything settlePaidPayment could conjure up itself (e.g. the default
// parameter), so `toHaveBeenCalledWith(..., fakeTx)` proves the exact object
// was threaded through, not merely "some object".
const fakeTx = { __marker: 'fake-tx-client' } as any;

describe('settlePaidPayment — db threading', () => {
  it('sale branch: passes db through to recordSaleTx', async () => {
    await settlePaidPayment(
      {
        id: 'pay-1',
        refType: 'sale',
        refId: null,
        domain: 'shop',
        sellerType: 'SUPPLIER',
        sellerId: 'sup-1',
        amount: 1000n,
        meta: null,
      },
      fakeTx,
    );
    expect(recordSaleTx).toHaveBeenCalledWith(expect.objectContaining({ refType: 'payment' }), fakeTx);
  });

  it('subscription branch: passes db through to activateClinicSubscriptionFromPayment', async () => {
    await settlePaidPayment(
      {
        id: 'pay-2',
        refType: 'subscription',
        refId: 'clinic-1',
        domain: null,
        sellerType: null,
        sellerId: null,
        amount: 49900n,
        meta: { saasPlan: 'professional', months: 1 },
      },
      fakeTx,
    );
    expect(activateClinicSubscriptionFromPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 'clinic-1' }),
      fakeTx,
    );
  });

  it('settlement branch: passes db through to markSettlementPaid', async () => {
    await settlePaidPayment(
      {
        id: 'pay-3',
        refType: 'settlement',
        refId: 'settlement-1',
        domain: null,
        sellerType: null,
        sellerId: null,
        amount: 5000n,
        meta: null,
      },
      fakeTx,
    );
    expect(markSettlementPaid).toHaveBeenCalledWith('settlement-1', 'pay-3', fakeTx);
  });

  it('defaults to the global prisma client when called without a db argument (standalone callers, e.g. shop.routes.ts DentCash-covered orders)', async () => {
    await settlePaidPayment({
      id: 'pay-4',
      refType: 'sale',
      refId: null,
      domain: 'shop',
      sellerType: 'SUPPLIER',
      sellerId: 'sup-1',
      amount: 1000n,
      meta: null,
    });
    const [, dbArg] = recordSaleTx.mock.calls[0];
    expect(dbArg).not.toBe(fakeTx);
    expect(dbArg).toBeDefined();
  });
});

describe('claimPaymentForSettlement — double-confirm race guard', () => {
  it('wins when the payment is not already paid', async () => {
    const db = { payment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } } as any;
    const won = await claimPaymentForSettlement(db, 'pay-1');
    expect(won).toBe(true);
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: { not: 'paid' } },
      data: { status: 'paid' },
    });
  });

  it('loses when the payment was already flipped to paid (by itself or a racer)', async () => {
    const db = { payment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } } as any;
    const won = await claimPaymentForSettlement(db, 'pay-1');
    expect(won).toBe(false);
  });

  it('under true concurrency, only one of two racing claims wins — simulated via a stateful fake DB', async () => {
    // Models the guarantee an atomic `UPDATE ... WHERE status != 'paid'` gives
    // in Postgres: whichever request's UPDATE statement the DB serializes
    // first flips the row and claims count=1; the second sees the row already
    // 'paid' and gets count=0. No lock is taken in application code — the
    // conditional WHERE clause is the entire guard.
    let status: 'pending' | 'paid' = 'pending';
    const db = {
      payment: {
        updateMany: vi.fn(async () => {
          if (status === 'paid') return { count: 0 };
          status = 'paid';
          return { count: 1 };
        }),
      },
    } as any;

    const [first, second] = await Promise.all([
      claimPaymentForSettlement(db, 'pay-race'),
      claimPaymentForSettlement(db, 'pay-race'),
    ]);

    const winners = [first, second].filter(Boolean);
    expect(winners).toHaveLength(1);
  });
});
