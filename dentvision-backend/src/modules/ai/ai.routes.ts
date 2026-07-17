import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import { aiService } from './core/ai.service.js';
import { prisma } from '../../lib/prisma.js';

const DEMO_CLINIC_ID = process.env.DEMO_CLINIC_ID || '';

export const aiRouter = Router();

aiRouter.use(optionalAuth);

const querySchema = z.object({
  body: z.object({
    text: z.string().min(1),
    sessionId: z.string().uuid().optional(),
  }),
});

aiRouter.post('/query', validate(querySchema), async (req: AuthRequest, res) => {
  try {
    const { text, sessionId } = req.body;

    const context = {
      userId: req.user?.id || 'guest',
      clinicId: req.user?.clinicId || DEMO_CLINIC_ID,
      role: req.user?.role || 'guest',
      currentPatientId: req.body.currentPatientId,
      currentAppointmentId: req.body.currentAppointmentId,
      sessionId: sessionId || crypto.randomUUID(),
      metadata: {},
    };

    const response = await aiService.processMessage(text, context, context.sessionId);

    res.json({ ok: true, data: response });
  } catch (error) {
    console.error('[AI Query Error]', error);
    res.status(500).json({ ok: false, error: 'AI query failed' });
  }
});

aiRouter.get('/history', async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const sessions = await prisma.aISession.findMany({
      where: { userId: req.user!.id, clinicId: req.user!.clinicId! },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        messages: true,
        context: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ ok: true, data: sessions });
  } catch (error) {
    console.error('[AI History Error]', error);
    res.status(500).json({ ok: false, error: 'History fetch failed' });
  }
});

aiRouter.post('/session', async (req: AuthRequest, res) => {
  try {
    const context = {
      userId: req.user!.id,
      clinicId: req.user!.clinicId!,
      role: req.user!.role,
      sessionId: crypto.randomUUID(),
      metadata: {},
    };

    // Just return a new session ID - actual session created on first query
    res.json({ ok: true, data: { sessionId: context.sessionId } });
  } catch (error) {
    console.error('[AI Session Error]', error);
    res.status(500).json({ ok: false, error: 'Session creation failed' });
  }
});

aiRouter.post('/greeting', async (req: AuthRequest, res) => {
  try {
    const hour = new Date().getHours();
    let greeting = 'Добрый день';
    if (hour < 6) greeting = 'Доброй ночи';
    else if (hour < 12) greeting = 'Доброе утро';
    else if (hour < 18) greeting = 'Добрый день';
    else greeting = 'Добрый вечер';

    const alerts = await aiService.getProactiveAlerts({
      userId: req.user?.id || 'guest',
      clinicId: req.user?.clinicId || DEMO_CLINIC_ID,
      role: req.user?.role || 'guest',
      sessionId: crypto.randomUUID(),
      metadata: {},
    });

    res.json({
      ok: true,
      data: {
        greeting: `${greeting}, ${req.user?.firstName || 'Гость'}!`,
        alerts: alerts.slice(0, 3),
      },
    });
  } catch (error) {
    console.error('[AI Greeting Error]', error);
    res.status(500).json({ ok: false, error: 'Greeting failed' });
  }
});

aiRouter.get('/proactive', async (req: AuthRequest, res) => {
  try {
    const alerts = await aiService.getProactiveAlerts({
      userId: req.user?.id || 'guest',
      clinicId: req.user?.clinicId || DEMO_CLINIC_ID,
      role: req.user?.role || 'guest',
      sessionId: crypto.randomUUID(),
      metadata: {},
    });

    res.json({ ok: true, data: { alerts } });
  } catch (error) {
    console.error('[AI Proactive Error]', error);
    res.status(500).json({ ok: false, error: 'Proactive failed' });
  }
});

aiRouter.post('/confirm', async (req: AuthRequest, res) => {
  try {
    const { actionId, confirmed, data } = req.body;

    if (!actionId || confirmed === undefined) {
      return res.status(400).json({ ok: false, error: 'actionId and confirmed required' });
    }

    // Here you would execute the confirmed action
    // For now just acknowledge
    res.json({ ok: true, data: { confirmed, actionId } });
  } catch (error) {
    console.error('[AI Confirm Error]', error);
    res.status(500).json({ ok: false, error: 'Confirm failed' });
  }
});

aiRouter.get('/digital-twin', async (req: AuthRequest, res) => {
  try {
    // Return digital twin state for user
    res.json({
      ok: true,
      data: {
        preferences: {},
        frequentActions: [],
        learningProgress: {},
      },
    });
  } catch (error) {
    console.error('[AI Digital Twin Error]', error);
    res.status(500).json({ ok: false, error: 'Digital twin failed' });
  }
});