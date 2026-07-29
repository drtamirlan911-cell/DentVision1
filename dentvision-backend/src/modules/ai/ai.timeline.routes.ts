/**
 * AI Timeline API — returns processed AI events for the timeline UI.
 */

import { Router, Response } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
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
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId || (req.query.clinicId as string);
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'clinicId required' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const eventType = req.query.eventType as string | undefined;

    // Fetch AI events from the database
    const events = await prisma.aIEvent.findMany({
      where: {
        clinicId,
        ...(eventType ? { type: eventType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Transform into timeline format
    const timeline = events.map((event) => ({
      id: event.id,
      type: event.type,
      source: event.source,
      timestamp: event.createdAt,
      clinicId: event.clinicId,
      userId: event.userId,
      payload: event.payload ? JSON.parse(event.payload as string) : {},
      status: event.status,
      result: event.result ? JSON.parse(event.result as string) : null,
      error: event.error,
      durationMs: event.processedAt
        ? event.processedAt.getTime() - event.createdAt.getTime()
        : 0,
      processedAt: event.processedAt || event.createdAt,
    }));

    const total = await prisma.aIEvent.count({
      where: {
        clinicId,
        ...(eventType ? { type: eventType } : {}),
      },
    });

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
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId || (req.query.clinicId as string);
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'clinicId required' });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalEvents, todayEvents, successEvents, failedEvents] =
      await Promise.all([
        prisma.aIEvent.count({ where: { clinicId } }),
        prisma.aIEvent.count({
          where: { clinicId, createdAt: { gte: todayStart } },
        }),
        prisma.aIEvent.count({
          where: { clinicId, status: 'completed' },
        }),
        prisma.aIEvent.count({
          where: { clinicId, status: 'failed' },
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
