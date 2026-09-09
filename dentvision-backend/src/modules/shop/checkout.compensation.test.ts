import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
  },
  transaction: vi.fn(),
  refundDentCashSpend: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

vi.mock('../dentcash/spend.service.js', () => ({
  refundDentCashSpend: mocks.refundDentCashSpend,
}));

import { compensateDeterministicCheckoutFailure } from './checkout.compensation.js';

const order = (overrides: Record<string, unknown> = {}) => ({
  status: 'awaiting_payment',
  meta: { paymentId: 'pay-1' },
  items: [
    { product_id: 'p-1', quantity: 2 },
    { product_id: 'p-2', quantity: 3 },
  ],
  ...overrides,
});

describe('compensateDeterministicCheckoutFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.order.update.mockResolvedValue({});
    mocks.tx.product.update.mockResolvedValue({});
    mocks.refundDentCashSpend.mockResolvedValue({ refunded: 1200n });
  });

  it('claims the order, restores each line exactly once, records the marker, and refunds DentCash', async () => {
    mocks.tx.order.findUnique
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce({ meta: { paymentId: 'pay-1' } });

    const result = await compensateDeterministicCheckoutFailure('order-1', 'kaspi_confirmed_failure');

    expect(result).toEqual({ compensated: true, stockRestored: 5, dentCashRefundedMinor: 1200n });
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1', status: 'awaiting_payment' },
    }));
    expect(mocks.tx.product.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'p-1' },
      data: { stock: { increment: 2 } },
    });
    expect(mocks.tx.product.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'p-2' },
      data: { stock: { increment: 3 } },
    });
    expect(mocks.tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'cancelled',
        meta: expect.objectContaining({
          compensation: expect.objectContaining({
            status: 'stock_restored',
            stockRestored: true,
            reason: 'kaspi_confirmed_failure',
          }),
        }),
      }),
    }));
    expect(mocks.refundDentCashSpend).toHaveBeenCalledOnce();
  });

  it('retries DentCash only when stock was already restored', async () => {
    mocks.tx.order.findUnique.mockResolvedValueOnce(order({
      status: 'cancelled',
      meta: {
        compensation: {
          status: 'stock_restored',
          stockRestored: true,
        },
      },
    }));

    const result = await compensateDeterministicCheckoutFailure('order-1', 'retry_refund');

    expect(result).toEqual({ compensated: true, stockRestored: 0, dentCashRefundedMinor: 1200n });
    expect(mocks.tx.product.update).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.refundDentCashSpend).toHaveBeenCalledWith({
      refType: 'order',
      refId: 'order-1',
      reason: 'retry_refund',
    });
  });

  it('refuses paid and unknown outcomes instead of rolling them back', async () => {
    for (const status of ['paid', 'payment_unknown']) {
      mocks.tx.order.findUnique.mockResolvedValueOnce(order({ status }));

      const result = await compensateDeterministicCheckoutFailure('order-1', 'must_not_compensate');

      expect(result).toEqual({ compensated: false, stockRestored: 0, dentCashRefundedMinor: 0n });
    }

    expect(mocks.tx.product.update).not.toHaveBeenCalled();
    expect(mocks.refundDentCashSpend).not.toHaveBeenCalled();
  });
});
