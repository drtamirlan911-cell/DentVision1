/**
 * Payout requests: the part that was missing.
 *
 * A lecturer or supplier could already press "withdraw" — both workspaces
 * created a `Payout` row with `status: 'requested'`. Nothing read that table.
 * No queue, no approval, no status change, no notification, and no ledger
 * entry. The button worked; the request did not exist.
 *
 * Two things were wrong, and the second is worse than the first.
 *
 * **1. Nothing consumed the request.** Money asked for simply sat in a row.
 *
 * **2. The balance was checked but never held.** Both call sites compared
 * `wallet.balance` to the requested amount and then wrote the row without
 * debiting or reserving anything. A lecturer with 100 000 could request 100 000
 * five times: each request passed the check on its own, and the five together
 * came to five times the balance. That is not a workflow gap, it is a way to be
 * owed money that does not exist.
 *
 * So `availableBalanceMinor` — not the raw balance — is what a request is
 * checked against: the wallet minus everything already requested or approved
 * and not yet resolved.
 *
 * **The ledger stays balanced.** `finance.service.ts` records money as
 * double-entry and holds the invariant that every wallet balance summed is
 * exactly zero (`ledgerNetBalance`). A payout is the mirror of a sale: a sale
 * debits GATEWAY and credits the seller, so paying out debits the seller and
 * credits GATEWAY. Posting it any other way would break the one invariant the
 * finance module actually asserts.
 *
 * The entry is posted when a payout is marked **paid**, not when it is
 * approved: approval is a decision, payment is the money leaving. Between the
 * two the funds are held by `availableBalanceMinor`, not by a ledger entry for
 * something that has not happened.
 */

import type { Prisma, WalletOwnerType } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from './finance.service.js';

export const PAYOUT_STATUSES = ['requested', 'approved', 'paid', 'rejected'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * Which moves are legal.
 *
 * `paid` and `rejected` are terminal on purpose: a paid payout that can be
 * re-approved would post the ledger entry twice, and this is the only place
 * that stops it.
 */
export const PAYOUT_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['paid', 'rejected'],
  paid: [],
  rejected: [],
};

/** Statuses that still lay claim to the money. */
export const PENDING_PAYOUT_STATUSES: readonly PayoutStatus[] = ['requested', 'approved'];

export class PayoutError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'INSUFFICIENT_FUNDS' | 'BAD_TRANSITION' | 'INVALID_AMOUNT',
    message: string,
  ) {
    super(message);
    this.name = 'PayoutError';
  }
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * What this wallet may still ask for: balance minus everything already asked
 * for and not yet resolved.
 *
 * Checking the raw balance is what let the same funds be requested repeatedly.
 */
export async function availableBalanceMinor(walletId: string, db: Db = prisma): Promise<bigint> {
  const [wallet, pending] = await Promise.all([
    db.wallet.findUnique({ where: { id: walletId }, select: { balance: true } }),
    db.payout.findMany({
      where: { walletId, status: { in: [...PENDING_PAYOUT_STATUSES] } },
      select: { amount: true },
    }),
  ]);
  if (!wallet) return 0n;
  const held = pending.reduce((sum, p) => sum + p.amount, 0n);
  return wallet.balance - held;
}

export interface RequestPayoutInput {
  ownerType: WalletOwnerType;
  ownerId: string;
  amountMinor: bigint;
  currency?: string;
}

/**
 * File a payout request against what is genuinely available.
 *
 * One function for both workspaces: the lecturer and supplier routes had the
 * same balance check copied into each, and each was wrong the same way.
 */
export async function requestPayout(input: RequestPayoutInput) {
  if (input.amountMinor <= 0n) {
    throw new PayoutError('INVALID_AMOUNT', 'Сумма выплаты должна быть больше нуля');
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(input.ownerType, input.ownerId, input.currency || 'KZT', tx);
    const available = await availableBalanceMinor(wallet.id, tx);
    if (available < input.amountMinor) {
      throw new PayoutError(
        'INSUFFICIENT_FUNDS',
        'Недостаточно средств с учётом уже поданных заявок',
      );
    }
    return tx.payout.create({
      data: { walletId: wallet.id, amount: input.amountMinor, status: 'requested' },
    });
  });
}

export interface PayoutFilters {
  status?: PayoutStatus;
  ownerType?: WalletOwnerType;
  ownerId?: string;
  take?: number;
}

/** The queue somebody actually looks at — the read that did not exist. */
export async function listPayouts(filters: PayoutFilters = {}) {
  const where: Prisma.PayoutWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.ownerType || filters.ownerId) {
    where.wallet = {
      ...(filters.ownerType ? { ownerType: filters.ownerType } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    };
  }
  return prisma.payout.findMany({
    where,
    include: { wallet: { select: { ownerType: true, ownerId: true, currency: true, balance: true } } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.take ?? 100, 500),
  });
}

/**
 * Move a payout along, posting the ledger entry when — and only when — the
 * money actually leaves.
 *
 * The whole state machine lives here rather than in the routes, so a second
 * caller cannot invent a transition the first one forbids.
 */
export async function transitionPayout(
  payoutId: string,
  next: PayoutStatus,
  opts: { actorUserId?: string | null } = {},
) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({
      where: { id: payoutId },
      include: { wallet: true },
    });
    if (!payout) throw new PayoutError('NOT_FOUND', 'Заявка на выплату не найдена');

    const current = payout.status as PayoutStatus;
    const allowed = PAYOUT_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new PayoutError(
        'BAD_TRANSITION',
        `Нельзя перевести заявку из «${current}» в «${next}»`,
      );
    }

    if (next === 'paid') {
      // Re-check at the moment of payment rather than trusting the check made
      // when it was requested: the balance can have moved since.
      if (payout.wallet.balance < payout.amount) {
        throw new PayoutError('INSUFFICIENT_FUNDS', 'На кошельке недостаточно средств для выплаты');
      }

      const gateway = await getOrCreateWallet('GATEWAY', 'system', payout.wallet.currency, tx);

      // The mirror of a sale: a sale debits GATEWAY and credits the seller, so
      // a payout debits the seller and credits GATEWAY. Balanced, so
      // `ledgerNetBalance()` stays at zero.
      await tx.transaction.create({
        data: {
          type: 'payout',
          status: 'completed',
          amount: payout.amount,
          currency: payout.wallet.currency,
          refType: 'payout',
          refId: payout.id,
          meta: { actorUserId: opts.actorUserId ?? null } as Prisma.InputJsonValue,
          ledgerEntries: {
            create: [
              { walletId: payout.walletId, direction: 'debit', amount: payout.amount },
              { walletId: gateway.id, direction: 'credit', amount: payout.amount },
            ],
          },
        },
      });

      await tx.wallet.update({
        where: { id: payout.walletId },
        data: { balance: { decrement: payout.amount } },
      });
      await tx.wallet.update({
        where: { id: gateway.id },
        data: { balance: { increment: payout.amount } },
      });
    }

    return tx.payout.update({ where: { id: payoutId }, data: { status: next } });
  });
}
