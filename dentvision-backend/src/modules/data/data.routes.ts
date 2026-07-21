import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { computeMetricByKey, computationExists } from './data.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Data Intelligence API (Phase 10): metric registry, metric values, dashboards.
export const dataRouter = Router();

dataRouter.use(authenticate);

// List registered metrics.
dataRouter.get('/metrics', async (_req: AuthRequest, res) => {
  const metrics = await prisma.metric.findMany({ orderBy: { key: 'asc' } });
  return res.json({ ok: true, data: metrics } satisfies ApiResponse);
});

// Register/update a metric (platform).
dataRouter.post('/metrics', requirePermission('platform.analytics'), async (req: AuthRequest, res) => {
  try {
    const { key, domain, title, definition } = req.body || {};
    if (!key || !title || !definition?.type) {
      return res.status(400).json({ ok: false, error: 'key, title и definition.type обязательны' } satisfies ApiResponse);
    }
    if (!computationExists(definition.type)) {
      return res.status(400).json({ ok: false, error: `Неизвестный тип метрики: ${definition.type}` } satisfies ApiResponse);
    }
    const metric = await prisma.metric.upsert({
      where: { key },
      create: { key, domain: domain || 'core', title, definition },
      update: { domain: domain || 'core', title, definition },
    });
    return res.status(201).json({ ok: true, data: metric } satisfies ApiResponse);
  } catch (error) {
    console.error('Register metric error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при регистрации метрики' } satisfies ApiResponse);
  }
});

// Compute a metric value. Clinic-scoped metrics default to the caller's clinic.
dataRouter.get('/metrics/:key/value', async (req: AuthRequest, res) => {
  try {
    const scopeId = (req.query.scopeId as string) || req.user?.clinicId || undefined;
    const value = await computeMetricByKey(req.params.key as string, scopeId);
    return res.json({ ok: true, data: { key: req.params.key, ...value } } satisfies ApiResponse);
  } catch (error) {
    const msg = (error as Error).message;
    const code = msg.includes('not found') || msg.includes('Unknown') ? 404 : 500;
    return res.status(code).json({ ok: false, error: msg } satisfies ApiResponse);
  }
});

// ─── Dashboards ───
dataRouter.get('/dashboards', async (req: AuthRequest, res) => {
  const scopeId = (req.query.scopeId as string) || req.user?.clinicId;
  const dashboards = await prisma.dashboard.findMany({
    where: { scopeType: 'CLINIC', scopeId: scopeId || '' },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ ok: true, data: dashboards } satisfies ApiResponse);
});

dataRouter.post('/dashboards', async (req: AuthRequest, res) => {
  try {
    const { name, layout, scopeId } = req.body || {};
    const clinicId = scopeId || req.user?.clinicId;
    if (!name || !layout || !clinicId) {
      return res.status(400).json({ ok: false, error: 'name, layout и clinic обязательны' } satisfies ApiResponse);
    }
    const dashboard = await prisma.dashboard.create({
      data: { scopeType: 'CLINIC', scopeId: clinicId, name, layout, createdBy: req.user?.id || null },
    });
    return res.status(201).json({ ok: true, data: dashboard } satisfies ApiResponse);
  } catch (error) {
    console.error('Create dashboard error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании дашборда' } satisfies ApiResponse);
  }
});

export default dataRouter;
