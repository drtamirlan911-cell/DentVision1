import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { serializeBigInt } from '../../lib/money.js';

export async function getOrCreateUserDentWallet(userId: string, currency = 'KZT') {
  return getOrCreateWallet('USER', userId, currency);
}

export async function getWalletSummary(userId: string) {
  const wallet = await getOrCreateUserDentWallet(userId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [pendingAgg, earnedMonth, spentMonth, recent] = await Promise.all([
    prisma.dentCashLedger.aggregate({
      where: { userId, type: 'earn', status: 'pending' },
      _sum: { amountMinor: true },
    }),
    prisma.dentCashLedger.aggregate({
      where: {
        userId,
        type: 'earn',
        status: { in: ['available', 'spent', 'pending'] },
        createdAt: { gte: monthStart },
      },
      _sum: { amountMinor: true },
    }),
    prisma.dentCashLedger.aggregate({
      where: { userId, type: 'spend', createdAt: { gte: monthStart } },
      _sum: { amountMinor: true },
    }),
    prisma.dentCashLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return serializeBigInt({
    balanceMinor: wallet.balance.toString(),
    balanceTenge: Number(wallet.balance) / 100,
    pendingMinor: (pendingAgg._sum.amountMinor || 0n).toString(),
    pendingTenge: Number(pendingAgg._sum.amountMinor || 0n) / 100,
    earnedThisMonthMinor: (earnedMonth._sum.amountMinor || 0n).toString(),
    earnedThisMonthTenge: Number(earnedMonth._sum.amountMinor || 0n) / 100,
    spentThisMonthMinor: (spentMonth._sum.amountMinor || 0n).toString(),
    spentThisMonthTenge: Number(spentMonth._sum.amountMinor || 0n) / 100,
    currency: wallet.currency,
    recent: recent.map((r) => ({
      ...r,
      amountMinor: r.amountMinor.toString(),
      amountTenge: Number(r.amountMinor) / 100,
    })),
  });
}

export async function listTransactions(userId: string, limit = 50) {
  const rows = await prisma.dentCashLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  });
  return serializeBigInt(rows.map((r) => ({
    ...r,
    amountMinor: r.amountMinor.toString(),
    amountTenge: Number(r.amountMinor) / 100,
  })));
}

/** Balanced transfer: debit fromWallet, credit toWallet, create Transaction + LedgerEntry. */
export async function balancedTransfer(opts: {
  type: string;
  amountMinor: bigint;
  fromWalletId: string;
  toWalletId: string;
  refType?: string;
  refId?: string;
  meta?: Prisma.InputJsonValue;
  currency?: string;
}) {
  if (opts.amountMinor <= 0n) return null;
  const currency = opts.currency || 'KZT';

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: opts.type,
        status: 'completed',
        amount: opts.amountMinor,
        currency,
        refType: opts.refType || null,
        refId: opts.refId || null,
        meta: opts.meta || undefined,
        ledgerEntries: {
          create: [
            { walletId: opts.fromWalletId, direction: 'debit', amount: opts.amountMinor },
            { walletId: opts.toWalletId, direction: 'credit', amount: opts.amountMinor },
          ],
        },
      },
    });

    await tx.wallet.update({
      where: { id: opts.fromWalletId },
      data: { balance: { decrement: opts.amountMinor } },
    });
    await tx.wallet.update({
      where: { id: opts.toWalletId },
      data: { balance: { increment: opts.amountMinor } },
    });

    return transaction;
  });
}
