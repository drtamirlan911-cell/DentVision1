/**
 * Настройка списания расходников: правила «что уходит со склада после приёма».
 *
 * Раньше это была одна строка в настройках клиники, и всё, что клиника
 * могла — перечислить названия. Здесь у каждого правила есть область
 * действия (каждый приём / услуга / диагноз), позиции склада и количества.
 */

import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { isRuleScope, resolveDeductionPlan, type RuleScope } from './deductionRules.js';

const stockRulesRouter = Router();

stockRulesRouter.use(authenticate);
stockRulesRouter.use(loadClinicAccess);
stockRulesRouter.use(blockClinicWrites);

/**
 * Ключ области действия.
 *
 * У `always` ключ пустой, а не NULL: уникальный индекс
 * (clinicId, scope, matchKey) иначе не удержит вторую запись «на каждый
 * приём» — NULL-ы в Postgres не равны друг другу.
 */
function normalizeMatchKey(scope: RuleScope, raw: unknown): string {
  if (scope === 'always') return '';
  const key = String(raw || '').trim();
  return scope === 'diagnosis' ? key.toUpperCase() : key;
}

function parseLines(raw: unknown): Array<{ itemId: string; quantity: number }> {
  if (!Array.isArray(raw)) return [];
  const byItem = new Map<string, number>();
  for (const row of raw) {
    const itemId = String((row as any)?.itemId || '').trim();
    if (!itemId) continue;
    const qty = Math.trunc(Number((row as any)?.quantity));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    // Одна позиция дважды в одном правиле — это одна позиция с суммой,
    // а не повод уронить запрос уникальным индексом (ruleId, itemId).
    byItem.set(itemId, (byItem.get(itemId) || 0) + qty);
  }
  return [...byItem.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

stockRulesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const rules = await prisma.stockDeductionRule.findMany({
      where: { clinicId },
      include: {
        items: {
          include: { item: { select: { id: true, name: true, unit: true, quantity: true } } },
        },
      },
      orderBy: [{ scope: 'asc' }, { matchKey: 'asc' }],
    });
    return res.json({ ok: true, data: rules } satisfies ApiResponse);
  } catch (error) {
    console.error('[stock rules] list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить правила' } satisfies ApiResponse);
  }
});

/**
 * Предпросмотр: что спишется за приём с такими услугами и диагнозом.
 *
 * Тем же расчётом, что и настоящее списание, — иначе предпросмотр обещал бы
 * одно, а склад делал другое.
 */
stockRulesRouter.get('/preview', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const serviceCodes = String(req.query.services || '').split(',').map((s) => s.trim()).filter(Boolean);
    const plan = await resolveDeductionPlan(prisma, {
      clinicId,
      serviceCodes,
      diagnosisText: req.query.diagnosis ? String(req.query.diagnosis) : null,
    });
    return res.json({ ok: true, data: plan } satisfies ApiResponse);
  } catch (error) {
    console.error('[stock rules] preview', error);
    return res.status(500).json({ ok: false, error: 'Не удалось рассчитать списание' } satisfies ApiResponse);
  }
});

stockRulesRouter.post('/', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const scope = req.body?.scope;
    if (!isRuleScope(scope)) {
      return res.status(400).json({ ok: false, error: 'Область действия должна быть always, service или diagnosis' } satisfies ApiResponse);
    }
    const matchKey = normalizeMatchKey(scope, req.body?.matchKey);
    if (scope !== 'always' && !matchKey) {
      return res.status(400).json({ ok: false, error: 'Укажите услугу или диагноз' } satisfies ApiResponse);
    }
    const lines = parseLines(req.body?.items);

    // Позиции должны принадлежать этой клинике — иначе правило ссылалось бы
    // на чужой склад.
    if (lines.length > 0) {
      const owned = await prisma.inventoryItem.count({
        where: { clinicId, id: { in: lines.map((l) => l.itemId) } },
      });
      if (owned !== lines.length) {
        return res.status(400).json({ ok: false, error: 'Позиция склада не найдена' } satisfies ApiResponse);
      }
    }

    const rule = await prisma.$transaction(async (tx) => {
      // Правило на ту же область — это то же правило: клиника правит его,
      // а не заводит второе, которое молча сложится с первым.
      const saved = await tx.stockDeductionRule.upsert({
        where: { clinicId_scope_matchKey: { clinicId, scope, matchKey } },
        create: {
          clinicId,
          scope,
          matchKey,
          label: req.body?.label ? String(req.body.label).slice(0, 120) : null,
          active: req.body?.active !== false,
        },
        update: {
          ...(req.body?.label !== undefined && { label: req.body.label ? String(req.body.label).slice(0, 120) : null }),
          ...(req.body?.active !== undefined && { active: req.body.active !== false }),
        },
      });
      await tx.stockDeductionRuleItem.deleteMany({ where: { ruleId: saved.id } });
      for (const line of lines) {
        await tx.stockDeductionRuleItem.create({
          data: { ruleId: saved.id, itemId: line.itemId, quantity: line.quantity },
        });
      }
      return saved;
    });

    const full = await prisma.stockDeductionRule.findUnique({
      where: { id: rule.id },
      include: { items: { include: { item: { select: { id: true, name: true, unit: true, quantity: true } } } } },
    });
    return res.json({ ok: true, data: full } satisfies ApiResponse);
  } catch (error) {
    console.error('[stock rules] upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить правило' } satisfies ApiResponse);
  }
});

stockRulesRouter.delete('/:id', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    // deleteMany со скоупом клиники, а не delete по id: иначе чужое правило
    // удалялось бы по прямому вызову.
    const result = await prisma.stockDeductionRule.deleteMany({
      where: { id: String(req.params.id), clinicId },
    });
    if (result.count === 0) {
      return res.status(404).json({ ok: false, error: 'Правило не найдено' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[stock rules] delete', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить правило' } satisfies ApiResponse);
  }
});

export { stockRulesRouter };
