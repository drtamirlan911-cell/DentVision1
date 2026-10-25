import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, findUnique, transaction, paymentUpdateMany, orderUpdateMany, providerStatus, compensate, claim, settle } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  paymentUpdateMany: vi.fn(),
  orderUpdateMany: vi.fn(),
  providerStatus: vi.fn(),
  compensate: vi.fn(),
  claim: vi.fn(),
  settle: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    payment: { findMany, updateMany: paymentUpdateMany },
    order: { findUnique, updateMany: orderUpdateMany },
    $transaction: transaction,
  },
}));
vi.mock('../modules/payments/kaspi.provider.js', () => ({ providers: { kaspi_qr: { getPaymentStatus: providerStatus } } }));
vi.mock('../modules/payments/payments.routes.js', () => ({ claimPaymentForSettlement: claim, settlePaidPayment: settle }));
vi.mock('../modules/shop/checkout.compensation.js', () => ({ compensateDeterministicCheckoutFailure: compensate }));
vi.mock('../lib/jobLock.js', () => ({ withJobLock: vi.fn((_, fn) => fn()) }));

import { reconcileUnknownCheckoutPayments } from './paymentReconciliation.js';

const basePayment = {
  id: 'pay-1', provider: 'kaspi_qr', externalId: 'ext-1', refType: 'order', refId: 'order-1',
  status: 'pending', amount: 10000n, meta: { state: 'unknown' },
  updatedAt: new Date('2026-09-10T10:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([basePayment]);
  findUnique.mockResolvedValue({ id: 'order-1', status: 'payment_unknown' });
  transaction.mockImplementation(async (fn: any) => fn({
    payment: { updateMany: paymentUpdateMany },
    order: { updateMany: orderUpdateMany, findUnique: vi.fn().mockResolvedValue({ meta: {} }) },
  }));
  paymentUpdateMany.mockResolvedValue({ count: 1 });
  orderUpdateMany.mockResolvedValue({ count: 1 });
  claim.mockResolvedValue(true);
  settle.mockResolvedValue(true);
  compensate.mockResolvedValue({ compensated: true, stockRestored: 1, dentCashRefundedMinor: 0n });
});

describe('payment reconciliation', () => {
  const now = new Date('2026-09-10T10:05:00.000Z').getTime();

  it('settles provider-confirmed paid payment through the existing atomic settlement path', async () => {
    providerStatus.mockResolvedValue('paid');
    const result = await reconcileUnknownCheckoutPayments(now);
    expect(result).toMatchObject({ inspected: 1, paid: 1, failed: 0 });
    expect(claim).toHaveBeenCalledWith(expect.anything(), 'pay-1');
    expect(settle).toHaveBeenCalledWith(basePayment, expect.anything());
    expect(compensate).not.toHaveBeenCalled();
  });

  it('converts confirmed provider failure to payment_failed and compensates the checkout', async () => {
    providerStatus.mockResolvedValue('failed');
    const result = await reconcileUnknownCheckoutPayments(now);
    expect(result).toMatchObject({ inspected: 1, failed: 1, paid: 0 });
    expect(paymentUpdateMany).toHaveBeenCalled();
    expect(orderUpdateMany).toHaveBeenCalled();
    expect(compensate).toHaveBeenCalledWith('order-1', 'payment_reconciled_failed');
  });

  it('treats provider expiry as deterministic failure', async () => {
    providerStatus.mockResolvedValue('expired');
    const result = await reconcileUnknownCheckoutPayments(now);
    expect(result.failed).toBe(1);
    expect(compensate).toHaveBeenCalledWith('order-1', 'payment_reconciled_expired');
  });

  it('leaves provider-pending payments untouched for the next sweep', async () => {
    providerStatus.mockResolvedValue('pending');
    const result = await reconcileUnknownCheckoutPayments(now);
    expect(result).toMatchObject({ inspected: 1, pending: 1, paid: 0, failed: 0 });
    expect(paymentUpdateMany).not.toHaveBeenCalled();
    expect(compensate).not.toHaveBeenCalled();
  });

  it('does not inspect a fresh unknown payment before the grace period', async () => {
    const result = await reconcileUnknownCheckoutPayments(basePayment.updatedAt.getTime() + 10_000);
    expect(result).toMatchObject({ inspected: 0, skipped: 1 });
    expect(providerStatus).not.toHaveBeenCalled();
  });

  it('ignores normal awaiting_payment orders', async () => {
    findUnique.mockResolvedValue({ id: 'order-1', status: 'awaiting_payment' });
    const result = await reconcileUnknownCheckoutPayments(now);
    expect(result).toMatchObject({ inspected: 0, skipped: 1 });
    expect(providerStatus).not.toHaveBeenCalled();
  });

  it('does not compensate when a concurrent callback already won the payment race', async () => {
    providerStatus.mockResolvedValue('failed');
    paymentUpdateMany.mockResolvedValue({ count: 0 });
    const result = await reconcileUnknownCheckoutPayments(now);
    expect(result).toMatchObject({ inspected: 1, skipped: 1, failed: 0 });
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(compensate).not.toHaveBeenCalled();
  });
});
