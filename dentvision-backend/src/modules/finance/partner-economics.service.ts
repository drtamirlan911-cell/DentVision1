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
  vertical: PartnerVertical;
  version: number;
  effectiveFrom: string;
  percentBps: number;
  minFeeMinor: bigint;
  maxFeeMinor: bigint | null;
  subscriptionMinor: bigint;
  volumeTiers?: VolumeTier[];
}

export interface PartnerEconomicsInput {
  vertical: PartnerVertical;
  partnerId: string;
  grossMinor: bigint;
  monthlyGmvMinor?: bigint;
  paymentCostMinor?: bigint;
  aiCostMinor?: bigint;
  storageCostMinor?: bigint;
  supportCostMinor?: bigint;
  refundReserveMinor?: bigint;
  taxMinor?: bigint;
}

export type EconomicsStatus = 'HEALTHY' | 'LOSS' | 'LOW_MARGIN';

export interface PartnerEconomicsBreakdown {
  vertical: PartnerVertical;
  partnerId: string;
  grossMinor: bigint;
  commissionMinor: bigint;
  partnerRevenueMinor: bigint;
  paymentCostMinor: bigint;
  aiCostMinor: bigint;
  storageCostMinor: bigint;
  supportCostMinor: bigint;
  refundReserveMinor: bigint;
  taxMinor: bigint;
  contributionMarginMinor: bigint;
  contributionMarginBps: number;
  status: EconomicsStatus;
  rule: PartnerEconomicsRule;
}

const CANONICAL_RULES: Record<PartnerVertical, PartnerEconomicsRule> = {
  DIAGNOSTIC_3D: {
    vertical: 'DIAGNOSTIC_3D', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z',
    percentBps: 700, minFeeMinor: 50_000n, maxFeeMinor: 300_000n, subscriptionMinor: 4_990_000n,
  },
  MEDICAL_ANALYSIS: {
    vertical: 'MEDICAL_ANALYSIS', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z',
    percentBps: 600, minFeeMinor: 15_000n, maxFeeMinor: 250_000n, subscriptionMinor: 1_990_000n,
  },
  DENTAL_LAB: {
    vertical: 'DENTAL_LAB', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z',
    percentBps: 800, minFeeMinor: 50_000n, maxFeeMinor: 1_500_000n, subscriptionMinor: 2_990_000n,
    volumeTiers: [
      { upToMinor: 100_000_000n, percentBps: 1000 },
      { upToMinor: 500_000_000n, percentBps: 800 },
      { upToMinor: 1_500_000_000n, percentBps: 700 },
      { upToMinor: 3_000_000_000n, percentBps: 600 },
      { upToMinor: null, percentBps: 500 },
    ],
  },
};

const asJson = (rule: PartnerEconomicsRule, history: unknown[] = []): Prisma.InputJsonValue => ({
  economicsVersion: rule.version,
  effectiveFrom: rule.effectiveFrom,
  minFeeMinor: rule.minFeeMinor.toString(),
  maxFeeMinor: rule.maxFeeMinor?.toString() ?? null,
  subscriptionMinor: rule.subscriptionMinor.toString(),
  volumeTiers: rule.volumeTiers?.map((tier) => ({ upToMinor: tier.upToMinor?.toString() ?? null, percentBps: tier.percentBps })) ?? null,
  history,
});

function fromStoredRule(row: { domain: string; percentBps: number; splitJson: unknown }): PartnerEconomicsRule | null {
  if (!(row.domain in PARTNER_VERTICALS)) return null;
  const vertical = row.domain as PartnerVertical;
  const raw = (row.splitJson || {}) as Record<string, unknown>;
  const toBigInt = (value: unknown, fallback: bigint) => {
    try { return value == null ? fallback : BigInt(String(value)); } catch { return fallback; }
  };
  const tiers = Array.isArray(raw.volumeTiers)
    ? raw.volumeTiers.map((tier) => {
      const t = tier as Record<string, unknown>;
      return { upToMinor: t.upToMinor == null ? null : toBigInt(t.upToMinor, 0n), percentBps: Number(t.percentBps) || 0 };
    })
    : undefined;
  return {
    vertical,
    version: Number(raw.economicsVersion) || 1,
    effectiveFrom: typeof raw.effectiveFrom === 'string' ? raw.effectiveFrom : new Date().toISOString(),
    percentBps: row.percentBps,
    minFeeMinor: toBigInt(raw.minFeeMinor, CANONICAL_RULES[vertical].minFeeMinor),
    maxFeeMinor: raw.maxFeeMinor == null ? CANONICAL_RULES[vertical].maxFeeMinor : toBigInt(raw.maxFeeMinor, CANONICAL_RULES[vertical].maxFeeMinor ?? 0n),
    subscriptionMinor: toBigInt(raw.subscriptionMinor, CANONICAL_RULES[vertical].subscriptionMinor),
    volumeTiers: tiers,
  };
}

/**
 * Bootstrap/read the canonical policy through the existing CommissionRule table.
 * We deliberately reuse that table rather than introduce a second commission
 * registry. `splitJson` carries the additional floor/cap/version metadata while
 * completed transactions snapshot the exact rule in their own `meta`.
 */
export async function getPartnerEconomicsRule(
  vertical: PartnerVertical,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PartnerEconomicsRule> {
  const canonical = CANONICAL_RULES[vertical];
  const existing = await db.commissionRule.findFirst({ where: { domain: vertical, scopeId: null } });
  if (existing) return fromStoredRule(existing) || canonical;

  const created = await db.commissionRule.create({
    data: {
      domain: vertical,
      scopeId: null,
      percentBps: canonical.percentBps,
      splitJson: asJson(canonical),
    },
  });
  return fromStoredRule(created) || canonical;
}

function selectBps(rule: PartnerEconomicsRule, monthlyGmvMinor: bigint): number {
  if (!rule.volumeTiers?.length) return rule.percentBps;
  for (const tier of rule.volumeTiers) {
    if (tier.upToMinor == null || monthlyGmvMinor <= tier.upToMinor) return tier.percentBps;
  }
  return rule.percentBps;
}

export function calculatePartnerEconomics(input: PartnerEconomicsInput, rule: PartnerEconomicsRule): PartnerEconomicsBreakdown {
  if (input.grossMinor < 0n) throw new Error('grossMinor must be non-negative');
  const monthlyGmvMinor = input.monthlyGmvMinor ?? input.grossMinor;
  const bps = selectBps(rule, monthlyGmvMinor);
  const percentageFee = (input.grossMinor * BigInt(bps)) / 10_000n;
  const commissionMinor = rule.maxFeeMinor == null
    ? percentageFee < rule.minFeeMinor ? rule.minFeeMinor : percentageFee
    : percentageFee < rule.minFeeMinor
      ? rule.minFeeMinor
      : percentageFee > rule.maxFeeMinor
        ? rule.maxFeeMinor
        : percentageFee;
  const partnerRevenueMinor = input.grossMinor - commissionMinor;
  const paymentCostMinor = input.paymentCostMinor ?? 0n;
  const aiCostMinor = input.aiCostMinor ?? 0n;
  const storageCostMinor = input.storageCostMinor ?? 0n;
  const supportCostMinor = input.supportCostMinor ?? 0n;
  const refundReserveMinor = input.refundReserveMinor ?? 0n;
  const taxMinor = input.taxMinor ?? 0n;
  const contributionMarginMinor = commissionMinor - paymentCostMinor - aiCostMinor - storageCostMinor - supportCostMinor - refundReserveMinor - taxMinor;
  const contributionMarginBps = input.grossMinor === 0n ? 0 : Number((contributionMarginMinor * 10_000n) / input.grossMinor);
  const status: EconomicsStatus = contributionMarginMinor < 0n ? 'LOSS' : contributionMarginMinor === 0n ? 'LOW_MARGIN' : 'HEALTHY';

  return {
    vertical: input.vertical,
    partnerId: input.partnerId,
    grossMinor: input.grossMinor,
    commissionMinor,
    partnerRevenueMinor,
    paymentCostMinor,
    aiCostMinor,
    storageCostMinor,
    supportCostMinor,
    refundReserveMinor,
    taxMinor,
    contributionMarginMinor,
    contributionMarginBps,
    status,
    rule: { ...rule, percentBps: bps },
  };
}

/**
 * Persist one economics operation as a durable, idempotent Transaction record.
 * The deterministic id makes concurrent retries converge on the same record.
 * No wallet balances are touched: this is an economics/audit ledger, not a
 * second cash ledger. Actual collection/payout remains in Settlement/Wallet.
 */
export async function recordPartnerEconomics(
  input: PartnerEconomicsInput & { operationId: string },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await db.transaction.findFirst({ where: { type: 'partner_economics', refType: input.vertical, refId: input.operationId } });
  if (existing) return existing;

  const monthlyGmvMinor = input.monthlyGmvMinor ?? await monthlyPartnerGmv(input.vertical, input.partnerId, new Date(), db);
  const rule = await getPartnerEconomicsRule(input.vertical, db);
  const breakdown = calculatePartnerEconomics({ ...input, monthlyGmvMinor }, rule);
  const id = createHash('sha256').update(`partner-economics:${input.vertical}:${input.operationId}`).digest('hex').slice(0, 32);
  const meta = {
    kind: 'partner_economics',
    operationId: input.operationId,
    vertical: input.vertical,
    partnerId: input.partnerId,
    economicsVersion: breakdown.rule.version,
    rule: {
      percentBps: breakdown.rule.percentBps,
      minFeeMinor: breakdown.rule.minFeeMinor.toString(),
      maxFeeMinor: breakdown.rule.maxFeeMinor?.toString() ?? null,
      subscriptionMinor: breakdown.rule.subscriptionMinor.toString(),
      effectiveFrom: breakdown.rule.effectiveFrom,
    },
    commissionMinor: breakdown.commissionMinor.toString(),
    partnerRevenueMinor: breakdown.partnerRevenueMinor.toString(),
    contributionMarginMinor: breakdown.contributionMarginMinor.toString(),
    contributionMarginBps: breakdown.contributionMarginBps,
    status: breakdown.status,
    costs: {
      payment: breakdown.paymentCostMinor.toString(), ai: breakdown.aiCostMinor.toString(),
      storage: breakdown.storageCostMinor.toString(), support: breakdown.supportCostMinor.toString(),
      refundReserve: breakdown.refundReserveMinor.toString(), tax: breakdown.taxMinor.toString(),
    },
  } satisfies Prisma.InputJsonValue;

  try {
    return await db.transaction.create({
      data: {
        id,
        type: 'partner_economics',
        status: 'completed',
        amount: breakdown.grossMinor,
        currency: 'KZT',
        refType: input.vertical,
        refId: input.operationId,
        meta,
      },
    });
  } catch (error) {
    const raced = await db.transaction.findFirst({ where: { type: 'partner_economics', refType: input.vertical, refId: input.operationId } });
    if (raced) return raced;
    throw error;
  }
}

export async function monthlyPartnerGmv(
  vertical: PartnerVertical,
  partnerId: string,
  at = new Date(),
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<bigint> {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const rows = await db.transaction.findMany({
    where: { type: 'partner_economics', refType: vertical, createdAt: { gte: start } },
    select: { amount: true, meta: true },
  });
  return rows.reduce((sum, row) => {
    const meta = (row.meta || {}) as Record<string, unknown>;
    return meta.partnerId === partnerId ? sum + row.amount : sum;
  }, 0n);
}

export function canonicalPartnerEconomicsRules(): PartnerEconomicsRule[] {
  return Object.values(CANONICAL_RULES).map((rule) => ({ ...rule, volumeTiers: rule.volumeTiers?.map((tier) => ({ ...tier })) }));
}
