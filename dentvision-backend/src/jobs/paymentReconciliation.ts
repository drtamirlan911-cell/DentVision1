import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';
import { providers } from '../modules/payments/kaspi.provider.js';
import { settlePaidPayment, claimPaymentForSettlement } from '../modules/payments/payments.routes.js';
import { compensateDeterministicCheckoutFailure } from '../modules/shop/checkout.compensation.js';

export type PaymentReconciliationResult = {
  inspected: number;
  paid: number;
  failed: number;
  pending: number;
  skipped: number;
  errors: number;
};

const BATCH_SIZE = 100;
const MIN_UNKNOWN_AGE_MS = 30_000;

/**
 * Durable reconciliation for checkout payments whose provider outcome was
 * uncertain. The payment row is persisted before the provider call, so a
 * process crash or network timeout does not lose the reference needed here.
 *
 * Only orders explicitly in `payment_unknown` are queried. A normal
 * `awaiting_payment` order is therefore left to the ordinary callback/confirm
 * flow. Provider state is authoritative: only `paid`, `failed`, or `expired`
 * cause a state transition.
 */
export async function reconcileUnknownCheckoutPayments(
  now = Date.now(),
): Promise<PaymentReconciliationResult> {
  const result: PaymentReconciliationResult = {
    inspected: 0,
    paid: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    errors: 0,
  };

  const payments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      refType: 'order',
      externalId: { not: null },
    },
    orderBy: { updatedAt: 'asc' },
    take: BATCH_SIZE,
  });

  for (const payment of payments) {
    const ageMs = now - payment.updatedAt.getTime();
    if (ageMs < MIN_UNKNOWN_AGE_MS) {
      result.skipped += 1;
      continue;
    }

    if (!payment.refId || !payment.externalId) {
      result.skipped += 1;
      continue;
    }

    const order = await prisma.order.findUnique({
      where: { id: payment.refId },
      select: { id: true, status: true },
    });
    if (!order || order.status !== 'payment_unknown') {
      result.skipped += 1;
      continue;
    }

    result.inspected += 1;

    try {
      const provider = providers[payment.provider] || providers.kaspi_qr;
      const state = await provider.getPaymentStatus(payment.externalId);

      if (state === 'pending') {
        result.pending += 1;
        continue;
      }

      if (state === 'paid') {
        const settled = await prisma.$transaction(async (tx) => {
          const claimed = await claimPaymentForSettlement(tx, payment.id);
          if (!claimed) return false;
          return settlePaidPayment(payment, tx);
        });
        if (settled) result.paid += 1;
        else result.skipped += 1;
        continue;
      }

      // Provider has conclusively rejected/expired the payment. Move the
      // order out of `payment_unknown` first so compensation can safely claim
      // it; then restore stock and reverse any DentCash spend exactly once.
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { id: payment.id, status: 'pending' },
          data: {
            status: 'failed',
            meta: {
              ...((payment.meta && typeof payment.meta === 'object' ? payment.meta : {}) as Record<string, unknown>),
              state: 'confirmed_failure',
              reconciledAt: new Date().toISOString(),
              providerState: state,
            },
          },
        });
        await tx.order.updateMany({
          where: { id: order.id, status: 'payment_unknown' },
          data: {
            status: 'payment_failed',
            meta: {
              ...(await tx.order.findUnique({ where: { id: order.id }, select: { meta: true } })).meta as object || {},
              paymentOutcome: state,
              paymentReconciledAt: new Date().toISOString(),
            },
          },
        });
      });
      await compensateDeterministicCheckoutFailure(order.id, `payment_reconciled_${state}`);
      result.failed += 1;
    } catch (error) {
      result.errors += 1;
      console.error('[PaymentReconciliation] payment check failed', {
        paymentId: payment.id,
        orderId: payment.refId,
        error,
      });
    }
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Starts a leader-locked reconciliation loop. Safe to call more than once. */
export function startPaymentReconciliationInterval(ms = 5 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const result = await withJobLock('payment_reconciliation', reconcileUnknownCheckoutPayments);
      if (result && (result.inspected || result.paid || result.failed || result.errors)) {
        console.warn('[PaymentReconciliation]', result);
      }
    } catch (error) {
      console.error('[PaymentReconciliation] tick failed', error);
    }
  };
  void tick();
  timer = setInterval(() => void tick(), ms);
  console.warn(`[PaymentReconciliation] interval started (every ${ms / 60000} min)`);
}
