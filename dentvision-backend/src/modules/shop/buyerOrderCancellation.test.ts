import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: {
    order: { findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    payment: { findFirst: vi.fn() },
    product: { updateMany: vi.fn() },
  },
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: { $transaction: mocks.transaction },
}));

import { cancelBuyerShopOrder, isBuyerCancellableShopOrder } from './buyerOrderCancellation.js';

const eligibleOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  userId: 'buyer-1',
  status: 'pending',
  paymentStatus: 'pending',
  meta: { payment_method: 'cash' },
  items: [
    { product_id: 'product-1', quantity: 2 },
    { product_id: 'product-1', quantity: 1 },
    { product_id: 'product-2', quantity: 1 },
  ],
  cancelReason: null,
  ...overrides,
});

describe('buyer Shop order cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.payment.findFirst.mockResolvedValue(null);
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.product.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.order.findUnique.mockResolvedValue(eligibleOrder({
      status: 'cancelled',
      paymentStatus: 'cancelled',
      cancelReason: 'buyer_requested',
    }));
  });

  it('allows only an unpaid cash order before payment/provider processing', () => {
    expect(isBuyerCancellableShopOrder(eligibleOrder())).toBe(true);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ status: 'awaiting_payment' }))).toBe(false);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ status: 'payment_processing' }))).toBe(false);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ status: 'payment_unknown' }))).toBe(false);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ status: 'paid' }))).toBe(false);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ meta: { payment_method: 'kaspi' } }))).toBe(false);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ meta: { payment_method: 'cash', paymentId: 'pay-1' } }))).toBe(false);
    expect(isBuyerCancellableShopOrder(eligibleOrder({ paymentStatus: 'paid' }))).toBe(false);
  });

  it('restores each reserved product quantity once after an atomic buyer-owned state claim', async () => {
    mocks.tx.order.findFirst.mockResolvedValue(eligibleOrder());
    const result = await cancelBuyerShopOrder('order-1', 'buyer-1');
    expect(result.kind).toBe('cancelled');
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1', userId: 'buyer-1', status: 'pending', paymentStatus: 'pending' },
      data: expect.objectContaining({
        status: 'cancelled', paymentStatus: 'cancelled', cancelReason: 'buyer_requested',
      }),
    }));
    expect(mocks.tx.product.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'product-1' }, data: { stock: { increment: 3 } },
    });
    expect(mocks.tx.product.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'product-2' }, data: { stock: { increment: 1 } },
    });
    expect(mocks.tx.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ refId: 'order-1' }),
    }));
  });

  it('does not disclose or mutate an order owned by another buyer', async () => {
    mocks.tx.order.findFirst.mockResolvedValue(null);
    const result = await cancelBuyerShopOrder('order-1', 'different-buyer');
    expect(result.kind).toBe('not_found');
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('does not cancel when a payment intent exists even if metadata says cash', async () => {
    mocks.tx.order.findFirst.mockResolvedValue(eligibleOrder());
    mocks.tx.payment.findFirst.mockResolvedValue({ id: 'payment-intent-1' });
    const result = await cancelBuyerShopOrder('order-1', 'buyer-1');
    expect(result.kind).toBe('not_cancellable');
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('does not restore stock when a concurrent status transition wins first', async () => {
    mocks.tx.order.findFirst.mockResolvedValue(eligibleOrder());
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 });
    const result = await cancelBuyerShopOrder('order-1', 'buyer-1');
    expect(result.kind).toBe('conflict');
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('retries a previous buyer cancellation without restoring stock twice', async () => {
    mocks.tx.order.findFirst.mockResolvedValue(eligibleOrder({
      status: 'cancelled', paymentStatus: 'cancelled', cancelReason: 'buyer_requested',
      meta: { payment_method: 'cash', cancellation: { refundPending: true } },
    }));
    const result = await cancelBuyerShopOrder('order-1', 'buyer-1');
    expect(result.kind).toBe('already_cancelled');
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
  });
});
