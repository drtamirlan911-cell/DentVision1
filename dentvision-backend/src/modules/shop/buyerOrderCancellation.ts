import prisma from '../../lib/prisma.js';
import { canTransitionOrder } from '../../lib/orderStatus.js';

type OrderMeta = Record<string, unknown>;

function asRecord(value: unknown): OrderMeta {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as OrderMeta
    : {};
}

export function isBuyerCancellableShopOrder(order: {
  status: string;
  paymentStatus: string;
  meta: unknown;
}): boolean {
  const meta = asRecord(order.meta);
  return order.status === 'pending'
    && order.paymentStatus === 'pending'
    && canTransitionOrder(order.status, 'cancelled')
    && String(meta.payment_method || '').trim().toLowerCase() === 'cash'
    && !meta.paymentId
    && !meta.paymentExternalId
    && !meta.paymentOutcome;
}

export async function cancelBuyerShopOrder(orderId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        meta: true,
        items: true,
        cancelReason: true,
      },
    });

    if (!order) return { kind: 'not_found' as const };

    // Retry path: never restore stock twice; it also allows a failed ledger
    // reversal to be retried after the order has already been cancelled.
    if (order.status === 'cancelled' && order.cancelReason === 'buyer_requested') {
      return { kind: 'already_cancelled' as const, order };
    }

    if (!isBuyerCancellableShopOrder(order)) {
      return { kind: 'not_cancellable' as const, order };
    }

    // A cash-labelled order must still have no online payment intent. Unknown
    // or provider-backed outcomes require a separate void/refund workflow.
    const paymentIntent = await tx.payment.findFirst({
      where: {
        refType: { in: ['order', 'shop_order'] },
        refId: orderId,
        status: { in: ['pending', 'paid'] },
      },
      select: { id: true },
    });
    if (paymentIntent) return { kind: 'not_cancellable' as const, order };

    const now = new Date();
    const meta = asRecord(order.meta);
    const cancellation = asRecord(meta.cancellation);
    const claimed = await tx.order.updateMany({
      where: { id: orderId, userId, status: 'pending', paymentStatus: 'pending' },
      data: {
        status: 'cancelled',
        paymentStatus: 'cancelled',
        cancelledAt: now,
        cancelReason: 'buyer_requested',
        meta: {
          ...meta,
          cancellation: {
            ...cancellation,
            requestedBy: 'buyer',
            requestedAt: now.toISOString(),
            refundPending: true,
          },
        },
      },
    });

    // Payment settlement, supplier acceptance and buyer cancellation all use
    // compare-and-set status transitions. Only one can claim the pending state.
    if (claimed.count === 0) return { kind: 'conflict' as const };

    const lines = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
    const quantities = new Map<string, number>();
    for (const line of lines) {
      const productId = String(line.product_id || line.productId || '').trim();
      const quantity = Number(line.quantity ?? line.qty);
      if (!productId || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error('SHOP_ORDER_INVALID_LINE');
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    if (quantities.size === 0) throw new Error('SHOP_ORDER_EMPTY_LINES');

    for (const [productId, quantity] of quantities) {
      const restored = await tx.product.updateMany({
        where: { id: productId },
        data: { stock: { increment: quantity } },
      });
      if (restored.count !== 1) throw new Error('SHOP_ORDER_PRODUCT_MISSING');
    }

    const cancelledOrder = await tx.order.findUnique({ where: { id: orderId } });
    if (!cancelledOrder) throw new Error('SHOP_ORDER_CANCELLED_ROW_MISSING');
    return { kind: 'cancelled' as const, order: cancelledOrder };
  });
}
