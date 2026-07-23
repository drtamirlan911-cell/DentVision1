import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { balancedTransfer, getOrCreateUserDentWallet } from './wallet.service.js';

/**
 * Spend DentCash at checkout. Debits USER wallet, credits PLATFORM holding.
 * Idempotent per (userId, refType, refId). Caps by balance and payable.
 * Uses a transaction with a balance guard to avoid overdraft races.
 */
export async function spendDentCash(opts: {
  userId: string;
  amountMinor: bigint;
  payableMinor: bigint;
  refType: string;
  refId: string;
}) {
  if (opts.amountMinor <= 0n || opts.payableMinor <= 0n) return 0n;

  const existing = await prisma.dentCashLedger.findFirst({
    where: {
      userId: opts.userId,
      type: 'spend',
      refType: opts.refType,
      refId: opts.refId,
      status: { in: ['spent', 'available'] },
    },
  });
  if (existing) return existing.amountMinor;

  const wallet = await getOrCreateUserDentWallet(opts.userId);
  const platform = await getOrCreateWallet('PLATFORM', 'system');

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.wallet.findUnique({ where: { id: wallet.id } });
    if (!fresh) return 0n;

    const want = opts.amountMinor > opts.payableMinor ? opts.payableMinor : opts.amountMinor;
    const spend = want > fresh.balance ? fresh.balance : want;
    if (spend <= 0n) return 0n;

    // Reject if concurrent spend already drained the wallet below target.
    const updated = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: spend } },
      data: { balance: { decrement: spend } },
    });
    if (updated.count === 0) return 0n;

    await tx.wallet.update({
      where: { id: platform.id },
      data: { balance: { increment: spend } },
    });

    await tx.transaction.create({
      data: {
        type: 'dentcash_spend',
        status: 'completed',
        amount: spend,
        refType: opts.refType,
        refId: opts.refId,
        meta: { channel: 'checkout' },
        ledgerEntries: {
          create: [
            { walletId: wallet.id, direction: 'debit', amount: spend },
            { walletId: platform.id, direction: 'credit', amount: spend },
          ],
        },
      },
    });

    await tx.dentCashLedger.create({
      data: {
        userId: opts.userId,
        type: 'spend',
        status: 'spent',
        amountMinor: spend,
        refType: opts.refType,
        refId: opts.refId,
        meta: { payableMinor: opts.payableMinor.toString() },
      },
    });

    return spend;
  });
}

/** Return spent DentCash to the buyer (PLATFORM → USER). Idempotent. */
export async function refundDentCashSpend(opts: {
  refType: string;
  refId: string;
  reason?: string;
}) {
  const spends = await prisma.dentCashLedger.findMany({
    where: {
      refType: opts.refType,
      refId: opts.refId,
      type: 'spend',
      status: 'spent',
    },
  });
  if (!spends.length) return { refunded: 0n };

  let refunded = 0n;
  for (const row of spends) {
    const userWallet = await getOrCreateUserDentWallet(row.userId);
    const platform = await getOrCreateWallet('PLATFORM', 'system');

    await balancedTransfer({
      type: 'dentcash_spend_refund',
      amountMinor: row.amountMinor,
      fromWalletId: platform.id,
      toWalletId: userWallet.id,
      refType: opts.refType,
      refId: opts.refId,
      meta: { reason: opts.reason || 'order_cancelled' },
    });

    await prisma.dentCashLedger.update({
      where: { id: row.id },
      data: { status: 'reversed' },
    });
    await prisma.dentCashLedger.create({
      data: {
        userId: row.userId,
        type: 'spend_refund',
        status: 'available',
        amountMinor: row.amountMinor,
        refType: opts.refType,
        refId: opts.refId,
        meta: { reason: opts.reason || 'order_cancelled' },
      },
    });
    refunded += row.amountMinor;
  }
  return { refunded };
}
