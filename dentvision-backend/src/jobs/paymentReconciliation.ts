import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';
import { providers } from '../modules/payments/kaspi.provider.js';
import { settlePaidPayment, claimPaymentForSettlement } from '../modules/payments/payments.routes.js';
import { compensateDeterministicCheckoutFailure } from '../modules/shop/checkout.compensation.js';
import { releasePartnerBranchSubscriptionInvoicePayment } from '../modules/billing/partnerBranchBilling.service.js';
import { safeErrorKind } from '../lib/safeError.js';

export type PartnerInvoiceReconciliationResult = {
  inspected: number;
  paid: number;
  released: number;
  pending: number;
  skipped: number;
  errors: number;
};

export type PaymentReconciliationResult = {
  inspected: number;
  paid: number;
  failed: number;
  pending: number;
  skipped: number;
  errors: number;
  partnerInvoices: PartnerInvoiceReconciliationResult;
};

const BATCH_SIZE = 100;
const MIN_UNKNOWN_AGE_MS = 30_000;
const PARTNER_INVOICE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const PARTNER_PROVIDER_RECHECK_MS = 5 * 60 * 1000;

/** Durable reconciliation for checkout payments whose provider outcome was uncertain. */
export async function reconcileUnknownCheckoutPayments(now = Date.now()): Promise<PaymentReconciliationResult> {
  const result: PaymentReconciliationResult = { inspected: 0, paid: 0, failed: 0, pending: 0, skipped: 0, errors: 0, partnerInvoices: { inspected: 0, paid: 0, released: 0, pending: 0, skipped: 0, errors: 0 } };

  const payments = await prisma.payment.findMany({
    where: { status: 'pending', refType: 'order', externalId: { not: null } },
    orderBy: { updatedAt: 'asc' },
    take: BATCH_SIZE,
  });

  for (const payment of payments) {
    if (now - payment.updatedAt.getTime() < MIN_UNKNOWN_AGE_MS || !payment.refId || !payment.externalId) {
      result.skipped += 1;
      continue;
    }

    const order = await prisma.order.findUnique({ where: { id: payment.refId }, select: { id: true, status: true } });
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
          const didSettle = await settlePaidPayment(payment, tx);
          if (!didSettle) throw new Error('PAYMENT_SETTLEMENT_NOT_APPLIED');
          return true;
        });
        if (settled) result.paid += 1;
        continue;
      }

      // A failed/expired provider status is conclusive. The conditional payment
      // update is the race guard: if a callback won the same payment meanwhile,
      // do not mutate the order or compensate stock/DentCash.
      const markedFailed = await prisma.$transaction(async (tx) => {
        const paymentUpdate = await tx.payment.updateMany({
          where: { id: payment.id, status: 'pending' },
          data: {
            status: 'failed',
            meta: {
              ...((payment.meta && typeof payment.meta === 'object' && !Array.isArray(payment.meta))
                ? (payment.meta as Record<string, unknown>)
                : {}),
              state: 'confirmed_failure',
              reconciledAt: new Date().toISOString(),
              providerState: state,
            },
          },
        });
        if (paymentUpdate.count !== 1) return false;

        const current = await tx.order.findUnique({ where: { id: order.id }, select: { meta: true } });
        const currentMeta = current?.meta && typeof current.meta === 'object' && !Array.isArray(current.meta)
          ? (current.meta as Record<string, unknown>)
          : {};
        const orderUpdate = await tx.order.updateMany({
          where: { id: order.id, status: 'payment_unknown' },
          data: {
            status: 'payment_failed',
            meta: { ...currentMeta, paymentOutcome: state, paymentReconciledAt: new Date().toISOString() },
          },
        });
        return orderUpdate.count === 1;
      });

      if (!markedFailed) {
        result.skipped += 1;
        continue;
      }
      await compensateDeterministicCheckoutFailure(order.id, `payment_reconciled_${state}`);
      result.failed += 1;
    } catch (error) {
      result.errors += 1;
      console.error('[PaymentReconciliation] payment check failed', { paymentId: payment.id, orderId: payment.refId, error: safeErrorKind(error) });
    }
  }

  const partnerInvoices = await reconcilePartnerBranchSubscriptionPayments(now);
  result.partnerInvoices = partnerInvoices;
  result.errors += partnerInvoices.errors;
  return result;
}

/**
 * Reconcile abandoned partner branch subscription payments after their 24-hour
 * payment window. Only provider-confirmed paid/failed/expired states may change
 * the invoice. A provider-pending response keeps the invoice reservation and
 * delays the next provider check, avoiding release of a payment that could
 * still settle later.
 */
export async function reconcilePartnerBranchSubscriptionPayments(
  now = Date.now(),
): Promise<PartnerInvoiceReconciliationResult> {
  const result: PartnerInvoiceReconciliationResult = {
    inspected: 0, paid: 0, released: 0, pending: 0, skipped: 0, errors: 0,
  };
  const expiryBoundary = new Date(now - PARTNER_INVOICE_EXPIRY_MS);
  const recheckBoundary = new Date(now - PARTNER_PROVIDER_RECHECK_MS);
  const payments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      refType: 'partner_branch_subscription_invoice',
      externalId: { not: null },
      createdAt: { lte: expiryBoundary },
      updatedAt: { lte: recheckBoundary },
    },
    orderBy: { updatedAt: 'asc' },
    take: BATCH_SIZE,
  });

  for (const payment of payments) {
    // Defend against a mock, adapter or future query refactor returning another product.
    if (payment.refType !== 'partner_branch_subscription_invoice' || !payment.refId || !payment.externalId) continue;
    result.inspected += 1;
    try {
      const provider = providers[payment.provider] || providers.kaspi_qr;
      const state = await provider.getPaymentStatus(payment.externalId);

      if (state === 'pending') {
        const touched = await prisma.payment.updateMany({
          where: { id: payment.id, status: 'pending', updatedAt: payment.updatedAt },
          data: { updatedAt: new Date(now) },
        });
        if (touched.count === 1) result.pending += 1;
        else result.skipped += 1;
        continue;
      }

      if (state === 'paid') {
        const settled = await prisma.$transaction(async (tx) => {
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: 'pending', updatedAt: payment.updatedAt },
            data: { status: 'paid', updatedAt: new Date(now) },
          });
          if (claimed.count !== 1) return false;
          const didSettle = await settlePaidPayment(payment, tx);
          if (!didSettle) throw new Error('PARTNER_INVOICE_SETTLEMENT_NOT_APPLIED');
          return true;
        });
        if (settled) result.paid += 1;
        else result.skipped += 1;
        continue;
      }

      const released = await prisma.$transaction(async (tx) => {
        const changed = await tx.payment.updateMany({
          where: { id: payment.id, status: 'pending', updatedAt: payment.updatedAt },
          data: { status: state, updatedAt: new Date(now) },
        });
        if (changed.count !== 1) return false;
        const holdReleased = await releasePartnerBranchSubscriptionInvoicePayment({
          invoiceId: payment.refId!,
          paymentId: payment.id,
        }, tx);
        if (!holdReleased) throw new Error('PARTNER_INVOICE_HOLD_NOT_RELEASED');
        return true;
      });
      if (released) result.released += 1;
      else result.skipped += 1;
    } catch (error) {
      result.errors += 1;
      console.error('[PaymentReconciliation] partner invoice check failed', {
        paymentId: payment.id,
        error: safeErrorKind(error),
      });
    }
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPaymentReconciliationInterval(ms = 5 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const result = await withJobLock('payment_reconciliation', reconcileUnknownCheckoutPayments);
      if (result && (result.inspected || result.paid || result.failed || result.errors || result.partnerInvoices.inspected || result.partnerInvoices.errors)) console.warn('[PaymentReconciliation]', result);
    } catch (error) {
      console.error('[PaymentReconciliation] tick failed', safeErrorKind(error));
    }
  };
  void tick();
  timer = setInterval(() => void tick(), ms);
  console.warn(`[PaymentReconciliation] interval started (every ${ms / 60000} min)`);
}
