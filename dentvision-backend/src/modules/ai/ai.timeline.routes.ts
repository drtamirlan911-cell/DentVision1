/**
 * AI Timeline / Agent Activity Center API.
 *
 * Backed by `AgentActivity` (the governance kernel's ledger, `ai/os/kernel.ts`)
 * rather than the legacy `AIEvent` table, which nothing has written to since
 * the Redis Streams event layer it depended on was found to have zero
 * publishers. `eventType` keeps its old query-param name for the frontend's
 * sake but now filters by `tool` — the closest analog to "what kind of thing
 * happened" once every call is a kernel-recorded tool invocation.
 *
 * Visibility used to be a single route-level gate (`bi.read`) — anyone
 * without it saw nothing, including their own actions. `buildActivityFilter`
 * (`ai/os/activityQuery.ts`) replaces that with a row-level visibility ladder:
 * every authenticated caller sees at least their own AI activity; `bi.read`
 * widens that to the clinic and organization; only SUPERADMIN sees the
 * platform tier. Visibility (which rows) is separate from PHI redaction
 * (what those rows reveal) — a caller without `medical.read` still sees that
 * a PHI-sensitivity action happened, just not its payload/result.
 */

import { Router, Response } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import { buildActivityFilter, redactPhiRows } from './os/activityQuery.js';

const router = Router();

function resolveClinicParam(req: AuthRequest): string | null {
  return req.user?.clinicId || (req.query.clinicId as string) || null;
}

/**
 * GET /api/ai/timeline
 * Query params:
 *   - clinicId (optional — widens visibility when the caller can read it;
 *     the caller's own activity is visible regardless)
 *   - limit (default 50), offset (default 0)
 *   - eventType (filters by tool name)
 *   - agent (filters by agentId)
 *   - role (filters by actorRole)
 *   - user (filters by actorUserId — narrowed by visibility, not a bypass)
 *   - status (filters by status: ok | tool_error | denied)
 *   - dateFrom / dateTo (ISO date, filters createdAt)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ ok: false, error: 'Требуется авторизация' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const eventType = req.query.eventType as string | undefined;
    const agent = req.query.agent as string | undefined;
    const role = req.query.role as string | undefined;
    const filterUserId = req.query.user as string | undefined;
    const status = req.query.status as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const { where: visibilityWhere, canReadPhi } = await buildActivityFilter(req.user.id, resolveClinicParam(req));

    const where = {
      ...visibilityWhere,
      ...(eventType ? { tool: eventType } : {}),
      ...(agent ? { agentId: agent } : {}),
      ...(role ? { actorRole: role } : {}),
      ...(filterUserId ? { actorUserId: filterUserId } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
        : {}),
    };

    const [activities, total] = await Promise.all([
      prisma.agentActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.agentActivity.count({ where }),
    ]);

    const redacted = redactPhiRows(activities, canReadPhi);

    // Transform into timeline format — the response shape is unchanged from
    // the AIEvent-backed version so `useAITimeline.ts` needs no edits.
    const timeline = redacted.map((activity) => ({
      id: activity.id,
      type: activity.tool,
      source: activity.surface,
      agentId: activity.agentId,
      actorRole: activity.actorRole,
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
 * Returns aggregated stats for the timeline, over the same visibility set as
 * the list endpoint.
 */
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ ok: false, error: 'Требуется авторизация' });
      return;
    }

    const { where } = await buildActivityFilter(req.user.id, resolveClinicParam(req));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalEvents, todayEvents, successEvents, failedEvents] =
      await Promise.all([
        prisma.agentActivity.count({ where }),
        prisma.agentActivity.count({ where: { ...where, createdAt: { gte: todayStart } } }),
        prisma.agentActivity.count({ where: { ...where, status: 'ok' } }),
        prisma.agentActivity.count({ where: { ...where, status: { in: ['tool_error', 'denied'] } } }),
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
