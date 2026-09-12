import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { serializeBigInt } from '../../lib/money.js';
import { canonicalPartnerEconomicsRules, PARTNER_VERTICALS, type PartnerVertical } from './partner-economics.service.js';

export const partnerEconomicsRouter = Router();
partnerEconomicsRouter.use(authenticate);
partnerEconomicsRouter.use(requirePermission('finance.manage'));

const VERTICALS = new Set<string>(Object.values(PARTNER_VERTICALS));

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' || !value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function sumMetaMinor(rows: Array<{ amount: bigint; meta: unknown }>, field: 'commissionMinor' | 'contributionMarginMinor' | 'partnerRevenueMinor') {
  return rows.reduce((sum, row) => {
    const meta = (row.meta || {}) as Record<string, unknown>;
    try { return sum + BigInt(String(meta[field] ?? '0')); } catch { return sum; }
  }, 0n);
}

/**
 * Finance Hub economics summary. Reads only immutable partner_economics ledger
 * snapshots; it never recalculates historical transactions with today's rules.
 */
partnerEconomicsRouter.get('/summary', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const from = parseDate(req.query.from, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const to = parseDate(req.query.to, now);
    const vertical = typeof req.query.vertical === 'string' && VERTICALS.has(req.query.vertical)
      ? req.query.vertical as PartnerVertical
      : undefined;

    const rows = await prisma.transaction.findMany({
      where: {
        type: 'partner_economics',
        createdAt: { gte: from, lte: to },
        ...(vertical ? { refType: vertical } : {}),
      },
      select: { id: true, amount: true, currency: true, refType: true, refId: true, status: true, meta: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const groups = Object.values(PARTNER_VERTICALS).map((name) => {
      const scoped = rows.filter((row) => row.refType === name);
      const grossMinor = scoped.reduce((sum, row) => sum + row.amount, 0n);
      const commissionMinor = sumMetaMinor(scoped, 'commissionMinor');
      const partnerRevenueMinor = sumMetaMinor(scoped, 'partnerRevenueMinor');
      const contributionMarginMinor = sumMetaMinor(scoped, 'contributionMarginMinor');
      const takeRateBps = grossMinor === 0n ? 0 : Number((commissionMinor * 10_000n) / grossMinor);
      const marginBps = grossMinor === 0n ? 0 : Number((contributionMarginMinor * 10_000n) / grossMinor);
      const lossCount = scoped.filter((row) => ((row.meta || {}) as Record<string, unknown>).status === 'LOSS').length;
      const lowMarginCount = scoped.filter((row) => ((row.meta || {}) as Record<string, unknown>).status === 'LOW_MARGIN').length;
      const status = lossCount > 0 || contributionMarginMinor < 0n ? 'LOSS' : lowMarginCount > 0 || contributionMarginMinor === 0n ? 'LOW_MARGIN' : 'HEALTHY';
      return { vertical: name, operations: scoped.length, grossMinor, commissionMinor, partnerRevenueMinor, contributionMarginMinor, takeRateBps, marginBps, lossCount, lowMarginCount, status };
    }).filter((group) => !vertical || group.vertical === vertical);

    const grossMinor = rows.reduce((sum, row) => sum + row.amount, 0n);
    const commissionMinor = sumMetaMinor(rows, 'commissionMinor');
    const partnerRevenueMinor = sumMetaMinor(rows, 'partnerRevenueMinor');
    const contributionMarginMinor = sumMetaMinor(rows, 'contributionMarginMinor');

    return res.json({ ok: true, data: serializeBigInt({
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        operations: rows.length,
        grossMinor,
        commissionMinor,
        partnerRevenueMinor,
        contributionMarginMinor,
        takeRateBps: grossMinor === 0n ? 0 : Number((commissionMinor * 10_000n) / grossMinor),
        marginBps: grossMinor === 0n ? 0 : Number((contributionMarginMinor * 10_000n) / grossMinor),
      },
      byVertical: groups,
      rules: canonicalPartnerEconomicsRules(),
    }) } satisfies ApiResponse);
  } catch (error) {
    console.error('[finance] partner-economics summary', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать economics summary' } satisfies ApiResponse);
  }
});

/** Immutable transaction-level snapshots for reconciliation/drill-down. */
partnerEconomicsRouter.get('/transactions', async (req: AuthRequest, res) => {
  try {
    const take = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const vertical = typeof req.query.vertical === 'string' && VERTICALS.has(req.query.vertical)
      ? req.query.vertical as PartnerVertical
      : undefined;
    const rows = await prisma.transaction.findMany({
      where: { type: 'partner_economics', ...(vertical ? { refType: vertical } : {}) },
      select: { id: true, amount: true, currency: true, refType: true, refId: true, status: true, meta: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return res.json({ ok: true, data: serializeBigInt(rows) } satisfies ApiResponse);
  } catch (error) {
    console.error('[finance] partner-economics transactions', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить economics transactions' } satisfies ApiResponse);
  }
});

export default partnerEconomicsRouter;
