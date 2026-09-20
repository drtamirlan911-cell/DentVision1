import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';

export const PARTNER_VERTICALS = {
  DIAGNOSTIC_3D: 'DIAGNOSTIC_3D',
  MEDICAL_ANALYSIS: 'MEDICAL_ANALYSIS',
  DENTAL_LAB: 'DENTAL_LAB',
} as const;

export type PartnerVertical = (typeof PARTNER_VERTICALS)[keyof typeof PARTNER_VERTICALS];
type VolumeTier = { upToMinor: bigint | null; percentBps: number };

export interface PartnerEconomicsRule {
  vertical: PartnerVertical; version: number; effectiveFrom: string; percentBps: number;
  minFeeMinor: bigint; maxFeeMinor: bigint | null; subscriptionMinor: bigint; volumeTiers?: VolumeTier[];
}
export interface PartnerEconomicsInput {
  vertical: PartnerVertical; partnerId: string; grossMinor: bigint; monthlyGmvMinor?: bigint;
  paymentCostMinor?: bigint; aiCostMinor?: bigint; storageCostMinor?: bigint;
  supportCostMinor?: bigint; refundReserveMinor?: bigint; taxMinor?: bigint; branchId?: string | null;
}
export type EconomicsStatus = 'HEALTHY' | 'LOSS' | 'LOW_MARGIN';
export interface PartnerEconomicsBreakdown {
  vertical: PartnerVertical; partnerId: string; grossMinor: bigint; commissionMinor: bigint;
  partnerRevenueMinor: bigint; paymentCostMinor: bigint; aiCostMinor: bigint; storageCostMinor: bigint;
  supportCostMinor: bigint; refundReserveMinor: bigint; taxMinor: bigint; contributionMarginMinor: bigint;
  contributionMarginBps: number; status: EconomicsStatus; rule: PartnerEconomicsRule;
}

const CANONICAL_RULES: Record<PartnerVertical, PartnerEconomicsRule> = {
  DIAGNOSTIC_3D: { vertical: 'DIAGNOSTIC_3D', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z', percentBps: 700, minFeeMinor: 50_000n, maxFeeMinor: 300_000n, subscriptionMinor: 4_990_000n },
  MEDICAL_ANALYSIS: { vertical: 'MEDICAL_ANALYSIS', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z', percentBps: 600, minFeeMinor: 15_000n, maxFeeMinor: 250_000n, subscriptionMinor: 1_990_000n },
  DENTAL_LAB: {
    vertical: 'DENTAL_LAB', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z', percentBps: 800,
    minFeeMinor: 50_000n, maxFeeMinor: 1_500_000n, subscriptionMinor: 2_990_000n,
    volumeTiers: [
      { upToMinor: 100_000_000n, percentBps: 1000 }, { upToMinor: 500_000_000n, percentBps: 800 },
      { upToMinor: 1_500_000_000n, percentBps: 700 }, { upToMinor: 3_000_000_000n, percentBps: 600 },
      { upToMinor: null, percentBps: 500 },
    ],
  },
};

const asJson = (rule: PartnerEconomicsRule, history: Prisma.InputJsonValue[] = []): Prisma.InputJsonValue => ({
  economicsVersion: rule.version, effectiveFrom: rule.effectiveFrom,
  minFeeMinor: rule.minFeeMinor.toString(), maxFeeMinor: rule.maxFeeMinor?.toString() ?? null,
  subscriptionMinor: rule.subscriptionMinor.toString(),
  volumeTiers: rule.volumeTiers?.map((tier) => ({ upToMinor: tier.upToMinor?.toString() ?? null, percentBps: tier.percentBps })) ?? null,
  history,
});

function fromStoredRule(row: { domain: string; percentBps: number; splitJson: unknown }): PartnerEconomicsRule | null {
  if (!(row.domain in PARTNER_VERTICALS)) return null;
  const vertical = row.domain as PartnerVertical;
  const raw = (row.splitJson || {}) as Record<string, unknown>;
  const toBigInt = (value: unknown, fallback: bigint) => { try { return value == null ? fallback : BigInt(String(value)); } catch { return fallback; } };
  const tiers = Array.isArray(raw.volumeTiers) ? raw.volumeTiers.map((tier) => {
    const t = tier as Record<string, unknown>;
    return { upToMinor: t.upToMinor == null ? null : toBigInt(t.upToMinor, 0n), percentBps: Number(t.percentBps) || 0 };
  }) : undefined;
  return {
    vertical, version: Number(raw.economicsVersion) || 1,
    effectiveFrom: typeof raw.effectiveFrom === 'string' ? raw.effectiveFrom : new Date().toISOString(),
    percentBps: row.percentBps,
    minFeeMinor: toBigInt(raw.minFeeMinor, CANONICAL_RULES[vertical].minFeeMinor),
    maxFeeMinor: raw.maxFeeMinor == null ? CANONICAL_RULES[vertical].maxFeeMinor : toBigInt(raw.maxFeeMinor, CANONICAL_RULES[vertical].maxFeeMinor ?? 0n),
    subscriptionMinor: toBigInt(raw.subscriptionMinor, CANONICAL_RULES[vertical].subscriptionMinor), volumeTiers: tiers,
  };
}

export async function getPartnerEconomicsRule(vertical: PartnerVertical, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<PartnerEconomicsRule> {
  const canonical = CANONICAL_RULES[vertical];
  // CommissionRule has a nullable scopeId, so a normal find-or-create is not
  // concurrency-safe in PostgreSQL: UNIQUE constraints allow multiple NULLs.
  // Serialize initialization per vertical without changing the existing schema.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dentvision.partner-economics:${vertical}`}))`;
  const existing = await db.commissionRule.findFirst({ where: { domain: vertical, scopeId: null } });
  if (existing) return fromStoredRule(existing) || canonical;
  const created = await db.commissionRule.create({ data: { domain: vertical, scopeId: null, percentBps: canonical.percentBps, splitJson: asJson(canonical) } });
  return fromStoredRule(created) || canonical;
}
function selectBps(rule: PartnerEconomicsRule, monthlyGmvMinor: bigint): number {
  if (!rule.volumeTiers?.length) return rule.percentBps;
  for (const tier of rule.volumeTiers) if (tier.upToMinor == null || monthlyGmvMinor <= tier.upToMinor) return tier.percentBps;
  return rule.percentBps;
}
export function calculatePartnerEconomics(input: PartnerEconomicsInput, rule: PartnerEconomicsRule): PartnerEconomicsBreakdown {
  if (input.grossMinor < 0n) throw new Error('grossMinor must be non-negative');
  const monthlyGmvMinor = input.monthlyGmvMinor ?? input.grossMinor;
  const bps = selectBps(rule, monthlyGmvMinor);
  const percentageFee = (input.grossMinor * BigInt(bps)) / 10_000n;
  const commissionMinor = rule.maxFeeMinor == null ? (percentageFee < rule.minFeeMinor ? rule.minFeeMinor : percentageFee) : percentageFee < rule.minFeeMinor ? rule.minFeeMinor : percentageFee > rule.maxFeeMinor ? rule.maxFeeMinor : percentageFee;
  const partnerRevenueMinor = input.grossMinor - commissionMinor;
  const paymentCostMinor = input.paymentCostMinor ?? 0n, aiCostMinor = input.aiCostMinor ?? 0n, storageCostMinor = input.storageCostMinor ?? 0n;
  const supportCostMinor = input.supportCostMinor ?? 0n, refundReserveMinor = input.refundReserveMinor ?? 0n, taxMinor = input.taxMinor ?? 0n;
  const contributionMarginMinor = commissionMinor - paymentCostMinor - aiCostMinor - storageCostMinor - supportCostMinor - refundReserveMinor - taxMinor;
  const contributionMarginBps = input.grossMinor === 0n ? 0 : Number((contributionMarginMinor * 10_000n) / input.grossMinor);
  const status: EconomicsStatus = contributionMarginMinor < 0n ? 'LOSS' : contributionMarginMinor === 0n ? 'LOW_MARGIN' : 'HEALTHY';
  return { vertical: input.vertical, partnerId: input.partnerId, grossMinor: input.grossMinor, commissionMinor, partnerRevenueMinor, paymentCostMinor, aiCostMinor, storageCostMinor, supportCostMinor, refundReserveMinor, taxMinor, contributionMarginMinor, contributionMarginBps, status, rule: { ...rule, percentBps: bps } };
}

export async function recordPartnerEconomics(input: PartnerEconomicsInput & { operationId: string }, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const existing = await db.transaction.findFirst({ where: { type: 'partner_economics', refType: input.vertical, refId: input.operationId } });
  if (existing) return existing;
  const monthlyGmvMinor = input.monthlyGmvMinor ?? await monthlyPartnerGmv(input.vertical, input.partnerId, new Date(), db);
  const rule = await getPartnerEconomicsRule(input.vertical, db);
  const breakdown = calculatePartnerEconomics({ ...input, monthlyGmvMinor }, rule);
  const id = createHash('sha256').update(`partner-economics:${input.vertical}:${input.operationId}`).digest('hex').slice(0, 32);
  const meta = {
    kind: 'partner_economics', operationId: input.operationId, vertical: input.vertical, partnerId: input.partnerId,
    economicsVersion: breakdown.rule.version,
    rule: { percentBps: breakdown.rule.percentBps, minFeeMinor: breakdown.rule.minFeeMinor.toString(), maxFeeMinor: breakdown.rule.maxFeeMinor?.toString() ?? null, subscriptionMinor: breakdown.rule.subscriptionMinor.toString(), effectiveFrom: breakdown.rule.effectiveFrom },
    commissionMinor: breakdown.commissionMinor.toString(), partnerRevenueMinor: breakdown.partnerRevenueMinor.toString(), contributionMarginMinor: breakdown.contributionMarginMinor.toString(), contributionMarginBps: breakdown.contributionMarginBps, status: breakdown.status,
    costs: { payment: breakdown.paymentCostMinor.toString(), ai: breakdown.aiCostMinor.toString(), storage: breakdown.storageCostMinor.toString(), support: breakdown.supportCostMinor.toString(), refundReserve: breakdown.refundReserveMinor.toString(), tax: breakdown.taxMinor.toString() },
    branchId: input.branchId ?? null,
  } satisfies Prisma.InputJsonValue;
  try {
    // Serialize wallet initialization/update for each owner. The wallet unique
    // key is a three-column key and the read→create sequence otherwise races
    // when the first two operations for a partner arrive concurrently.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'dentvision.partner-wallet:GATEWAY:system:KZT'}))`;
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dentvision.partner-wallet:PARTNER:${input.partnerId}:KZT`}))`;
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'dentvision.partner-wallet:PLATFORM:system:KZT'}))`;
    const gateway = await db.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: 'GATEWAY', ownerId: 'system', currency: 'KZT' } } })
      ?? await db.wallet.create({ data: { ownerType: 'GATEWAY', ownerId: 'system', currency: 'KZT' } });
    const partner = await db.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: 'PARTNER', ownerId: input.partnerId, currency: 'KZT' } } })
      ?? await db.wallet.create({ data: { ownerType: 'PARTNER', ownerId: input.partnerId, currency: 'KZT' } });
    const platform = await db.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: 'PLATFORM', ownerId: 'system', currency: 'KZT' } } })
      ?? await db.wallet.create({ data: { ownerType: 'PLATFORM', ownerId: 'system', currency: 'KZT' } });
    const transaction = await db.transaction.create({
      data: {
        id, type: 'partner_economics', status: 'completed', amount: breakdown.grossMinor, currency: 'KZT',
        refType: input.vertical, refId: input.operationId, meta,
        ledgerEntries: {
          create: [
            { walletId: gateway.id, direction: 'debit', amount: breakdown.grossMinor },
            { walletId: partner.id, direction: 'credit', amount: breakdown.partnerRevenueMinor },
            { walletId: platform.id, direction: 'credit', amount: breakdown.commissionMinor },
          ],
        },
      },
      include: { ledgerEntries: true },
    });
    await db.wallet.update({ where: { id: gateway.id }, data: { balance: { decrement: breakdown.grossMinor } } });
    await db.wallet.update({ where: { id: partner.id }, data: { balance: { increment: breakdown.partnerRevenueMinor } } });
    await db.wallet.update({ where: { id: platform.id }, data: { balance: { increment: breakdown.commissionMinor } } });
    return transaction;
  } catch (error) {
    const raced = await db.transaction.findFirst({ where: { type: 'partner_economics', refType: input.vertical, refId: input.operationId } });
    if (raced) return raced;
    throw error;
  }
}
export async function monthlyPartnerGmv(vertical: PartnerVertical, partnerId: string, at = new Date(), db: Prisma.TransactionClient | typeof prisma = prisma): Promise<bigint> {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const rows = await db.transaction.findMany({ where: { type: 'partner_economics', refType: vertical, createdAt: { gte: start } }, select: { amount: true, meta: true } });
  return rows.reduce((sum, row) => { const meta = (row.meta || {}) as Record<string, unknown>; return meta.partnerId === partnerId ? sum + row.amount : sum; }, 0n);
}
export interface PartnerEconomicsReconciliationRow {
  transactionId: string;
  vertical: PartnerVertical;
  operationId: string;
  partnerId: string;
  grossMinor: bigint;
  commissionMinor: bigint;
  partnerRevenueMinor: bigint;
  ledgerDebitMinor: bigint;
  ledgerCreditMinor: bigint;
  balanced: boolean;
  amountsMatchSnapshot: boolean;
  ruleSnapshotIntact: boolean;
}

export async function reconcilePartnerEconomics(
  opts: { from?: Date; to?: Date; partnerId?: string; vertical?: PartnerVertical } = {},
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ rows: PartnerEconomicsReconciliationRow[]; discrepancies: number }> {
  const where: Prisma.TransactionWhereInput = { type: 'partner_economics' };
  if (opts.from || opts.to) where.createdAt = { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) };
  if (opts.vertical) where.refType = opts.vertical;
  if (opts.partnerId) where.meta = { path: ['partnerId'], equals: opts.partnerId };
  const transactions = await db.transaction.findMany({ where, include: { ledgerEntries: { include: { wallet: { select: { ownerType: true, ownerId: true } } } } }, orderBy: { createdAt: 'asc' } });
  const rows = transactions.map((transaction) => {
    const meta = (transaction.meta || {}) as Record<string, unknown>;
    const grossMinor = BigInt(transaction.amount);
    const commissionMinor = BigInt(String(meta.commissionMinor ?? '0'));
    const partnerRevenueMinor = BigInt(String(meta.partnerRevenueMinor ?? '0'));
    const ledgerDebitMinor = transaction.ledgerEntries.filter((e) => e.direction === 'debit').reduce((s, e) => s + BigInt(e.amount), 0n);
    const ledgerCreditMinor = transaction.ledgerEntries.filter((e) => e.direction === 'credit').reduce((s, e) => s + BigInt(e.amount), 0n);
    const balanced = ledgerDebitMinor === ledgerCreditMinor && ledgerDebitMinor === grossMinor;
    const amountsMatchSnapshot = ledgerCreditMinor === partnerRevenueMinor + commissionMinor;
    const storedRule = (meta.rule || {}) as Record<string, unknown>;
    const ruleSnapshotIntact =
      Number.isInteger(Number(meta.economicsVersion)) &&
      Number(meta.economicsVersion) > 0 &&
      Number.isInteger(Number(meta.economicsVersion)) &&
      Number.isFinite(Number(storedRule.percentBps)) &&
      typeof storedRule.effectiveFrom === 'string' &&
      storedRule.effectiveFrom.length > 0 &&
      storedRule.minFeeMinor !== undefined &&
      storedRule.subscriptionMinor !== undefined;
    return { transactionId: transaction.id, vertical: transaction.refType as PartnerVertical, operationId: transaction.refId || '', partnerId: String(meta.partnerId || ''), grossMinor, commissionMinor, partnerRevenueMinor, ledgerDebitMinor, ledgerCreditMinor, balanced, amountsMatchSnapshot, ruleSnapshotIntact };
  });
  return { rows, discrepancies: rows.filter((row) => !row.balanced || !row.amountsMatchSnapshot || !row.ruleSnapshotIntact).length };
}

export function canonicalPartnerEconomicsRules(): PartnerEconomicsRule[] {
  return Object.values(CANONICAL_RULES).map((rule) => ({ ...rule, volumeTiers: rule.volumeTiers?.map((tier) => ({ ...tier })) }));
}

export interface PartnerEconomicsDashboard {
  period: { from: Date | null; to: Date | null };
  byVertical: Array<{
    vertical: PartnerVertical;
    operations: number;
    grossMinor: bigint;
    commissionMinor: bigint;
    partnerPayoutMinor: bigint;
    costMinor: bigint;
    contributionMarginMinor: bigint;
    contributionMarginBps: number;
    discrepancyCount: number;
    lowMarginCount: number;
    lossCount: number;
  }>;
  alerts: Array<{ type: 'DISCREPANCY' | 'LOW_MARGIN' | 'LOSS'; vertical: PartnerVertical; transactionId: string; operationId: string }>;
}

export function buildPartnerEconomicsDashboard(
  rows: PartnerEconomicsTransparencyRow[],
  period: { from: Date | null; to: Date | null },
): PartnerEconomicsDashboard {
  const byVertical = (Object.values(PARTNER_VERTICALS) as PartnerVertical[]).map((vertical) => {
    const scoped = rows.filter((row) => row.vertical === vertical);
    const grossMinor = scoped.reduce((s, r) => s + r.grossMinor, 0n);
    const commissionMinor = scoped.reduce((s, r) => s + r.commissionMinor, 0n);
    const partnerPayoutMinor = scoped.reduce((s, r) => s + r.partnerPayoutMinor, 0n);
    const costMinor = scoped.reduce((s, r) => s + r.costMinor, 0n);
    const contributionMarginMinor = scoped.reduce((s, r) => s + r.contributionMarginMinor, 0n);
    return {
      vertical, operations: scoped.length, grossMinor, commissionMinor, partnerPayoutMinor, costMinor,
      contributionMarginMinor,
      contributionMarginBps: grossMinor === 0n ? 0 : Number((contributionMarginMinor * 10_000n) / grossMinor),
      discrepancyCount: scoped.filter((r) => r.grossMinor !== r.commissionMinor + r.partnerPayoutMinor || r.contributionMarginMinor !== r.commissionMinor - r.costMinor).length,
      lowMarginCount: scoped.filter((r) => r.status === 'LOW_MARGIN').length,
      lossCount: scoped.filter((r) => r.status === 'LOSS').length,
    };
  });
  const alerts = rows.flatMap((row) => {
    const out: PartnerEconomicsDashboard['alerts'] = [];
    if (row.grossMinor !== row.commissionMinor + row.partnerPayoutMinor || row.contributionMarginMinor !== row.commissionMinor - row.costMinor) out.push({ type: 'DISCREPANCY', vertical: row.vertical, transactionId: row.transactionId, operationId: row.operationId });
    if (row.status === 'LOW_MARGIN') out.push({ type: 'LOW_MARGIN', vertical: row.vertical, transactionId: row.transactionId, operationId: row.operationId });
    if (row.status === 'LOSS') out.push({ type: 'LOSS', vertical: row.vertical, transactionId: row.transactionId, operationId: row.operationId });
    return out;
  });
  return { period, byVertical, alerts };
}


export interface PartnerEconomicsTransparencyRow {
  transactionId: string;
  vertical: PartnerVertical;
  partnerId: string;
  branchId: string | null;
  operationId: string;
  grossMinor: bigint;
  commissionMinor: bigint;
  partnerPayoutMinor: bigint;
  costMinor: bigint;
  contributionMarginMinor: bigint;
  contributionMarginBps: number;
  status: EconomicsStatus;
  economicsVersion: number;
}

export async function getPartnerEconomicsTransparency(
  opts: { from?: Date; to?: Date; vertical?: PartnerVertical; partnerId?: string; branchId?: string } = {},
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{
  period: { from: Date | null; to: Date | null };
  totals: Omit<PartnerEconomicsTransparencyRow, 'transactionId' | 'vertical' | 'partnerId' | 'branchId' | 'operationId' | 'status' | 'economicsVersion'> & { operations: number; costMinor: bigint };
  rows: PartnerEconomicsTransparencyRow[];
  discrepancies: number;
}> {
  const where: Prisma.TransactionWhereInput = { type: 'partner_economics' };
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lt: opts.to } : {}),
    };
  }
  if (opts.vertical) where.refType = opts.vertical;
  if (opts.partnerId) where.meta = { path: ['partnerId'], equals: opts.partnerId };
  const transactions = await db.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true, refType: true, refId: true, meta: true, ledgerEntries: { select: { direction: true, amount: true } } },
  });

  const rows = transactions.map((transaction): PartnerEconomicsTransparencyRow => {
    const meta = (transaction.meta || {}) as Record<string, unknown>;
    const cost = (meta.costs || {}) as Record<string, unknown>;
    const costMinor = ['payment', 'ai', 'storage', 'support', 'refundReserve', 'tax'].reduce((sum, key) => {
      try { return sum + BigInt(String(cost[key] ?? '0')); } catch { return sum; }
    }, 0n);
    const grossMinor = BigInt(transaction.amount);
    const commissionMinor = BigInt(String(meta.commissionMinor ?? '0'));
    const partnerPayoutMinor = BigInt(String(meta.partnerRevenueMinor ?? '0'));
    const contributionMarginMinor = BigInt(String(meta.contributionMarginMinor ?? (commissionMinor - costMinor)));
    const contributionMarginBps = grossMinor === 0n ? 0 : Number((contributionMarginMinor * 10_000n) / grossMinor);
    const branchId = typeof meta.branchId === 'string' ? meta.branchId : null;
    const status = meta.status === 'LOSS' || meta.status === 'LOW_MARGIN' ? meta.status : 'HEALTHY';
    const economicsVersion = Number(meta.economicsVersion) || 1;
    return {
      transactionId: transaction.id,
      vertical: transaction.refType as PartnerVertical,
      partnerId: String(meta.partnerId || ''),
      branchId,
      operationId: transaction.refId || String(meta.operationId || ''),
      grossMinor,
      commissionMinor,
      partnerPayoutMinor,
      costMinor,
      contributionMarginMinor,
      contributionMarginBps,
      status,
      economicsVersion,
    };
  }).filter((row) => !opts.branchId || row.branchId === opts.branchId);

  const totals = rows.reduce((acc, row) => ({
    operations: acc.operations + 1,
    grossMinor: acc.grossMinor + row.grossMinor,
    commissionMinor: acc.commissionMinor + row.commissionMinor,
    partnerPayoutMinor: acc.partnerPayoutMinor + row.partnerPayoutMinor,
    costMinor: acc.costMinor + row.costMinor,
    contributionMarginMinor: acc.contributionMarginMinor + row.contributionMarginMinor,
    contributionMarginBps: 0,
  }), { operations: 0, grossMinor: 0n, commissionMinor: 0n, partnerPayoutMinor: 0n, costMinor: 0n, contributionMarginMinor: 0n, contributionMarginBps: 0 });
  totals.contributionMarginBps = totals.grossMinor === 0n ? 0 : Number((totals.contributionMarginMinor * 10_000n) / totals.grossMinor);

  const discrepancies = rows.filter((row) => row.grossMinor !== row.commissionMinor + row.partnerPayoutMinor || row.contributionMarginMinor !== row.commissionMinor - row.costMinor).length;
  return {
    period: { from: opts.from ?? null, to: opts.to ?? null },
    totals,
    rows,
    discrepancies,
  };
}
