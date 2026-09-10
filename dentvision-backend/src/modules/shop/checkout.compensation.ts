import prisma from '../../lib/prisma.js';
import { refundDentCashSpend } from '../dentcash/spend.service.js';

export type CheckoutCompensationResult = {
  compensated: boolean;
  stockRestored: number;
  dentCashRefundedMinor: bigint;
};

export async function compensateDeterministicCheckoutFailure(orderId: string, reason: string): Promise<CheckoutCompensationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, meta: true, items: true } });
    if (!current) return { compensated: false, stockRestored: 0, needsDentCashRefund: false };
    const meta = current.meta && typeof current.meta === 'object' && !Array.isArray(current.meta) ? (current.meta as Record<string, unknown>) : {};
    const compensation = meta.compensation && typeof meta.compensation === 'object' && !Array.isArray(meta.compensation) ? (meta.compensation as Record<string, unknown>) : {};
    const stockAlreadyRestored = compensation.stockRestored === true;
    if (!['pending', 'awaiting_payment', 'payment_processing', 'payment_failed', 'cancelled'].includes(current.status)) return { compensated: false, stockRestored: 0, needsDentCashRefund: false };
    if (current.status === 'cancelled' && !stockAlreadyRestored) return { compensated: false, stockRestored: 0, needsDentCashRefund: false };
    let stockRestored = 0;
    if (!stockAlreadyRestored) {
      const claimed = await tx.order.updateMany({ where: { id: orderId, status: current.status }, data: { status: 'cancelled', meta: { ...meta, compensation: { ...compensation, status: 'restoring_stock', reason, claimedAt: new Date().toISOString() } } } });
      if (claimed.count === 0) return { compensated: false, stockRestored: 0, needsDentCashRefund: false };
      const items = Array.isArray(current.items) ? current.items : [];
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const productId = typeof item.product_id === 'string' ? item.product_id : '';
        const quantity = Number(item.quantity);
        if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue;
        await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
        stockRestored += quantity;
      }
      const latest = await tx.order.findUnique({ where: { id: orderId }, select: { meta: true } });
      const latestMeta = latest?.meta && typeof latest.meta === 'object' && !Array.isArray(latest.meta) ? (latest.meta as Record<string, unknown>) : meta;
      await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled', meta: { ...latestMeta, compensation: { ...compensation, status: 'stock_restored', reason, stockRestored: true, stockRestoredAt: new Date().toISOString() } } } });
    }
    return { compensated: true, stockRestored, needsDentCashRefund: true };
  });
  if (!result.compensated) return { compensated: false, stockRestored: 0, dentCashRefundedMinor: 0n };
  const refund = result.needsDentCashRefund ? await refundDentCashSpend({ refType: 'order', refId: orderId, reason }) : { refunded: 0n };
  return { compensated: true, stockRestored: result.stockRestored, dentCashRefundedMinor: refund.refunded };
}
