/**
 * Business Intelligence API — /api/bi/*
 *
 * Three-tier access:
 *   Clinic BI → owner/admin/accountant (clinic-level metrics)
 *   Network BI → network owner (multi-clinic aggregation)
 *   Platform BI → superadmin only (full dashboard + partner ROI)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
  getMRR,
  getChurn,
  getLTV,
  getCAC,
  getUnitEconomics,
  getCashFlow,
  getScenarios,
  getPartnerROI,
  getBIDashboard,
} from './bi.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const biRouter = Router();
biRouter.use(authenticate);

// ─── Platform BI (superadmin only) ───

biRouter.get('/dashboard', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getBIDashboard();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/dashboard]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки BI дашборда' } satisfies ApiResponse);
  }
});

biRouter.get('/mrr', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getMRR();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/mrr]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка MRR' } satisfies ApiResponse);
  }
});

biRouter.get('/churn', requirePermission('platform.analytics'), async (req: AuthRequest, res) => {
  try {
    const months = Math.min(Math.max(parseInt(String(req.query.months || '1'), 10) || 1, 1), 12);
    const data = await getChurn(months);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/churn]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка churn' } satisfies ApiResponse);
  }
});

biRouter.get('/ltv', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getLTV();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/ltv]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка LTV' } satisfies ApiResponse);
  }
});

biRouter.get('/cac', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getCAC();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/cac]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка CAC' } satisfies ApiResponse);
  }
});

biRouter.get('/unit-economics', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getUnitEconomics();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/unit-economics]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка unit economics' } satisfies ApiResponse);
  }
});

biRouter.get('/cashflow', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getCashFlow();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/cashflow]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка cash flow' } satisfies ApiResponse);
  }
});

biRouter.get('/scenarios', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getScenarios();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/scenarios]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка сценариев' } satisfies ApiResponse);
  }
});

biRouter.get('/partner-roi', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const data = await getPartnerROI();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/partner-roi]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка partner ROI' } satisfies ApiResponse);
  }
});

// ─── Clinic BI (owner/admin/accountant) ───

biRouter.get('/clinic/overview', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Нет активной клиники' } satisfies ApiResponse);
    }

    const [mrr, unitEconomics] = await Promise.all([
      getMRR(),
      getUnitEconomics(),
    ]);

    return res.json({
      ok: true,
      data: {
        mrr: mrr.mrr,
        activeClinics: 1,
        unitEconomics,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/clinic/overview]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка clinic overview' } satisfies ApiResponse);
  }
});

export default biRouter;
