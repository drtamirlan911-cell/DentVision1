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
    const plan = await generateContentPlan({
      clinicId,
      count: Number(req.body?.count) || 6,
      tone: req.body?.tone ? String(req.body.tone) : undefined,
    });

    await auditFromReq(req, {
      action: 'marketing.content_plan.generated',
      entity: 'clinic',
      entityId: clinicId,
      details: { ideas: plan.ideas.length, deterministic: plan.deterministic },
    });

    return res.json({ ok: true, data: plan } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать контент-план' } satisfies ApiResponse);
  }
});

export { marketingRouter };
