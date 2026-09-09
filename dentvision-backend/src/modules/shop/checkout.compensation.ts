import prisma from '../../lib/prisma.js';
import { refundDentCashSpend } from '../dentcash/spend.service.js';

export type CheckoutCompensationResult = {
  compensated: boolean;
  stockRestored: number;
  dentCashRefundedMinor: bigint;
};

/**
 * Compensate a checkout only after the caller has established that the payment
 * outcome is deterministically failed. Unknown provider outcomes MUST NOT call
 * this function: the order needs reconciliation instead of blind rollback.
 *
 * The order state is claimed with a CAS-style update before stock is restored.
 * A second/concurrent compensation therefore becomes a no-op, preventing
 * double restoration. DentCash reversal is independently idempotent.
 */
export async function compensateDeterministicCheckoutFailure(orderId: string, reason: string): Promise<CheckoutCompensationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: {
        id: orderId,
        status: { in: ['pending', 'awaiting_payment', 'payment_processing'] },
      },
      data: {
        status: 'cancelled',
        meta: {
          compensation: {
            status: 'claimed',
            reason,
            claimedAt: new Date().toISOString(),
          },
        },
      },
    });

    if (claimed.count === 0) {
      return { compensated: false, stockRestored: 0 };
    }

    const order = await tx.order.findUnique({ where: { id: orderId }, select: { items: true } });
    const items = Array.isArray(order?.items) ? order.items : [];
    let stockRestored = 0;

    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const productId = typeof item.product_id === 'string' ? item.product_id : '';
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue;

      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
      });
      stockRestored += quantity;
    }

    return { compensated: true, stockRestored };
  });

  if (!result.compensated) {
    return { compensated: false, stockRestored: 0, dentCashRefundedMinor: 0n };
  }

  const refund = await refundDentCashSpend({
    refType: 'order',
    refId: orderId,
    reason,
  });

  return {
    compensated: true,
    stockRestored: result.stockRestored,
    dentCashRefundedMinor: refund.refunded,
  };
}
