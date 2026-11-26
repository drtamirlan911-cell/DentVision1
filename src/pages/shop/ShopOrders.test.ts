import { describe, expect, it } from 'vitest';
import { canShowBuyerOrderCancellation } from './ShopOrders';

describe('buyer Shop order cancellation visibility', () => {
  it('shows cancellation only for unpaid cash orders without online payment evidence', () => {
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'cash' },
    })).toBe(true);
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'CASH' },
    })).toBe(true);
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'cash', paymentId: 'payment-1' },
    })).toBe(false);
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'cash', paymentExternalId: 'provider-1' },
    })).toBe(false);
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'cash', paymentOutcome: 'unknown' },
    })).toBe(false);
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'kaspi' },
    })).toBe(false);
  });

  it('does not expose cancellation after processing or settlement begins', () => {
    for (const status of ['awaiting_payment', 'payment_processing', 'payment_unknown', 'confirmed', 'packing', 'paid', 'shipped', 'delivered']) {
      expect(canShowBuyerOrderCancellation({
        status,
        meta: { payment_method: 'cash' },
      })).toBe(false);
    }
  });

  it('keeps the retry action visible only for a cancelled order with a pending cashback reversal', () => {
    expect(canShowBuyerOrderCancellation({
      status: 'cancelled',
      meta: { cancellation: { refundPending: true } },
    })).toBe(true);
    expect(canShowBuyerOrderCancellation({
      status: 'cancelled',
      meta: { cancellation: { refundPending: false } },
    })).toBe(false);
    expect(canShowBuyerOrderCancellation({
      status: 'pending',
      meta: { payment_method: 'cash', cancellation: { refundPending: true } },
    })).toBe(true);
  });
});
