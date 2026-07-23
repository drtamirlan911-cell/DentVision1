/**
 * Business Intelligence API — /api/bi/*
 *
 * Three-tier access:
 *   Clinic BI  → bi.clinic  (owner/admin/manager — single clinic data)
 *   Network BI → bi.network (superadmin only — multi-clinic aggregation)
 *   Platform BI → bi.platform (superadmin only — full dashboard + partner ROI)
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
  getClinicBI,
  getNetworkBI,
  cfoChat,
} from './bi.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const biRouter = Router();
biRouter.use(authenticate);

// ═══════════════════════════════════════════════════════════════
// PLATFORM BI — superadmin only
// ═══════════════════════════════════════════════════════════════

biRouter.get('/dashboard', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getBIDashboard();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/dashboard]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки BI дашборда' } satisfies ApiResponse);
  }
});

biRouter.get('/mrr', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getMRR();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/mrr]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка MRR' } satisfies ApiResponse);
  }
});

biRouter.get('/churn', requirePermission('bi.platform'), async (req: AuthRequest, res) => {
  try {
    const months = Math.min(Math.max(parseInt(String(req.query.months || '1'), 10) || 1, 1), 12);
    const data = await getChurn(months);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/churn]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка churn' } satisfies ApiResponse);
  }
});

biRouter.get('/ltv', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getLTV();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/ltv]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка LTV' } satisfies ApiResponse);
  }
});

biRouter.get('/cac', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getCAC();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/cac]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка CAC' } satisfies ApiResponse);
  }
});

biRouter.get('/unit-economics', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getUnitEconomics();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/unit-economics]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка unit economics' } satisfies ApiResponse);
  }
});

biRouter.get('/cashflow', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getCashFlow();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/cashflow]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка cash flow' } satisfies ApiResponse);
  }
});

biRouter.get('/scenarios', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getScenarios();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/scenarios]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка сценариев' } satisfies ApiResponse);
  }
});

biRouter.get('/partner-roi', requirePermission('bi.platform'), async (_req: AuthRequest, res) => {
  try {
    const data = await getPartnerROI();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/partner-roi]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка partner ROI' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// NETWORK BI — superadmin only (multi-clinic aggregation)
// ═══════════════════════════════════════════════════════════════

biRouter.get('/network', requirePermission('bi.network'), async (_req: AuthRequest, res) => {
  try {
    const data = await getNetworkBI();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/network]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка network BI' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// CLINIC BI — owner/admin/manager (single clinic data)
// ═══════════════════════════════════════════════════════════════

biRouter.get('/clinic', requirePermission('bi.clinic'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Нет активной клиники' } satisfies ApiResponse);
    }
    const data = await getClinicBI(clinicId);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/clinic]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка clinic BI' } satisfies ApiResponse);
  }
});

biRouter.get('/clinic/:clinicId', requirePermission('bi.clinic'), async (req: AuthRequest, res) => {
  try {
    const clinicId = String(req.params.clinicId);
    const data = await getClinicBI(clinicId);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/clinic/:id]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка clinic BI' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// AI CFO CHAT — available to all BI-authorized users
// ═══════════════════════════════════════════════════════════════

biRouter.post('/cfo/chat', requirePermission('bi.clinic'), async (req: AuthRequest, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ ok: false, error: 'Вопрос обязателен' } satisfies ApiResponse);
    }
    const clinicId = req.user?.clinicId || undefined;
    const reply = await cfoChat(question, clinicId);
    return res.json({ ok: true, data: { reply } } satisfies ApiResponse);
  } catch (error) {
    console.error('[bi/cfo/chat]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка AI CFO' } satisfies ApiResponse);
  }
});

export default biRouter;
