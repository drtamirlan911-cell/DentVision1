import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { hashSecret } from './apiKey.middleware.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Developer Platform (Phase 8, DENTVISION_V2_PLATFORM_EXTENSIONS_PLAN.md §2).
// Apps, API keys and webhooks for third-party integrations.
export const developerRouter = Router();

developerRouter.use(authenticate);

// ─── Apps ───
developerRouter.get('/apps', async (req: AuthRequest, res) => {
  const apps = await prisma.developerApp.findMany({
    where: { ownerUserId: req.user!.id },
    include: { _count: { select: { apiKeys: true, webhooks: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ ok: true, data: apps } satisfies ApiResponse);
});

developerRouter.post('/apps', async (req: AuthRequest, res) => {
  try {
    const { name, environment, scopes } = req.body || {};
    if (!name) {
      return res.status(400).json({ ok: false, error: 'name обязателен' } satisfies ApiResponse);
    }
    const app = await prisma.developerApp.create({
      data: {
        ownerUserId: req.user!.id,
        name,
        environment: environment === 'production' ? 'production' : 'sandbox',
        scopes: Array.isArray(scopes) ? scopes : [],
      },
    });
    return res.status(201).json({ ok: true, data: app } satisfies ApiResponse);
  } catch (error) {
    console.error('Create app error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании приложения' } satisfies ApiResponse);
  }
});

// ─── API keys ───
// Returns the plaintext key exactly once; only its hash is stored.
developerRouter.post('/apps/:id/keys', async (req: AuthRequest, res) => {
  try {
    const app = await prisma.developerApp.findFirst({
      where: { id: req.params.id as string, ownerUserId: req.user!.id },
    });
    if (!app) {
      return res.status(404).json({ ok: false, error: 'Приложение не найдено' } satisfies ApiResponse);
    }
    const prefix = `dv_${randomBytes(6).toString('hex')}`;
    const secret = randomBytes(24).toString('hex');
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes : app.scopes;
    await prisma.apiKey.create({
      data: { appId: app.id, prefix, hash: hashSecret(secret), scopes },
    });
    return res.status(201).json({
      ok: true,
      data: { prefix, key: `${prefix}.${secret}`, scopes, note: 'Сохраните ключ — он показывается один раз' },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Create key error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании ключа' } satisfies ApiResponse);
  }
});

// ─── Webhooks ───
developerRouter.post('/webhooks', async (req: AuthRequest, res) => {
  try {
    const { appId, url, events } = req.body || {};
    if (!appId || !url || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ ok: false, error: 'appId, url и events обязательны' } satisfies ApiResponse);
    }
    const app = await prisma.developerApp.findFirst({
      where: { id: appId, ownerUserId: req.user!.id },
    });
    if (!app) {
      return res.status(404).json({ ok: false, error: 'Приложение не найдено' } satisfies ApiResponse);
    }
    const secret = randomBytes(24).toString('hex');
    const webhook = await prisma.webhook.create({
      data: { appId, url, events, secret },
    });
    // Return secret so the integrator can verify HMAC signatures.
    return res.status(201).json({ ok: true, data: { ...webhook } } satisfies ApiResponse);
  } catch (error) {
    console.error('Create webhook error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании вебхука' } satisfies ApiResponse);
  }
});

developerRouter.get('/webhooks/:id/deliveries', async (req: AuthRequest, res) => {
  const webhook = await prisma.webhook.findUnique({
    where: { id: req.params.id as string },
    include: { app: { select: { ownerUserId: true } } },
  });
  if (!webhook || webhook.app.ownerUserId !== req.user!.id) {
    return res.status(404).json({ ok: false, error: 'Вебхук не найден' } satisfies ApiResponse);
  }
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: webhook.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json({ ok: true, data: deliveries } satisfies ApiResponse);
});

export default developerRouter;
