/**
 * Platform revenue-by-source (Revenue model — see docs/SYSTEM_AUDIT.md's
 * "HIDDEN / DEAD" note). bi.service.ts already sums real money movement
 * for its own purposes (MRR from Subscription, clinic revenue from
 * Payment), but nowhere records which of SaaS / Shop / Academy / AI a sale
 * actually came from — `getClinicBI`'s `bySource` split is keyed on
 * `payment.domain`, a raw string, not this enum. This writes one row per
 * real sale, at the two places money actually changes hands for a sale:
 * `recordSaleTx` (marketplace/academy) and clinic subscription activation.
 *
 * `tenantId` is always 'platform': this is a platform-wide ledger, not a
 * per-clinic one (SaaSMetrics uses the same convention).
 */
import type { Prisma, RevenueSource } from '@prisma/client';
import prisma from '../../lib/prisma.js';

/** `recordSaleTx`'s `domain` is a free-form string; this is its only defined vocabulary today. */
export function revenueSourceForDomain(domain: string): RevenueSource {
  if (domain === 'shop') return 'SHOP';
  if (domain === 'school') return 'ACADEMY';
  return 'MARKETPLACE';
}

export interface WriteRevenueInput {
  source: RevenueSource;
  amountMinor: bigint;
  refType?: string;
  refId?: string;
}

export async function writeRevenue(
  input: WriteRevenueInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.revenue.create({
    data: {
      tenantId: 'platform',
      source: input.source,
      amount: input.amountMinor,
      meta: (input.refType || input.refId
        ? { refType: input.refType ?? null, refId: input.refId ?? null }
        : undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface RevenueBySourceRow {
  source: RevenueSource;
  /** Minor units (тиын), as a string so the JSON stays BigInt-safe. */
  amountMinor: string;
  sales: number;
}

export interface RevenueBySourceReport {
  from: string;
  to: string;
  rows: RevenueBySourceRow[];
  totalMinor: string;
  totalSales: number;
}

/**
 * Platform revenue split by where the money came from.
 *
 * The reader this ledger never had. `writeRevenue` has been recording a row
 * per sale since the finance core was built — marketplace, academy and clinic
 * subscription activation all call it — and nothing ever read the table back,
 * so `docs/SYSTEM_MAP.md` listed `Revenue` as "пишется, но никогда не
 * читается". The split it answers (SaaS vs Shop vs Academy) is exactly the
 * one `bi.service.ts::getClinicBI` cannot give: that one keys on
 * `payment.domain`, a free-form string, not this enum.
 *
 * One grouped query, no per-source round-trip.
 */
export async function revenueBySource(range?: { from?: Date; to?: Date }): Promise<RevenueBySourceReport> {
  const to = range?.to ?? new Date();
  // A month back by default: long enough to be a report, short enough that the
  // indexed `date` range stays selective.
  const from = range?.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const grouped = await prisma.revenue.groupBy({
    by: ['source'],
    where: { tenantId: 'platform', date: { gte: from, lte: to } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const rows: RevenueBySourceRow[] = grouped
    .map((g) => ({
      source: g.source,
      amountMinor: String(g._sum.amount ?? 0n),
      sales: g._count._all,
    }))
    .sort((a, b) => (BigInt(b.amountMinor) > BigInt(a.amountMinor) ? 1 : -1));

  const totalMinor = rows.reduce((acc, r) => acc + BigInt(r.amountMinor), 0n);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totalMinor: String(totalMinor),
    totalSales: rows.reduce((acc, r) => acc + r.sales, 0),
  };
}
