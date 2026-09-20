import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';

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

  return db.$transaction(async (tx) => {
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

    let original = null;
    if (payment.refType === 'order' && payment.refId) {
      original = await tx.transaction.findFirst({
        where: { type: 'sale', refType: 'order', refId: payment.refId },
        include: { ledgerEntries: true },
      });
    } else if (payment.refType === 'sale') {
      original = await tx.transaction.findFirst({
        where: { type: 'sale', refType: 'payment', refId: payment.id },
        include: { ledgerEntries: true },
      });
    }

    if (!original) {
      throw new PaymentRefundError(
        'NOT_REFUNDABLE',
        'Для этого платежа нет связанной двойной записи Finance Core; автоматический возврат не выполняется',
      );
    }

    if (original.amount <= 0n || requested > original.amount) {
      throw new PaymentRefundError('NOT_REFUNDABLE', 'Исходная финансовая операция не поддерживает этот возврат');
    }

    const entries = original.ledgerEntries;
    if (!entries.length) throw new PaymentRefundError('NOT_REFUNDABLE', 'У исходной операции отсутствуют ledger entries');

    const refundEntries = entries.map((entry) => ({
      walletId: entry.walletId,
      direction: entry.direction === 'debit' ? 'credit' : 'debit',
      amount: (entry.amount * requested) / original.amount,
    }));

    if (refundEntries.some((entry) => entry.amount <= 0n)) {
      throw new PaymentRefundError('INVALID_AMOUNT', 'Сумма возврата слишком мала для пропорционального ledger reversal');
    }
    const reversedTotal = refundEntries.reduce((sum, entry) => sum + entry.amount, 0n);
    if (reversedTotal !== requested) {
      throw new PaymentRefundError('INVALID_AMOUNT', 'Сумма возврата не может быть пропорционально отражена в исходном ledger');
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
          originalTransactionId: original.id,
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
  });
}
