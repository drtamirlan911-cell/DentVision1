import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { env } from '../../config.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { runReminderCron } from '../../jobs/reminderCron.js';

export const remindersRouter = Router();

function requireClinic(req: AuthRequest, res: any): string | null {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  return clinicId;
}

remindersRouter.get('/reminders/sent', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const rows = await prisma.reminderLog.findMany({
      where: { clinicId },
      orderBy: { sentAt: 'desc' },
      select: { reminderKey: true, channel: true, sentAt: true },
    });

    return res.json({ ok: true, data: rows } satisfies ApiResponse);
  } catch (error) {
    console.error('[Reminders] list sent error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить журнал напоминаний' } satisfies ApiResponse);
  }
});

remindersRouter.post('/reminders/sent', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const { reminderKey, channel } = req.body as { reminderKey?: string; channel?: string };
    if (!reminderKey) {
      return res.status(400).json({ ok: false, error: 'reminderKey обязателен' } satisfies ApiResponse);
    }

    const log = await prisma.reminderLog.create({
      data: {
        id: uid(),
        clinicId,
        reminderKey,
        channel: channel || 'whatsapp',
      },
    });

    return res.status(201).json({ ok: true, data: log } satisfies ApiResponse);
  } catch (error) {
    console.error('[Reminders] mark sent error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отметить напоминание' } satisfies ApiResponse);
  }
});

/** Manual / Render cron: run reminder sender for caller's clinic. */
remindersRouter.post('/reminders/run', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const hoursWindow = Number(req.body?.hoursWindow) || 24;
    const hoursMin = Number(req.body?.hoursMin) || 0;
    const result = await runReminderCron({ clinicId, hoursWindow, hoursMin });
    return res.json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    console.error('[Reminders] run error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось запустить рассылку' } satisfies ApiResponse);
  }
});

/**
 * Internal cron endpoint (Render Cron / curl).
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
remindersRouter.post('/reminders/cron', async (req, res) => {
  try {
    const secret = env.CRON_SECRET;
    if (!secret) {
      return res.status(503).json({ ok: false, error: 'CRON_SECRET не настроен' } satisfies ApiResponse);
    }
    const header = req.headers['x-cron-secret'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (header !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse);
    }

    const clinicId = typeof req.body?.clinicId === 'string' ? req.body.clinicId : undefined;
    const hoursWindow = Number(req.body?.hoursWindow) || 24;
    const hoursMin = Number(req.body?.hoursMin) || 0;
    const result = await runReminderCron({ clinicId, hoursWindow, hoursMin });
    return res.json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    console.error('[Reminders] cron error:', error);
    return res.status(500).json({ ok: false, error: 'Cron failed' } satisfies ApiResponse);
  }
});
