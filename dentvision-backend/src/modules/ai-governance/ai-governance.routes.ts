import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { aiQualityReview, aiSupplierSuggest, aiCourseOutline } from './ai-governance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// AI Governance API (Phase 6). Quality Control + Supplier/Course AI helpers.
export const aiGovernanceRouter = Router();

aiGovernanceRouter.use(authenticate);

const ENTITY_TYPES = ['product', 'course', 'supplier'];

// AI Quality Control — runs compliance and returns verdict + recommendations.
aiGovernanceRouter.post('/review', requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const { entityType, entityId } = req.body || {};
    if (!ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ ok: false, error: 'entityType (product|course|supplier) и entityId обязательны' } satisfies ApiResponse);
    }
    const review = await aiQualityReview(entityType, entityId);
    return res.json({ ok: true, data: review } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message } satisfies ApiResponse);
  }
});

// AI Supplier Agent — improvement suggestions + price insights.
aiGovernanceRouter.get('/supplier/:id/suggest', async (req: AuthRequest, res) => {
  try {
    const data = await aiSupplierSuggest(req.params.id as string);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    const msg = (error as Error).message;
    return res.status(msg.includes('not found') ? 404 : 500).json({ ok: false, error: msg } satisfies ApiResponse);
  }
});

// AI Course Builder — generate a course outline from a title.
aiGovernanceRouter.post('/course/outline', async (req: AuthRequest, res) => {
  const { title, level } = req.body || {};
  if (!title) {
    return res.status(400).json({ ok: false, error: 'title обязателен' } satisfies ApiResponse);
  }
  return res.json({ ok: true, data: aiCourseOutline(title, level) } satisfies ApiResponse);
});

export default aiGovernanceRouter;
