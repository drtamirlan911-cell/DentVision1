import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import type { ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const type = req.query.type as string | undefined;

    const where = { userId: req.user!.id, ...(type ? { type } : {}) };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return res.json({
      ok: true,
      data: notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

notificationsRouter.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    });

    return res.json({ ok: true, data: { unread: count } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

notificationsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { type, title, message, link } = req.body as {
      type?: string;
      title?: string;
      message?: string;
      link?: string;
    };

    if (!type || !title || !message) {
      return res.status(400).json({ ok: false, error: 'Поля type, title и message обязательны' });
    }

    const notification = await prisma.notification.create({
      data: {
        id: uid(),
        userId: req.user!.id,
        type,
        title,
        message,
        link: link || null,
      },
    });

    return res.status(201).json({ ok: true, data: notification });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

notificationsRouter.post('/:id/read', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Уведомление не найдено' });
    }
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return res.json({ ok: true, data: notification });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

notificationsRouter.post('/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });

    return res.json({ ok: true, data: { markedRead: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

export { notificationsRouter };
