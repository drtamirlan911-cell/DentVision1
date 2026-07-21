import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { runComplianceCheck } from './compliance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const complianceRouter = Router();

complianceRouter.use(authenticate);

const ENTITY_TYPES = ['product', 'course', 'supplier'];

// Run a compliance check on an entity (platform).
complianceRouter.post('/checks', requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const { entityType, entityId } = req.body || {};
    if (!ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ ok: false, error: 'entityType (product|course|supplier) и entityId обязательны' } satisfies ApiResponse);
    }
    const check = await runComplianceCheck(entityType, entityId);
    return res.status(201).json({ ok: true, data: check } satisfies ApiResponse);
  } catch (error) {
    console.error('Compliance check error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при проверке' } satisfies ApiResponse);
  }
});

complianceRouter.get('/checks', requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  const checks = await prisma.complianceCheck.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  return res.json({ ok: true, data: checks } satisfies ApiResponse);
});

export default complianceRouter;
