import { Router } from 'express';
import { PartnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Partner Program (Phase 11, DENTVISION_V2_PLATFORM_EXTENSIONS_PLAN.md §5).
// Manages manufacturers/distributors/academies/labs with tiers, KPI, SLA and
// co-marketing. Tier commission overrides plug into Finance's CommissionRule.
export const partnersRouter = Router();

partnersRouter.use(authenticate);

// Maps a partner to the Finance domain used for its commission override.
function domainForRefType(refType: string): string {
  return refType === 'academy' ? 'school' : 'shop';
}

// ─── Tiers ───
partnersRouter.post('/tiers', requirePermission('partner.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, commissionBps, minKpiJson, benefitsJson } = req.body || {};
    if (!name || commissionBps === undefined) {
      return res.status(400).json({ ok: false, error: 'name и commissionBps обязательны' } satisfies ApiResponse);
    }
    const tier = await prisma.partnerTier.upsert({
      where: { name },
      create: { name, commissionBps, minKpiJson: minKpiJson ?? undefined, benefitsJson: benefitsJson ?? undefined },
      update: { commissionBps, minKpiJson: minKpiJson ?? undefined, benefitsJson: benefitsJson ?? undefined },
    });
    return res.status(201).json({ ok: true, data: tier } satisfies ApiResponse);
  } catch (error) {
    console.error('Create tier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании уровня' } satisfies ApiResponse);
  }
});

// ─── Partners ───
partnersRouter.get('/', async (req: AuthRequest, res) => {
  const partners = await prisma.partner.findMany({
    include: { tier: true, _count: { select: { kpis: true, slas: true, campaigns: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return res.json({ ok: true, data: partners } satisfies ApiResponse);
});

partnersRouter.post('/', requirePermission('partner.manage'), async (req: AuthRequest, res) => {
  try {
    const { type, refType, refId } = req.body || {};
    if (!type || !(type in PartnerType) || !refType || !refId) {
      return res.status(400).json({ ok: false, error: 'type, refType и refId обязательны' } satisfies ApiResponse);
    }
    const partner = await prisma.partner.create({ data: { type, refType, refId } });
    return res.status(201).json({ ok: true, data: partner } satisfies ApiResponse);
  } catch (error) {
    console.error('Create partner error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании партнёра' } satisfies ApiResponse);
  }
});

// Assign a tier → applies the tier's commission as a per-scope override in Finance.
partnersRouter.post('/:id/tier', requirePermission('partner.manage'), async (req: AuthRequest, res) => {
  try {
    const { tierId } = req.body || {};
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id as string } });
    if (!partner) {
      return res.status(404).json({ ok: false, error: 'Партнёр не найден' } satisfies ApiResponse);
    }
    const tier = await prisma.partnerTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      return res.status(404).json({ ok: false, error: 'Уровень не найден' } satisfies ApiResponse);
    }
    const updated = await prisma.partner.update({ where: { id: partner.id }, data: { tierId: tier.id } });

    // Wire the tier commission into Finance as an override for this partner's scope.
    const domain = domainForRefType(partner.refType);
    await prisma.commissionRule.upsert({
      where: { domain_scopeId: { domain, scopeId: partner.refId } },
      create: { domain, scopeId: partner.refId, percentBps: tier.commissionBps },
      update: { percentBps: tier.commissionBps },
    });

    return res.json({ ok: true, data: { partner: updated, appliedCommissionBps: tier.commissionBps, domain } } satisfies ApiResponse);
  } catch (error) {
    console.error('Assign tier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при назначении уровня' } satisfies ApiResponse);
  }
});

// ─── KPI ───
partnersRouter.post('/:id/kpis', requirePermission('partner.manage'), async (req: AuthRequest, res) => {
  try {
    const { period, metricsJson, score } = req.body || {};
    if (!period) {
      return res.status(400).json({ ok: false, error: 'period обязателен' } satisfies ApiResponse);
    }
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id as string } });
    if (!partner) {
      return res.status(404).json({ ok: false, error: 'Партнёр не найден' } satisfies ApiResponse);
    }
    const kpi = await prisma.partnerKPI.create({
      data: { partnerId: partner.id, period, metricsJson: metricsJson ?? undefined, score: Number(score) || 0 },
    });
    return res.status(201).json({ ok: true, data: kpi } satisfies ApiResponse);
  } catch (error) {
    console.error('Create KPI error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при записи KPI' } satisfies ApiResponse);
  }
});

// ─── SLA ───
partnersRouter.post('/:id/slas', requirePermission('partner.manage'), async (req: AuthRequest, res) => {
  try {
    const { metric, target, actual, direction } = req.body || {};
    if (!metric || target === undefined) {
      return res.status(400).json({ ok: false, error: 'metric и target обязательны' } satisfies ApiResponse);
    }
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id as string } });
    if (!partner) {
      return res.status(404).json({ ok: false, error: 'Партнёр не найден' } satisfies ApiResponse);
    }
    // Breach direction: explicit `direction` wins; otherwise infer from a known
    // set of "lower is better" metrics (exact match to avoid e.g. "uptime"
    // matching "time"). Default: higher is better (breach if actual < target).
    const LOWER_IS_BETTER = new Set(['shipping_time', 'response_time', 'delivery_time', 'latency', 'delay']);
    const lowerIsBetter = direction ? direction === 'lower_better' : LOWER_IS_BETTER.has(metric);
    const breached =
      actual !== undefined &&
      (lowerIsBetter ? Number(actual) > Number(target) : Number(actual) < Number(target));
    const sla = await prisma.partnerSLA.create({
      data: { partnerId: partner.id, metric, target: Number(target), actual: actual !== undefined ? Number(actual) : null, breached },
    });
    return res.status(201).json({ ok: true, data: sla } satisfies ApiResponse);
  } catch (error) {
    console.error('Create SLA error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при записи SLA' } satisfies ApiResponse);
  }
});

// ─── Co-marketing campaigns ───
partnersRouter.post('/:id/campaigns', requirePermission('partner.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, budget, budgetMinor, splitBps, startsAt, endsAt } = req.body || {};
    if (!name) {
      return res.status(400).json({ ok: false, error: 'name обязателен' } satisfies ApiResponse);
    }
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id as string } });
    if (!partner) {
      return res.status(404).json({ ok: false, error: 'Партнёр не найден' } satisfies ApiResponse);
    }
    const minor = budgetMinor !== undefined ? BigInt(budgetMinor) : budget !== undefined ? tengeToMinor(Number(budget)) : 0n;
    const campaign = await prisma.marketingCampaign.create({
      data: {
        partnerId: partner.id,
        name,
        budget: minor,
        splitBps: splitBps ?? 5000,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(campaign) } satisfies ApiResponse);
  } catch (error) {
    console.error('Create campaign error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании кампании' } satisfies ApiResponse);
  }
});

export default partnersRouter;
