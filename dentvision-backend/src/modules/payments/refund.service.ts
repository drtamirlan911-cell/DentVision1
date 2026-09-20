import prisma from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export class PaymentRefundError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_AMOUNT' | 'IDEMPOTENCY_REQUIRED' | 'NOT_REFUNDABLE' | 'ALREADY_REFUNDED',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentRefundError';
  }
}

type PaymentForRefund = {
  id: string;
  amount: bigint;
  status: string;
  currency: string;
  refType: string | null;
  refId: string | null;
  meta: unknown;
};

function refundKey(meta: unknown): string | null {
  const value = (meta && typeof meta === 'object' ? meta : {}) as Record<string, unknown>;
  return typeof value.refundKey === 'string' ? value.refundKey : null;
}

export async function refundPayment(
  paymentId: string,
  amountMinor: bigint | null,
  idempotencyKey: string,
  reason: string | undefined,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (!idempotencyKey.trim()) throw new PaymentRefundError('IDEMPOTENCY_REQUIRED', 'Idempotency-Key обязателен');

  const run = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'payment-refund:' + paymentId}))`;

    const payment = await tx.payment.findUnique({ where: { id: paymentId } }) as PaymentForRefund | null;
    if (!payment) throw new PaymentRefundError('NOT_FOUND', 'Платёж не найден');
    if (payment.status !== 'paid' && payment.status !== 'refunded') {
      throw new PaymentRefundError('NOT_REFUNDABLE', 'Возврат возможен только для оплаченного платежа');
    }

    const previous = await tx.transaction.findMany({
      where: { type: 'refund', refType: 'payment', refId: paymentId },
      select: { id: true, amount: true, meta: true },
      orderBy: { createdAt: 'asc' },
    });
    const duplicate = previous.find((row) => refundKey(row.meta) === idempotencyKey);
    if (duplicate) {
      const updated = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      return { payment: updated, refund: duplicate, alreadyProcessed: true };
    }

    const refunded = previous.reduce((sum, row) => sum + row.amount, 0n);
    const remaining = payment.amount - refunded;
    if (remaining <= 0n) throw new PaymentRefundError('ALREADY_REFUNDED', 'Платёж уже возвращён полностью');

    const requested = amountMinor ?? remaining;
    if (requested <= 0n || requested > remaining) {
      throw new PaymentRefundError('INVALID_AMOUNT', 'Сумма возврата превышает невозвращённый остаток');
    }

    const originals = payment.refType === 'order' && payment.refId
      ? await tx.transaction.findMany({
          where: { type: 'sale', refType: 'order', refId: payment.refId },
          include: { ledgerEntries: true },
          orderBy: { createdAt: 'asc' },
        })
      : payment.refType === 'sale'
        ? await tx.transaction.findMany({
            where: { type: 'sale', refType: 'payment', refId: payment.id },
            include: { ledgerEntries: true },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    const financialTotal = originals.reduce((sum, row) => sum + row.amount, 0n);
    const financialRemaining = financialTotal - refunded;
    if (!originals.length || financialTotal <= 0n) {
      throw new PaymentRefundError(
        'NOT_REFUNDABLE',
        'Для этого платежа нет связанной двойной записи Finance Core; автоматический возврат не выполняется',
      );
    }
    if (requested > financialRemaining) {
      throw new PaymentRefundError(
        'NOT_REFUNDABLE',
        'Сумма возврата превышает сумму, отражённую в Finance Core',
      );
    }

    // An order can have more than one supplier sale transaction. Allocate the
    // requested refund across all of them in creation order, then reverse every
    // affected ledger entry. This prevents a multi-supplier order from refunding
    // only the first seller/platform split.
    let left = requested;
    const rawRefundEntries: Array<{ walletId: string; direction: string; amount: bigint }> = [];
    for (const original of originals) {
      if (left <= 0n) break;
      const allocation = left < original.amount ? left : original.amount;
      if (allocation <= 0n) continue;
      const entries = original.ledgerEntries;
      if (!entries.length) {
        throw new PaymentRefundError('NOT_REFUNDABLE', 'У исходной операции отсутствуют ledger entries');
      }

      const mapped = entries.map((entry) => ({
        walletId: entry.walletId,
        direction: entry.direction === 'debit' ? 'credit' : 'debit',
        amount: (entry.amount * allocation) / original.amount,
      }));
      const mappedTotal = mapped.reduce((sum, entry) => sum + entry.amount, 0n);
      const adjustment = allocation - mappedTotal;
      const lastPositive = [...mapped].reverse().findIndex((entry) => entry.amount > 0n);
      if (lastPositive < 0 || adjustment < 0n) {
        throw new PaymentRefundError('INVALID_AMOUNT', 'Сумма возврата не может быть пропорционально отражена в исходном ledger');
      }
      mapped[mapped.length - 1 - lastPositive].amount += adjustment;
      rawRefundEntries.push(...mapped.filter((entry) => entry.amount > 0n));
      left -= allocation;
    }

    if (left !== 0n) {
      throw new PaymentRefundError('NOT_REFUNDABLE', 'Не удалось распределить возврат по финансовым операциям');
    }

    const combined = new Map<string, { walletId: string; direction: string; amount: bigint }>();
    for (const entry of rawRefundEntries) {
      const key = entry.walletId + ':' + entry.direction;
      const existing = combined.get(key);
      if (existing) existing.amount += entry.amount;
      else combined.set(key, { ...entry });
    }
    const refundEntries = [...combined.values()];
    const reversedTotal = refundEntries.reduce((sum, entry) => sum + entry.amount, 0n);
    const debitTotal = refundEntries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0n);
    const creditTotal = refundEntries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0n);
    if (reversedTotal !== requested || debitTotal !== creditTotal) {
      throw new PaymentRefundError('INVALID_AMOUNT', 'Возврат не сохраняет баланс двойной записи');
    }

    const refund = await tx.transaction.create({
      data: {
        type: 'refund',
        status: 'completed',
        amount: requested,
        currency: payment.currency,
        refType: 'payment',
        refId: payment.id,
        meta: {
          refundKey: idempotencyKey,
          originalTransactionIds: originals.map((row) => row.id),
          reason: reason || null,
          partial: requested < remaining,
          refundedBefore: refunded.toString(),
          refundedAfter: (refunded + requested).toString(),
        } as Prisma.InputJsonValue,
        ledgerEntries: { create: refundEntries },
      },
    });

    for (const entry of refundEntries) {
      const delta = entry.direction === 'credit' ? entry.amount : -entry.amount;
      await tx.wallet.update({ where: { id: entry.walletId }, data: { balance: { increment: delta } } });
    }

    const totalRefunded = refunded + requested;
    const nextStatus = totalRefunded === payment.amount ? 'refunded' : 'paid';
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: nextStatus },
    });

    return { payment: updated, refund, alreadyProcessed: false };
  };

  if ('$transaction' in db) return db.$transaction(run);
  return run(db);
}
