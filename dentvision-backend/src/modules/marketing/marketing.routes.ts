/**
 * Контент и продвижение клиники.
 *
 * Два маршрута: показать факты, на которых строится контент, и собрать по ним
 * план. Разделены намеренно — сводку можно посмотреть отдельно, она
 * детерминированная и ничего не стоит, а генерация плана дёргает модель.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { buildMarketingContext } from './contentContext.js';
import { generateContentPlan } from './contentPlan.js';
import { savePlan, listPlans, getPlan, updateIdea, deletePlan } from './planStore.js';

const marketingRouter = Router();

marketingRouter.use(authenticate);
marketingRouter.use(loadClinicAccess);
marketingRouter.use(blockClinicWrites);

/** Факты о клинике, на которых строится контент. Без модели. */
marketingRouter.get('/context', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const context = await buildMarketingContext(clinicId);
    return res.json({ ok: true, data: context } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] context', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать данные клиники' } satisfies ApiResponse);
  }
});

/**
 * Контент-план.
 *
 * Право `patient.write`, а не `patient.read`: генерация тратит токены модели,
 * и запускать её должен тот, кто отвечает за работу клиники, а не любой,
 * кто может открыть экран.
 */
marketingRouter.post('/content-plan', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const tone = req.body?.tone ? String(req.body.tone) : undefined;
    const plan = await generateContentPlan({
      clinicId,
      count: Number(req.body?.count) || 6,
      tone,
    });

    // Сохраняем сразу: план, живущий только в состоянии браузера, исчезал
    // вместе с вкладкой, и работа пропадала.
    const stored = await savePlan({ clinicId, userId: req.user?.id, tone, plan });

    await auditFromReq(req, {
      action: 'marketing.content_plan.generated',
      entity: 'contentPlan',
      entityId: stored.id,
      details: { ideas: plan.ideas.length, deterministic: plan.deterministic },
    });

    return res.json({ ok: true, data: stored } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать контент-план' } satisfies ApiResponse);
  }
});

/** Сохранённые планы клиники — история работы. */
marketingRouter.get('/content-plans', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const plans = await listPlans(clinicId, Number(req.query.limit) || 20);
    return res.json({ ok: true, data: plans } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plans list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить планы' } satisfies ApiResponse);
  }
});

marketingRouter.get('/content-plans/:id', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const plan = await getPlan(clinicId, String(req.params.id));
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: plan } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan get', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить план' } satisfies ApiResponse);
  }
});

/**
 * Правка текстов идеи.
 *
 * `basedOn` в список правимых полей не входит: это происхождение идеи, а не
 * копирайт. Разрешить его менять значило бы позволить сочинить обоснование
 * задним числом, и поле перестало бы что-либо значить.
 */
marketingRouter.patch('/content-ideas/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const idea = await updateIdea(clinicId, String(req.params.id), {
      title: body.title !== undefined ? String(body.title) : undefined,
      hook: body.hook !== undefined ? String(body.hook) : undefined,
      caption: body.caption !== undefined ? String(body.caption) : undefined,
      callToAction: body.callToAction !== undefined ? String(body.callToAction) : undefined,
      hashtags: Array.isArray(body.hashtags) ? (body.hashtags as string[]) : undefined,
    });
    if (!idea) {
      return res.status(404).json({ ok: false, error: 'Идея не найдена' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: idea } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-idea patch', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить правку' } satisfies ApiResponse);
  }
});

marketingRouter.delete('/content-plans/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const removed = await deletePlan(clinicId, String(req.params.id));
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan delete', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить план' } satisfies ApiResponse);
  }
});

export { marketingRouter };
