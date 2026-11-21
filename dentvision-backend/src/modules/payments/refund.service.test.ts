import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    payment: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    transaction: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payout: { findMany: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    },
  };
});

vi.mock('../../lib/prisma.js', () => ({ default: prismaMock }));

const { refundPayment, PaymentRefundError } = await import('./refund.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  tx.payment.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', amount: 10_000n, status: data.status }));
  tx.payment.findUniqueOrThrow.mockResolvedValue({ id: 'p1', amount: 10_000n, status: 'paid' });
  tx.transaction.create.mockImplementation(async ({ data }: any) => ({ id: 'r1', amount: data.amount, ...data }));
  tx.wallet.findUnique.mockResolvedValue({ balance: 100_000n });
  tx.wallet.update.mockResolvedValue({});
  tx.wallet.updateMany.mockResolvedValue({ count: 1 });
  tx.payout.findMany.mockResolvedValue([]);
});

function paidPayment() {
  tx.payment.findUnique.mockResolvedValue({
    id: 'p1',
    amount: 10_000n,
    currency: 'KZT',
    status: 'paid',
    refType: 'sale',
    refId: 'p1',
    meta: {},
  });
  tx.transaction.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{
      id: 'sale-1',
      amount: 10_000n,
      ledgerEntries: [
        { walletId: 'gateway', direction: 'debit', amount: 10_000n },
        { walletId: 'seller', direction: 'credit', amount: 9_000n },
        { walletId: 'platform', direction: 'credit', amount: 1_000n },
      ],
    }]);
}

function paidDentalLabPayment() {
  tx.payment.findUnique.mockResolvedValue({
    id: 'p-dental-1',
    amount: 10_000n,
    currency: 'KZT',
    status: 'paid',
    refType: 'dental_lab_order',
    refId: 'lab-order-1',
    meta: { clinicId: 'clinic-1', laboratoryId: 'lab-1' },
  });
  tx.transaction.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{
      id: 'partner-economics-1',
      amount: 10_000n,
      ledgerEntries: [
        { walletId: 'gateway', direction: 'debit', amount: 10_000n },
        { walletId: 'partner', direction: 'credit', amount: 9_200n },
        { walletId: 'platform', direction: 'credit', amount: 800n },
      ],
    }]);
}

describe('refundPayment', () => {

  it('validates clinic-cash appointment and invoice references before creating a payment', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/payments/payments.routes.ts'),
      'utf8',
    );
    const clinicCashStart = routeSource.indexOf("if (isClinicCashier)");
    const platformStart = routeSource.indexOf("// Platform Kaspi", clinicCashStart);
    const clinicCashBlock = routeSource.slice(clinicCashStart, platformStart);
    expect(clinicCashBlock).toContain("prisma.appointment.findFirst");
    expect(clinicCashBlock).toContain("where: { id: String(refId), clinicId }");
    expect(clinicCashBlock).toContain("prisma.invoice.findFirst");
    expect(clinicCashBlock).toContain("where: { id: String(refId), clinicId, deletedAt: null }");
    expect(clinicCashBlock).toContain("minor > outstandingMinor");
    expect(clinicCashBlock.indexOf("prisma.invoice.findFirst")).toBeLessThan(clinicCashBlock.indexOf("reserveForPayment"));
  });

  it('keeps clinic refund authority behind billing.manage', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/payments/payments.routes.ts'),
      'utf8',
    );
    expect(routeSource).toContain('async function canManageClinicBillingMutation');
    expect(routeSource).toContain("permissionsSatisfy(new Set(permissions), 'billing.manage')");
    expect(routeSource).not.toContain('// Clinic cashier payments: any active member of that clinic may confirm.');
    const clinicScopeResolver = routeSource.indexOf('function clinicPaymentScope(payment:');
    const clinicBoundary = routeSource.indexOf('const clinicId = clinicPaymentScope(payment);');
    const genericOwnerCheck = routeSource.indexOf("if (meta.userId && meta.userId === req.user!.id)");
    expect(clinicScopeResolver).toBeGreaterThan(-1);
    expect(routeSource).toContain("payment.provider === 'clinic_kaspi'");
    expect(routeSource).toContain("payment.refType === 'appointment'");
    expect(routeSource).toContain("payment.refType === 'crm_invoice'");
    expect(clinicBoundary).toBeGreaterThan(clinicScopeResolver);
    expect(genericOwnerCheck).toBeGreaterThan(clinicBoundary);
    expect(routeSource).toContain('const clinicScopedPayment = payment.provider === \'clinic_kaspi\'');
    expect(routeSource).toContain('if (clinicScopedPayment)');
    expect(routeSource).toContain('if (!clinicId) return false;');
    expect(routeSource).toContain('return canManageClinicBillingMutation(req.user!, clinicId);');
    const clinicCashStart = routeSource.indexOf("if (isClinicCashier)");
    const clinicCashEnd = routeSource.indexOf("// Platform Kaspi", clinicCashStart);
    const clinicCashBlock = routeSource.slice(clinicCashStart, clinicCashEnd);
    expect(clinicCashBlock).toContain("assertClinicPaymentStaffAccess(req.user!.id, clinicId)");
  });

  it('reverses the dental-laboratory partner/platform ledger on a full case refund', async () => {
    paidDentalLabPayment();
    const result = await refundPayment('p-dental-1', 10_000n, 'dental-full', 'case refund');
    expect(result.alreadyProcessed).toBe(false);
    const args = tx.transaction.create.mock.calls[0][0].data;
    expect(args.meta.originalTransactionIds).toEqual(['partner-economics-1']);
    expect(args.ledgerEntries.create).toEqual([
      { walletId: 'gateway', direction: 'credit', amount: 10_000n },
      { walletId: 'partner', direction: 'debit', amount: 9_200n },
      { walletId: 'platform', direction: 'debit', amount: 800n },
    ]);
    expect(tx.wallet.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'refunded' } }));
  });

  it('supports a partial refund for a dental-laboratory case without changing the paid status', async () => {
    paidDentalLabPayment();
    const result = await refundPayment('p-dental-1', 5_000n, 'dental-partial', 'partial case refund');
    expect(result.payment.status).toBe('paid');
    const entries = tx.transaction.create.mock.calls[0][0].data.ledgerEntries.create;
    expect(entries).toEqual([
      { walletId: 'gateway', direction: 'credit', amount: 5_000n },
      { walletId: 'partner', direction: 'debit', amount: 4_600n },
      { walletId: 'platform', direction: 'debit', amount: 400n },
    ]);
  });

  it('refuses to reverse a partner debit after the available funds have been paid out', async () => {
    paidDentalLabPayment();
    tx.wallet.findUnique.mockImplementation(async ({ where }: any) => ({
      balance: where.id === 'partner' ? 0n : 100_000n,
    }));

    await expect(refundPayment('p-dental-1', 10_000n, 'dental-after-payout', 'case refund'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('does not consume funds already held by a requested or approved payout', async () => {
    paidDentalLabPayment();
    tx.wallet.findUnique.mockImplementation(async ({ where }: any) => ({
      balance: where.id === 'partner' ? 9_200n : 100_000n,
    }));
    tx.payout.findMany.mockImplementation(async ({ where }: any) =>
      where.walletId === 'partner' ? [{ amount: 9_000n }] : [],
    );

    await expect(refundPayment('p-dental-1', 10_000n, 'dental-payout-held', 'case refund'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('reverses the original ledger with opposite directions', async () => {
    paidPayment();
    const result = await refundPayment('p1', 10_000n, 'refund-1', 'test');

    expect(result.alreadyProcessed).toBe(false);
    expect(tx.transaction.create).toHaveBeenCalledTimes(1);
    const entries = tx.transaction.create.mock.calls[0][0].data.ledgerEntries.create;
    expect(entries).toEqual([
      { walletId: 'gateway', direction: 'credit', amount: 10_000n },
      { walletId: 'seller', direction: 'debit', amount: 9_000n },
      { walletId: 'platform', direction: 'debit', amount: 1_000n },
    ]);
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'refunded' } }));
    expect(tx.wallet.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledWith(expect.stringContaining('wallet-funds:'));
    expect(tx.transaction.create.mock.calls[0][0].data.meta.originalTransactionIds).toEqual(['sale-1']);
  });

  it('supports a partial refund without marking the payment fully refunded', async () => {
    paidPayment();
    const result = await refundPayment('p1', 5_000n, 'refund-partial', 'partial');

    expect(result.payment.status).toBe('paid');
    const entries = tx.transaction.create.mock.calls[0][0].data.ledgerEntries.create;
    expect(entries.map((e: any) => e.amount)).toEqual([5_000n, 4_500n, 500n]);
  });

  it('replays the same idempotency key without creating a second reversal', async () => {
    paidPayment();
    tx.transaction.findMany.mockReset().mockResolvedValue([
      { id: 'r1', amount: 5_000n, meta: { refundKey: 'same-key' } },
    ]);

    const result = await refundPayment('p1', 5_000n, 'same-key');
    expect(result.alreadyProcessed).toBe(true);
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an amount beyond the remaining refundable balance', async () => {
    paidPayment();
    tx.transaction.findMany.mockReset().mockResolvedValue([
      { id: 'r1', amount: 7_000n, meta: { refundKey: 'first' } },
    ]);

    await expect(refundPayment('p1', 4_000n, 'second')).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('requires the idempotency key', async () => {
    await expect(refundPayment('p1', null, '')).rejects.toMatchObject({
      code: 'IDEMPOTENCY_REQUIRED',
    });
  });

  it('locks the payment before reading it', async () => {
    paidPayment();
    await refundPayment('p1', 10_000n, 'locked');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(4);
    expect(String(tx.$executeRaw.mock.calls[0][0])).toContain('payment-refund:');
    for (const call of tx.$executeRaw.mock.calls.slice(1)) {
      expect(String(call[0])).toContain('wallet-funds:');
    }
  });

  it('fails closed when no financial transaction exists', async () => {
    paidPayment();
    tx.transaction.findMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(refundPayment('p1', 10_000n, 'unsupported')).rejects.toMatchObject({
      code: 'NOT_REFUNDABLE',
    });
  });
});
