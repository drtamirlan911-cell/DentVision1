/**
 * AI Timeline API — returns processed AI events for the timeline UI.
 *
 * Backed by `AgentActivity` (the governance kernel's ledger, `ai/os/kernel.ts`)
 * rather than the legacy `AIEvent` table, which nothing has written to since
 * the Redis Streams event layer it depended on was found to have zero
 * publishers. `eventType` keeps its old query-param name for the frontend's
 * sake but now filters by `tool` — the closest analog to "what kind of thing
 * happened" once every call is a kernel-recorded tool invocation.
 */

import { Router, Response } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest } from '../../types/index.js';
const router = Router();

/**
 * GET /api/ai/timeline
 * Query params:
 *   - clinicId (required)
 *   - limit (default 50)
 *   - offset (default 0)
 *   - eventType (optional filter)
 *   - agent (optional filter)
 */
router.get('/', authenticate, requirePermission('bi.clinic'), async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.role === 'SUPERADMIN'
      ? (req.user?.clinicId || (req.query.clinicId as string))
      : req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'clinicId required' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const eventType = req.query.eventType as string | undefined;

    const where = {
      clinicId,
      ...(eventType ? { tool: eventType } : {}),
    };

    const activities = await prisma.agentActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Transform into timeline format — the response shape is unchanged from
    // the AIEvent-backed version so `useAITimeline.ts` needs no edits.
    const timeline = activities.map((activity) => ({
      id: activity.id,
      type: activity.tool,
      source: activity.surface,
      timestamp: activity.createdAt,
      clinicId: activity.clinicId,
      userId: activity.actorUserId,
      payload: activity.argsRedacted ?? {},
      status: activity.status,
      result: activity.resultSummary ? { summary: activity.resultSummary } : null,
      error: activity.status !== 'ok' ? (activity.denyReason || activity.resultSummary || null) : null,
      durationMs: activity.durationMs ?? 0,
      processedAt: activity.createdAt,
    }));

    const total = await prisma.agentActivity.count({ where });

    res.json({
      ok: true,
      data: {
        entries: timeline,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[AI Timeline] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch timeline' });
  }
});

/**
 * GET /api/ai/timeline/stats
 * Returns aggregated stats for the timeline.
 */
router.get('/stats', authenticate, requirePermission('bi.clinic'), async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.role === 'SUPERADMIN'
      ? (req.user?.clinicId || (req.query.clinicId as string))
      : req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'clinicId required' });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalEvents, todayEvents, successEvents, failedEvents] =
      await Promise.all([
        prisma.agentActivity.count({ where: { clinicId } }),
        prisma.agentActivity.count({
          where: { clinicId, createdAt: { gte: todayStart } },
        }),
        prisma.agentActivity.count({
          where: { clinicId, status: 'ok' },
        }),
        prisma.agentActivity.count({
          where: { clinicId, status: { in: ['tool_error', 'denied'] } },
        }),
      ]);

    res.json({
      ok: true,
      data: {
        totalEvents,
        todayEvents,
        successEvents,
        failedEvents,
        successRate:
          totalEvents > 0
            ? Math.round((successEvents / totalEvents) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error('[AI Timeline Stats] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch stats' });
  }
});

export default router;
