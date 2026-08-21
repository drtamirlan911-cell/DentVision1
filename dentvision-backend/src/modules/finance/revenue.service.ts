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
