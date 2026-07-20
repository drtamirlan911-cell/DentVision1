import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import { aiService } from './core/ai.service.js';
import { improveResponseWithLLM } from './core/llm.service.js';
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
      isGuest: !req.user || req.user.isGuest === true,
      currentPatientId: req.body.currentPatientId,
      currentAppointmentId: req.body.currentAppointmentId,
      sessionId: sessionId || crypto.randomUUID(),
      metadata: {},
    };

    const response = await aiService.processMessage(text, context, context.sessionId);
    response.message = await improveResponseWithLLM(text, response, context) || response.message;

    res.json({ ok: true, data: response });
  } catch (error) {
    console.error('[AI Query Error]', error);
    res.status(500).json({ ok: false, error: 'AI query failed' });
  }
});

// The web client uses this endpoint for progressive rendering.  Keep the
// protocol compatible even when the current AI provider returns a complete
// response rather than provider-level token events.
aiRouter.post('/query/stream', async (req: AuthRequest, res) => {
  try {
    const text = req.body.text || req.body.message;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'Text is required' });
    }

    const sessionId = req.body.sessionId || crypto.randomUUID();
    const context = {
      userId: req.user?.id || 'guest',
      clinicId: req.user?.clinicId || DEMO_CLINIC_ID,
      role: req.user?.role || 'guest',
      isGuest: !req.user || req.user.isGuest === true,
      currentPatientId: req.body.currentPatientId,
      currentAppointmentId: req.body.currentAppointmentId,
      sessionId,
      metadata: {},
    };
    const response = await aiService.processMessage(text, context, sessionId);
    response.message = await improveResponseWithLLM(text, response, context) || response.message;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'token', text: response.message || '' })}\n\n`);
    res.write(`data: ${JSON.stringify({
      type: 'done',
      reply: response.message || '',
      skill: response.intent || 'general',
      actions: response.action ? [{
        type: response.action.type,
        label: response.action.type,
        params: response.action.payload,
        confidence: 1,
        requiresConfirmation: response.needsConfirmation,
      }] : [],
      suggestions: response.suggestions || [],
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('[AI Stream Error]', error);
    res.status(500).json({ ok: false, error: 'AI stream failed' });
  }
});

// Durable threads are not yet modelled in the deployed schema.  These
// compatibility endpoints let the client restore safely while sessions are
// persisted by the AI memory layer.
aiRouter.get('/threads', authenticate, async (_req: AuthRequest, res) => {
  res.json({ ok: true, data: { threads: [] } });
});

aiRouter.get('/threads/active', authenticate, async (_req: AuthRequest, res) => {
  res.json({ ok: true, data: { threadId: null, messages: [], turnCount: 0, entities: {} } });
});

aiRouter.post('/threads/new', authenticate, async (_req: AuthRequest, res) => {
  res.json({ ok: true, data: { threadId: null } });
});

// Mirrors the frontend NAVIGATION_ACTIONS maps in aiExecutor.ts /
// AIWorkspaceIndex.tsx. Quick-action buttons (proactive alerts, context
// panel) call POST /action directly with one of these names and expect
// `{ type: 'navigate', path }` back — anything else silently dumped the
// action's raw params into the chat instead of navigating.
const NAVIGATION_ACTION_PATHS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OpenPatient: '/crm/patients',
  OpenMedicalCard: '/crm/medical-card',
  OpenCashier: '/crm/finance',
  OpenFinance: '/crm/finance',
  OpenLab: '/crm/lab',
  OpenInventory: '/crm/inventory',
  OpenStaff: '/crm/staff',
  OpenVisits: '/crm/visits',
  OpenDocuments: '/crm/documents',
  OpenReminders: '/crm/reminders',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenShop: '/shop',
  OpenSchool: '/school',
  OpenAnalytics: '/analytics',
  OpenProfile: '/profile',
  OpenSettings: '/settings',
  OpenMyClinics: '/my-clinics',
  OpenCRM: '/crm/schedule',
};

aiRouter.post('/action', authenticate, async (req: AuthRequest, res) => {
  const { action, params = {} } = req.body;
  if (!action) return res.status(400).json({ ok: false, error: 'Action is required' });

  const path = NAVIGATION_ACTION_PATHS[action];
  if (path) {
    return res.json({ ok: true, data: { type: 'navigate', path, query: params } });
  }

  // Unknown/unimplemented action — return the params back rather than 404
  // so the AI workspace can still show something instead of crashing.
  res.json({ ok: true, data: { type: 'data', data: params, label: action } });
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