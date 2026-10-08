import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * settlePaidPayment used to call recordSale/activateClinicSubscriptionFromPayment/
 * markSettlementPaid without ever passing along the `tx` the caller's route handler
 * opened — each of those callees then wrote through the module-level `prisma`
 * singleton, so money could commit even when the outer transaction (the one
 * flipping payment.status to 'paid') later rolled back. These tests assert the
 * `db` argument given to settlePaidPayment is the *exact* object threaded into
 * every branch's callee — not the global prisma client, not a new default.
 */

const { recordSaleTx, recordPartnerEconomics, activateClinicSubscriptionFromPayment, isSaasPlanId, getPlanCatalog, accrueSaasCashback, markSettlementPaid, writeRevenue } =
  vi.hoisted(() => ({
    recordSaleTx: vi.fn(),
    recordPartnerEconomics: vi.fn(),
    activateClinicSubscriptionFromPayment: vi.fn(),
    isSaasPlanId: vi.fn(() => true),
  getPlanCatalog: vi.fn(() => [{ id: 'professional', amountMinor: '4990000' }, { id: 'enterprise', amountMinor: '14990000' }]),
    accrueSaasCashback: vi.fn(),
    markSettlementPaid: vi.fn(),
    writeRevenue: vi.fn(),
  }));

vi.mock('../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../finance/finance.service.js', () => ({ recordSaleTx }));
vi.mock('../finance/partner-economics.service.js', () => ({ recordPartnerEconomics }));
vi.mock('../finance/revenue.service.js', () => ({ writeRevenue }));
vi.mock('../billing/clinicSubscription.service.js', () => ({
  activateClinicSubscriptionFromPayment,
  isSaasPlanId,
  getPlanCatalog,
}));
vi.mock('../dentcash/cashback.engine.js', () => ({ accrueSaasCashback }));
vi.mock('../diagnostics/settlement.service.js', () => ({ markSettlementPaid }));

import { settlePaidPayment, claimPaymentForSettlement } from './payments.routes.js';

beforeEach(() => {
  vi.clearAllMocks();
  recordSaleTx.mockResolvedValue({ id: 'txn' });
  recordPartnerEconomics.mockResolvedValue({ id: 'economics-txn' });
  activateClinicSubscriptionFromPayment.mockResolvedValue({});
  accrueSaasCashback.mockResolvedValue(undefined);
  markSettlementPaid.mockResolvedValue(true);
  writeRevenue.mockResolvedValue({});
});

// A stand-in transaction client, deliberately a different object identity
// than anything settlePaidPayment could conjure up itself (e.g. the default
// parameter), so `toHaveBeenCalledWith(..., fakeTx)` proves the exact object
// was threaded through, not merely "some object".
const fakeTx = {
  __marker: 'fake-tx-client',
  $queryRawUnsafe: vi.fn(async (sql: string) => {
    if (sql.includes('FROM "medical_lab_orders"')) return [{ clinicId: 'clinic-1', labId: 'lab-1' }];
    if (sql.includes('FROM "medical_lab_order_tests"')) return [{ price: '12000' }, { price: '3000' }];
    return [];
  }),
} as any;

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
        amount: 4990000n,
        meta: { saasPlan: 'professional', months: 1 },
      },
      fakeTx,
    );
    expect(activateClinicSubscriptionFromPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 'clinic-1' }),
      fakeTx,
    );
    expect(writeRevenue).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'SaaS', amountMinor: 4990000n, refId: 'clinic-1' }),
      fakeTx,
    );
  });


  it('subscription branch: rejects a tampered amount before activation', async () => {
    await expect(settlePaidPayment(
      {
        id: 'pay-sub-bad',
        refType: 'subscription',
        refId: 'clinic-1',
        domain: null,
        sellerType: null,
        sellerId: null,
        amount: 4990001n,
        meta: { saasPlan: 'professional', months: 1 },
      },
      fakeTx,
    )).rejects.toThrow('Недопустимая сумма SaaS-подписки');
    expect(activateClinicSubscriptionFromPayment).not.toHaveBeenCalled();
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

  it('medical lab branch: derives the order amount and records canonical partner economics', async () => {
    await settlePaidPayment(
      { id: 'pay-med-1', refType: 'medical_lab_order', refId: 'lab-order-1', domain: 'medical', sellerType: null, sellerId: null, amount: 1_500_000n, meta: null },
      fakeTx,
    );
    expect(recordPartnerEconomics).toHaveBeenCalledWith({
      vertical: 'MEDICAL_ANALYSIS',
      partnerId: 'lab-1',
      grossMinor: 1_500_000n,
      operationId: 'lab-order-1',
    }, fakeTx);
  });

  it('accepted → paid → settled: two concurrent confirmations produce one settlement side effect', async () => {
    let status: 'accepted' | 'paid' = 'accepted';
    const db = {
      payment: {
        updateMany: vi.fn(async () => {
          if (status === 'paid') return { count: 0 };
          status = 'paid';
          return { count: 1 };
        }),
      },
      $queryRawUnsafe: fakeTx.$queryRawUnsafe,
    } as any;

    const payment = {
      id: 'pay-integrated-race',
      refType: 'medical_lab_order',
      refId: 'lab-order-race',
      domain: 'medical',
      sellerType: null,
      sellerId: null,
      amount: 1_500_000n,
      meta: null,
    };

    const settleOne = async () => {
      if (!(await claimPaymentForSettlement(db, payment.id))) return false;
      await settlePaidPayment(payment, db);
      return true;
    };

    const [first, second] = await Promise.all([settleOne(), settleOne()]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(recordPartnerEconomics).toHaveBeenCalledTimes(1);
    expect(recordPartnerEconomics).toHaveBeenCalledWith({
      vertical: 'MEDICAL_ANALYSIS',
      partnerId: 'lab-1',
      grossMinor: 1_500_000n,
      operationId: 'lab-order-race',
    }, db);
  });

  it('medical lab branch: rejects a payment amount that differs from the priced tests', async () => {
    await expect(settlePaidPayment(
      { id: 'pay-med-2', refType: 'medical_lab_order', refId: 'lab-order-2', domain: 'medical', sellerType: null, sellerId: null, amount: 1_400_000n, meta: null },
      fakeTx,
    )).rejects.toThrow('Сумма оплаты медицинского анализа не совпадает');
    expect(recordPartnerEconomics).not.toHaveBeenCalled();
  });
});


describe('Academy settlement source-of-truth contract', () => {
  it('derives course payment amount and seller identity from the canonical course', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/payments/payments.routes.ts'),
      'utf8',
    );
    const start = source.indexOf('async function settleEnrollmentPayment(');
    const end = source.indexOf('async function settleAcademyEventPayment(', start);
    const block = source.slice(start, end);
    expect(block).toContain('const expectedAmount = tengeToMinor(Number(course.price || 0));');
    expect(block).toContain("const sellerType = course.lecturerId ? 'LECTURER' : course.academyId ? 'ACADEMY' : null;");
    expect(block).toContain('const sellerId = course.lecturerId || course.academyId || null;');
    expect(block).not.toContain('payment.sellerId');
    expect(block).not.toContain('payment.sellerType');
  });
});

describe('Subscription payment creation boundary', () => {
  it('requires scoped billing access and exact tariff amount before creating a subscription payment', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/payments/payments.routes.ts'),
      'utf8',
    );
    const createStart = source.indexOf("paymentsRouter.post('/', authenticate");
    const refundStart = source.indexOf("paymentsRouter.post('/:id/refund", createStart);
    const block = source.slice(createStart, refundStart);
    expect(block).toContain("if (refType === 'subscription')");
    expect(block).toContain("assertClinicBillingAccess(req.user!.id, subscriptionClinicId)");
    expect(block).toContain("const expectedMinor = BigInt(plan.amountMinor) * BigInt(months)");
    expect(block).toContain("if (minor !== expectedMinor)");
  });
});

