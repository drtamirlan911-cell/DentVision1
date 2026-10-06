import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { commissionMinor } from '../../lib/money.js';
import { writeRevenue, revenueSourceForDomain } from './revenue.service.js';

/**
 * Canonical platform defaults. Scope-specific CommissionRule rows may override
 * the rate, but the safety floor/cap remains domain policy unless a future
 * explicit rule schema overrides those values.
 *
 * Amounts are minor KZT units (tiyn). The previous universal 10% fallback was
 * not the DentVision economics policy and made an unset commission rule
 * silently overcharge some domains.
 */
const DEFAULT_COMMISSION_POLICY: Record<string, { bps: number; minMinor?: bigint; maxMinor?: bigint }> = {
  diagnostics: { bps: 700, minMinor: 50_000n, maxMinor: 300_000n }, // 7%, min ₸500, cap ₸3,000
  diagnostic: { bps: 700, minMinor: 50_000n, maxMinor: 300_000n },
  medical_lab: { bps: 600, minMinor: 15_000n, maxMinor: 250_000n }, // 6%, min ₸150, cap ₸2,500
  medical_lab_order: { bps: 600, minMinor: 15_000n, maxMinor: 250_000n },
  dental_lab: { bps: 800 }, // 8%
  shop: { bps: 800 }, // Marketplace standard
  marketplace: { bps: 800 },
  school: { bps: 1000 }, // Academy base; tier overrides remain explicit policy data
  academy: { bps: 1000 },
};

function defaultCommissionPolicy(domain: string) {
  return DEFAULT_COMMISSION_POLICY[String(domain || '').toLowerCase()] || { bps: 1000 };
}

function applyCommissionBounds(amountMinor: bigint, commissionMinor: bigint, policy: { minMinor?: bigint; maxMinor?: bigint }) {
  if (amountMinor <= 0n || commissionMinor <= 0n) return 0n;
  let result = commissionMinor;
  if (policy.minMinor !== undefined && result < policy.minMinor) result = policy.minMinor;
  if (policy.maxMinor !== undefined && result > policy.maxMinor) result = policy.maxMinor;
  return result > amountMinor ? amountMinor : result;
}

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
  return global?.percentBps ?? defaultCommissionPolicy(domain).bps;
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
  const policy = defaultCommissionPolicy(input.domain);
  const bps = await resolveCommissionBps(input.domain, input.sellerId, db, { branchId: input.branchId, organizationId: input.organizationId });
  const commission = applyCommissionBounds(
    input.amountMinor,
    commissionMinor(input.amountMinor, bps),
    policy,
  );
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
      meta: {
        bps,
        commission: commission.toString(),
        net: net.toString(),
        policy: {
          minMinor: policy.minMinor?.toString() ?? null,
          maxMinor: policy.maxMinor?.toString() ?? null,
        },
      } as Prisma.InputJsonValue,
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
