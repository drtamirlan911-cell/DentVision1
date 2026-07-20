import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { commissionMinor } from '../../lib/money.js';

const DEFAULT_COMMISSION_BPS = 1000; // 10%

export async function getOrCreateWallet(
  ownerType: WalletOwnerType,
  ownerId: string,
  currency = 'KZT',
) {
  const existing = await prisma.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType, ownerId, currency } },
  });
  if (existing) return existing;
  return prisma.wallet.create({ data: { ownerType, ownerId, currency } });
}

export async function resolveCommissionBps(domain: string, scopeId?: string | null): Promise<number> {
  if (scopeId) {
    const scoped = await prisma.commissionRule.findUnique({
      where: { domain_scopeId: { domain, scopeId } },
    });
    if (scoped) return scoped.percentBps;
  }
  const global = await prisma.commissionRule.findFirst({
    where: { domain, scopeId: null },
  });
  return global?.percentBps ?? DEFAULT_COMMISSION_BPS;
}

interface SaleInput {
  domain: string; // 'shop' | 'school'
  sellerType: WalletOwnerType; // SUPPLIER | LECTURER | ACADEMY
  sellerId: string;
  amountMinor: bigint;
  refType?: string;
  refId?: string;
  currency?: string;
}

/**
 * Records a marketplace/education sale as a balanced double-entry transaction:
 *   debit  GATEWAY  amount        (funds received from buyer via payment gateway)
 *   credit SELLER   net           (amount - commission)
 *   credit PLATFORM commission
 * Wallet balance convention: balance += credit, balance -= debit. Because every
 * transaction is balanced, the sum of all wallet balances stays exactly zero.
 */
export async function recordSale(input: SaleInput) {
  const currency = input.currency || 'KZT';
  const bps = await resolveCommissionBps(input.domain, input.sellerId);
  const commission = commissionMinor(input.amountMinor, bps);
  const net = input.amountMinor - commission;

  const gateway = await getOrCreateWallet('GATEWAY', 'system', currency);
  const seller = await getOrCreateWallet(input.sellerType, input.sellerId, currency);
  const platform = await getOrCreateWallet('PLATFORM', 'system', currency);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: 'sale',
        status: 'COMPLETED',
        amount: input.amountMinor,
        currency,
        refType: input.refType || input.domain,
        refId: input.refId || null,
        meta: { bps, commission: commission.toString(), net: net.toString() } as Prisma.InputJsonValue,
        entries: {
          create: [
            { walletId: gateway.id, direction: 'debit', amount: input.amountMinor },
            { walletId: seller.id, direction: 'credit', amount: net },
            { walletId: platform.id, direction: 'credit', amount: commission },
          ],
        },
      },
      include: { entries: true },
    });

    await tx.wallet.update({ where: { id: gateway.id }, data: { balance: { decrement: input.amountMinor } } });
    await tx.wallet.update({ where: { id: seller.id }, data: { balance: { increment: net } } });
    await tx.wallet.update({ where: { id: platform.id }, data: { balance: { increment: commission } } });

    return transaction;
  });
}

/**
 * Records a payout (withdrawal) as a balanced transaction:
 *   debit  seller wallet  amount   (balance decreases)
 *   credit GATEWAY        amount    (funds leave the system to the bank)
 * Throws if the wallet has insufficient balance. Keeps net wallet balance at 0.
 */
export async function recordPayout(walletId: string, amountMinor: bigint) {
  if (amountMinor <= 0n) throw new Error('Payout amount must be positive');
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.balance < amountMinor) throw new Error('Insufficient balance');

  const gateway = await getOrCreateWallet('GATEWAY', 'system', wallet.currency);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: 'payout',
        status: 'COMPLETED',
        amount: amountMinor,
        currency: wallet.currency,
        refType: 'payout',
        entries: {
          create: [
            { walletId: wallet.id, direction: 'debit', amount: amountMinor },
            { walletId: gateway.id, direction: 'credit', amount: amountMinor },
          ],
        },
      },
      include: { entries: true },
    });
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amountMinor } } });
    await tx.wallet.update({ where: { id: gateway.id }, data: { balance: { increment: amountMinor } } });
    return transaction;
  });
}

/** Invariant helper: total of all wallet balances (should always be 0n). */
export async function ledgerNetBalance(): Promise<bigint> {
  const wallets = await prisma.wallet.findMany({ select: { balance: true } });
  return wallets.reduce((sum, w) => sum + w.balance, 0n);
}
