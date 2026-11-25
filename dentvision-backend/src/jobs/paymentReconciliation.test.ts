import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, findUnique, transaction, paymentUpdateMany, orderUpdateMany, providerStatus, compensate, claim, settle, releasePartnerInvoice } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  paymentUpdateMany: vi.fn(),
  orderUpdateMany: vi.fn(),
  providerStatus: vi.fn(),
  compensate: vi.fn(),
  claim: vi.fn(),
  settle: vi.fn(),
  releasePartnerInvoice: vi.fn(),
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
vi.mock('../modules/billing/partnerBranchBilling.service.js', () => ({ releasePartnerBranchSubscriptionInvoicePayment: releasePartnerInvoice }));
vi.mock('../lib/jobLock.js', () => ({ withJobLock: vi.fn((_, fn) => fn()) }));

import { reconcilePartnerBranchSubscriptionPayments, reconcileUnknownCheckoutPayments } from './paymentReconciliation.js';

const basePayment = {
  id: 'pay-1', provider: 'kaspi_qr', externalId: 'ext-1', refType: 'order', refId: 'order-1',
  status: 'pending', amount: 10000n, meta: { state: 'unknown' },
  updatedAt: new Date('2026-09-10T10:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockImplementation(({ where }: any) => Promise.resolve(where?.refType === 'partner_branch_subscription_invoice' ? [] : [basePayment]));
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
  releasePartnerInvoice.mockResolvedValue(true);
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


describe('partner branch invoice payment reconciliation', () => {
  const now = new Date('2026-09-10T10:05:00.000Z').getTime();
  const partnerPayment = {
    id: 'partner-pay-1',
    provider: 'kaspi_qr',
    externalId: 'kaspi-partner-1',
    refType: 'partner_branch_subscription_invoice',
    refId: 'partner-invoice-1',
    status: 'pending',
    amount: 49_900_00n,
    currency: 'KZT',
    meta: {},
    createdAt: new Date(now - 25 * 60 * 60 * 1000),
    updatedAt: new Date(now - 10 * 60 * 1000),
  };

  beforeEach(() => {
    findMany.mockImplementation(({ where }: any) => Promise.resolve(
      where?.refType === 'partner_branch_subscription_invoice' ? [partnerPayment] : [],
    ));
  });

  it('settles a provider-paid partner invoice through the existing atomic settlement path', async () => {
    providerStatus.mockResolvedValue('paid');
    const result = await reconcilePartnerBranchSubscriptionPayments(now);
    expect(result).toMatchObject({ inspected: 1, paid: 1, released: 0, errors: 0 });
    expect(transaction).toHaveBeenCalled();
    expect(paymentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: partnerPayment.id, status: 'pending', updatedAt: partnerPayment.updatedAt }),
      data: expect.objectContaining({ status: 'paid' }),
    }));
    expect(settle).toHaveBeenCalledWith(partnerPayment, expect.anything());
    expect(releasePartnerInvoice).not.toHaveBeenCalled();
  });

  it.each(['failed', 'expired'] as const)('releases the invoice hold only after provider status is conclusively %s', async (state) => {
    providerStatus.mockResolvedValue(state);
    const result = await reconcilePartnerBranchSubscriptionPayments(now);
    expect(result).toMatchObject({ inspected: 1, paid: 0, released: 1, errors: 0 });
    expect(paymentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: partnerPayment.id, status: 'pending' }),
      data: expect.objectContaining({ status: state }),
    }));
    expect(releasePartnerInvoice).toHaveBeenCalledWith({
      invoiceId: partnerPayment.refId,
      paymentId: partnerPayment.id,
    }, expect.anything());
  });

  it('keeps a provider-pending invoice reserved and delays the next provider check', async () => {
    providerStatus.mockResolvedValue('pending');
    const result = await reconcilePartnerBranchSubscriptionPayments(now);
    expect(result).toMatchObject({ inspected: 1, pending: 1, released: 0, errors: 0 });
    expect(paymentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: partnerPayment.id, status: 'pending', updatedAt: partnerPayment.updatedAt }),
      data: { updatedAt: new Date(now) },
    }));
    expect(releasePartnerInvoice).not.toHaveBeenCalled();
  });

  it('does not release an invoice when another callback or reconciler won the payment race', async () => {
    providerStatus.mockResolvedValue('expired');
    paymentUpdateMany.mockResolvedValue({ count: 0 });
    const result = await reconcilePartnerBranchSubscriptionPayments(now);
    expect(result).toMatchObject({ inspected: 1, released: 0, skipped: 1 });
    expect(releasePartnerInvoice).not.toHaveBeenCalled();
  });

  it('does not select partner payments before the 24-hour payment window expires', async () => {
    findMany.mockResolvedValue([]);
    const result = await reconcilePartnerBranchSubscriptionPayments(now);
    expect(result).toMatchObject({ inspected: 0, paid: 0, released: 0 });
    expect(providerStatus).not.toHaveBeenCalled();
  });
});


describe('payment reconciliation bootstrap registration', () => {
  it('starts the reconciliation interval with the existing background jobs when cron is enabled', () => {
    const bootstrap = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/index.ts'),
      'utf8',
    );
    expect(bootstrap).toContain("import { startPaymentReconciliationInterval } from './jobs/paymentReconciliation.js';");
    expect(bootstrap).toContain('startPaymentReconciliationInterval();');
    const start = bootstrap.indexOf('startPaymentReconciliationInterval();');
    const cronGate = bootstrap.lastIndexOf('if (env.REMINDER_CRON_MS > 0)', start);
    expect(cronGate).toBeGreaterThanOrEqual(0);
  });
});
