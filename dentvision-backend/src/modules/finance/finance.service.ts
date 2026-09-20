import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { commissionMinor } from '../../lib/money.js';
import { writeRevenue, revenueSourceForDomain } from './revenue.service.js';

const DEFAULT_COMMISSION_BPS = 1000; // 10%

export async function getOrCreateWallet(
  ownerType: WalletOwnerType,
  ownerId: string,
  currency = 'KZT',
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await db.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType, ownerId, currency } },
  });
  if (existing) return existing;
  return db.wallet.create({ data: { ownerType, ownerId, currency } });
}

export async function resolveCommissionBps(
  domain: string,
  scopeId?: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma,
  context?: { branchId?: string | null; organizationId?: string | null },
): Promise<number> {
  const candidateScopeIds = [context?.branchId, context?.organizationId, scopeId].filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) === index);
  for (const candidateScopeId of candidateScopeIds) {
    const scoped = await db.commissionRule.findUnique({
      where: { domain_scopeId: { domain, scopeId: candidateScopeId } },
    });
    if (scoped) return scoped.percentBps;
  }
  const global = await db.commissionRule.findFirst({
    where: { domain, scopeId: null },
  });
  return global?.percentBps ?? DEFAULT_COMMISSION_BPS;
}

interface SaleInput {
  domain: string; // 'shop' | 'school'
  sellerType: WalletOwnerType; // SUPPLIER | LECTURER | ACADEMY
  sellerId: string;
  organizationId?: string | null;
  branchId?: string | null;
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
 *
 * Takes an already-open transaction client — never opens its own — so it can be
 * called from inside a caller's `prisma.$transaction(...)` (Prisma does not
 * support nesting interactive transactions). Standalone callers should use
 * `recordSale()` below instead.
 */
export async function recordSaleTx(input: SaleInput, db: Prisma.TransactionClient) {
  const currency = input.currency || 'KZT';
  const bps = await resolveCommissionBps(input.domain, input.sellerId, db, { branchId: input.branchId, organizationId: input.organizationId });
  const commission = commissionMinor(input.amountMinor, bps);
  const net = input.amountMinor - commission;

  const gateway = await getOrCreateWallet('GATEWAY', 'system', currency, db);
  const seller = await getOrCreateWallet(input.sellerType, input.sellerId, currency, db);
  const platform = await getOrCreateWallet('PLATFORM', 'system', currency, db);

  const transaction = await db.transaction.create({
    data: {
      type: 'sale',
      status: 'completed',
      amount: input.amountMinor,
      currency,
      refType: input.refType || input.domain,
      refId: input.refId || null,
      meta: { bps, commission: commission.toString(), net: net.toString() } as Prisma.InputJsonValue,
      ledgerEntries: {
        create: [
          { walletId: gateway.id, direction: 'debit', amount: input.amountMinor },
          { walletId: seller.id, direction: 'credit', amount: net },
          { walletId: platform.id, direction: 'credit', amount: commission },
        ],
      },
    },
    include: { ledgerEntries: true },
  });

  await db.wallet.update({ where: { id: gateway.id }, data: { balance: { decrement: input.amountMinor } } });
  await db.wallet.update({ where: { id: seller.id }, data: { balance: { increment: net } } });
  await db.wallet.update({ where: { id: platform.id }, data: { balance: { increment: commission } } });

  await writeRevenue(
    {
      source: revenueSourceForDomain(input.domain),
      amountMinor: input.amountMinor,
      refType: input.refType || input.domain,
      refId: input.refId,
    },
    db,
  );

  return transaction;
}

/**
 * Clinical treatment revenue is not a DentVision marketplace sale. The
 * canonical economics policy explicitly says the clinic's total treatment
 * revenue must not receive a default DentVision percentage commission.
 *
 * We therefore still put the payment into the same balanced Finance Core, but
 * with a direct GATEWAY → CLINIC transfer and no PLATFORM credit/revenue row.
 * `paymentMethod` is metadata only; the ledger remains the financial source of
 * truth while the CRM invoice remains the patient-facing document.
 *
 * Idempotency is keyed by (refType, refId): a payment/invoice can never create
 * two clinical ledger transactions when the pay endpoint is retried.
 */
export async function recordClinicalPaymentTx(input: {
  clinicId: string;
  amountMinor: bigint;
  refId: string;
  paymentMethod?: string | null;
  currency?: string;
  db: Prisma.TransactionClient;
}) {
  if (!input.clinicId || !input.refId || input.amountMinor <= 0n) {
    throw new Error('Invalid clinical payment');
  }

  const currency = input.currency || 'KZT';
  const refType = 'clinical_payment';
  const existing = await input.db.transaction.findFirst({
    where: { refType, refId: input.refId, type: 'clinical_payment' },
  });
  if (existing) return existing;

  const gateway = await getOrCreateWallet('GATEWAY', 'system', currency, input.db);
  const clinic = await getOrCreateWallet('CLINIC', input.clinicId, currency, input.db);

  const transaction = await input.db.transaction.create({
    data: {
      type: 'clinical_payment',
      status: 'completed',
      amount: input.amountMinor,
      currency,
      refType,
      refId: input.refId,
      meta: {
        commissionBps: 0,
        paymentMethod: input.paymentMethod || null,
        clinicId: input.clinicId,
      } as Prisma.InputJsonValue,
      ledgerEntries: {
        create: [
          { walletId: gateway.id, direction: 'debit', amount: input.amountMinor },
          { walletId: clinic.id, direction: 'credit', amount: input.amountMinor },
        ],
      },
    },
    include: { ledgerEntries: true },
  });

  await input.db.wallet.update({
    where: { id: gateway.id },
    data: { balance: { decrement: input.amountMinor } },
  });
  await input.db.wallet.update({
    where: { id: clinic.id },
    data: { balance: { increment: input.amountMinor } },
  });

  return transaction;
}

export async function reverseClinicalPaymentTx(input: {
  clinicId: string;
  amountMinor: bigint;
  refId: string;
  reason?: string | null;
  currency?: string;
  db: Prisma.TransactionClient;
}) {
  if (!input.clinicId || !input.refId || input.amountMinor <= 0n) throw new Error('Invalid clinical reversal');
  const currency = input.currency || 'KZT';
  const refType = 'clinical_payment_reversal';
  const existing = await input.db.transaction.findFirst({
    where: { refType, refId: input.refId, type: 'clinical_payment_reversal' },
  });
  if (existing) return existing;
  const gateway = await getOrCreateWallet('GATEWAY', 'system', currency, input.db);
  const clinic = await getOrCreateWallet('CLINIC', input.clinicId, currency, input.db);
  const transaction = await input.db.transaction.create({
    data: {
      type: 'clinical_payment_reversal',
      status: 'completed',
      amount: input.amountMinor,
      currency,
      refType,
      refId: input.refId,
      meta: { reason: input.reason || null, clinicId: input.clinicId } as Prisma.InputJsonValue,
      ledgerEntries: {
        create: [
          { walletId: clinic.id, direction: 'debit', amount: input.amountMinor },
          { walletId: gateway.id, direction: 'credit', amount: input.amountMinor },
        ],
      },
    },
    include: { ledgerEntries: true },
  });
  await input.db.wallet.update({ where: { id: clinic.id }, data: { balance: { decrement: input.amountMinor } } });
  await input.db.wallet.update({ where: { id: gateway.id }, data: { balance: { increment: input.amountMinor } } });
  return transaction;
}

/** Standalone convenience wrapper: opens its own transaction around `recordSaleTx`. */
export async function recordSale(input: SaleInput) {
  return prisma.$transaction((tx) => recordSaleTx(input, tx));
}

/** Invariant helper: total of all wallet balances (should always be 0n). */
export async function ledgerNetBalance(): Promise<bigint> {
  const wallets = await prisma.wallet.findMany({ select: { balance: true } });
  return wallets.reduce((sum, w) => sum + w.balance, 0n);
}
