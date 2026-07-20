import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const remindersRouter = Router();
remindersRouter.use(authenticate);

function requireClinic(req: AuthRequest, res: any): string | null {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  return clinicId;
}

remindersRouter.get('/reminders/sent', async (req: AuthRequest, res) => {
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

remindersRouter.post('/reminders/sent', async (req: AuthRequest, res) => {
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
