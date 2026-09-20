import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    payment: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    transaction: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    wallet: { update: vi.fn() },
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

describe('refundPayment', () => {
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
    expect(tx.wallet.update).toHaveBeenCalledTimes(3);
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
    tx.transaction.findMany.mockResolvedValue([
      { id: 'r1', amount: 5_000n, meta: { refundKey: 'same-key' } },
    ]);

    const result = await refundPayment('p1', 5_000n, 'same-key');
    expect(result.alreadyProcessed).toBe(true);
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('rejects an amount beyond the remaining refundable balance', async () => {
    paidPayment();
    tx.transaction.findMany.mockResolvedValue([
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
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('fails closed when no financial transaction exists', async () => {
    paidPayment();
    tx.transaction.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(refundPayment('p1', 10_000n, 'unsupported')).rejects.toMatchObject({
      code: 'NOT_REFUNDABLE',
    });
  });
});
