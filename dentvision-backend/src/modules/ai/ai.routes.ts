import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import { aiService } from './core/ai.service.js';
import { improveResponseWithLLM } from './core/llm.service.js';
import { orchestrate, orchestratorEnabled } from './os/orchestrator.js';
import type { AIResponse } from './types/ai.types.js';
import { prisma } from '../../lib/prisma.js';

const DEMO_CLINIC_ID = process.env.DEMO_CLINIC_ID || '';

export const aiRouter = Router();

aiRouter.use(optionalAuth);

const querySchema = z.object({
  body: z.object({
    text: z.string().min(1),
    message: z.string().optional(),
    sessionId: z.string().min(8).optional(),
    timezone: z.string().min(1).optional(),
    timeZone: z.string().min(1).optional(),
    history: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })).optional(),
  }),
});

/** Stable AI session per authenticated user (and clinic when present). */
async function resolveUserSessionId(req: AuthRequest, requested?: string): Promise<string> {
  if (!req.user?.id || req.user.isGuest) {
    return requested && requested.length >= 8 ? requested : crypto.randomUUID();
  }

  const userId = req.user.id;
  const clinicId = req.user.clinicId || DEMO_CLINIC_ID || 'platform';

  if (requested) {
    const owned = await prisma.aISession.findFirst({
      where: { id: requested, userId },
      select: { id: true },
    });
    if (owned) return owned.id;
  }

  const existing = await prisma.aISession.findFirst({
    where: { userId, clinicId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const id = requested && requested.length >= 8 ? requested : crypto.randomUUID();
  await prisma.aISession.create({
    data: {
      id,
      userId,
      clinicId,
      messages: [],
      context: {},
    },
  });
  return id;
}

async function syncSessionMessages(sessionId: string, userId: string | undefined, clinicId: string | undefined) {
  if (!userId) return;
  try {
    const rows = await prisma.aIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 80,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    const messages = rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      timestamp: r.createdAt.toISOString(),
    }));
    await prisma.aISession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId,
        clinicId: clinicId || DEMO_CLINIC_ID || 'platform',
        messages,
        context: {},
      },
      update: { messages },
    });
  } catch (err) {
    console.error('[AI] syncSessionMessages', err);
  }
}

interface ProcessedResponse extends AIResponse {
  toolsUsed?: string[];
}

/**
 * Convert the orchestrator's pending confirmation into an action card the
 * existing AI workspace UI already knows how to render and execute: the
 * user confirms → UI POSTs /api/ai/action with {action, params} → the
 * RBAC-checked tool layer performs the mutation.
 */
/** Human labels for actions shown as chat chips — never expose raw SCREAMING_SNAKE types. */
const ACTION_LABELS: Record<string, string> = {
  OPEN_SCHEDULE: 'Открыть расписание',
  OpenSchedule: 'Открыть расписание',
  OPEN_CRM: 'Открыть CRM',
  OpenCRM: 'Открыть CRM',
  OPEN_PATIENTS: 'Открыть пациентов',
  OpenPatients: 'Открыть пациентов',
  OPEN_SCHOOL: 'Открыть школу',
  OpenSchool: 'Открыть школу',
  OPEN_SHOP: 'Открыть магазин',
  OpenShop: 'Открыть магазин',
  OPEN_FINANCE: 'Открыть финансы',
  OpenFinance: 'Открыть финансы',
  OPEN_LABORATORY: 'Открыть лабораторию',
  OpenLab: 'Открыть лабораторию',
  OPEN_ANALYTICS: 'Открыть аналитику',
  OpenAnalytics: 'Открыть аналитику',
  OPEN_INVENTORY: 'Открыть склад',
  OpenInventory: 'Открыть склад',
  OPEN_DOCUMENTS: 'Открыть документы',
  OpenDocuments: 'Открыть документы',
  OPEN_MEDICAL_CARD: 'Открыть карту',
  OpenMedicalCard: 'Открыть карту',
  OpenReminders: 'Открыть напоминания',
  OPEN_INVOICE: 'Открыть счёт',
};

/** Display-only payloads (SHOW_*) are not clickable navigation — keep them out of chips. */
const DISPLAY_ONLY_ACTIONS = new Set([
  'SHOW_BRIEFING',
  'SHOW_REVENUE',
  'SHOW_DEBTORS',
  'SHOW_UTILIZATION',
]);

function responseActions(response: ProcessedResponse): Array<Record<string, unknown>> {
  const actions: Array<Record<string, unknown>> = [];
  if (response.action && !DISPLAY_ONLY_ACTIONS.has(response.action.type)) {
    const type = response.action.type;
    actions.push({
      type,
      label: ACTION_LABELS[type] || response.action.type.replace(/^Open/, 'Открыть '),
      params: response.action.payload,
      confidence: 1,
      requiresConfirmation: false,
    });
  }
  const confirm = response.confirmData as { action?: string; params?: Record<string, unknown>; summary?: string } | undefined;
  if (confirm?.action) {
    actions.push({
      type: confirm.action,
      label: confirm.summary || ACTION_LABELS[confirm.action] || confirm.action,
      params: confirm.params || {},
      confidence: 1,
      requiresConfirmation: true,
    });
  }
  return actions;
}

/**
 * Single entry point for both /query and /query/stream.
 * Authenticated users with a working OPENAI_API_KEY get the full AI OS
 * orchestrator (tool calling over live clinic data). Guests and
 * LLM-unavailable situations fall back to the deterministic intent router.
 */
async function processQuery(
  req: AuthRequest,
  text: string,
  sessionId: string,
  history: Array<{ role: string; content: string }>,
): Promise<ProcessedResponse> {
  const isGuest = !req.user || req.user.isGuest === true;
  const { clientTimeZoneFromRequest } = await import('./lib/timezone.js');
  const timeZone = clientTimeZoneFromRequest({
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: (req.body || {}) as Record<string, unknown>,
    query: (req.query || {}) as Record<string, unknown>,
  });

  // Guests get a product concierge (LLM) — not the clinic CRM intent router.
  if (orchestratorEnabled()) {
    try {
      const result = await orchestrate({
        text,
        userId: req.user?.id || 'guest',
        clinicId: isGuest ? null : (req.user!.clinicId || null),
        role: isGuest ? 'GUEST' : req.user!.role,
        userName: isGuest
          ? 'Гость'
          : [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' '),
        sessionId,
        history,
        isGuest,
        timeZone,
      });
      return {
        message: result.message,
        intent: result.intent,
        action: result.action,
        suggestions: result.suggestions,
        needsConfirmation: result.needsConfirmation,
        confirmData: result.confirmData,
        toolsUsed: result.toolsUsed,
      };
    } catch (error) {
      console.error('[AI OS] orchestrator failed, falling back to intent router:', error);
    }
  }

  const context = {
    userId: req.user?.id || 'guest',
    clinicId: isGuest ? '' : (req.user?.clinicId || DEMO_CLINIC_ID),
    role: isGuest ? 'guest' : (req.user?.role || 'guest'),
    isGuest,
    sessionId,
    metadata: { timeZone },
  };
  const response = await aiService.processMessage(text, context, sessionId);
  response.message = (await improveResponseWithLLM(text, response, context)) || response.message;
  return response;
}

aiRouter.post('/query', validate(querySchema), async (req: AuthRequest, res) => {
  try {
    const { text, message, sessionId: rawSession, history = [] } = req.body;
    const prompt = String(text || message || '').trim();
    const sessionId = await resolveUserSessionId(req, rawSession);
    const response = await processQuery(req, prompt, sessionId, history);
    await syncSessionMessages(sessionId, req.user?.id, req.user?.clinicId || undefined);
    return res.json({
      ok: true,
      data: {
        ...response,
        reply: response.message,
        sessionId,
        actions: responseActions(response),
      },
    });
  } catch (error) {
    console.error('[AI] query', error);
    return res.status(500).json({ ok: false, error: 'AI query failed' });
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

    const sessionId = await resolveUserSessionId(req, req.body.sessionId);
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Keep the connection visibly alive while the orchestrator plans and
    // executes tools (can take several seconds with multi-step chains).
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'thinking' })}\n\n`);
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'status', status: 'working' })}\n\n`);
    }, 8000);

    let response: ProcessedResponse;
    try {
      response = await processQuery(req, text, sessionId, history);
      await syncSessionMessages(sessionId, req.user?.id, req.user?.clinicId || undefined);
    } finally {
      clearInterval(heartbeat);
    }

    // Progressive rendering of the final message.
    const message = response.message || '';
    const chunkSize = Math.max(8, Math.ceil(message.length / 40));
    for (let i = 0; i < message.length; i += chunkSize) {
      res.write(`data: ${JSON.stringify({ type: 'token', text: message.slice(i, i + chunkSize) })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      reply: message,
      skill: response.intent || 'general',
      actions: responseActions(response),
      suggestions: response.suggestions || [],
      toolsUsed: response.toolsUsed || [],
      sessionId,
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('[AI Stream Error]', error);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI stream failed' })}\n\n`);
      res.end();
    } catch { /* headers may not be sent */ }
  }
});

// Per-user durable threads backed by AISession + AIMessage.
aiRouter.get('/threads', authenticate, async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.aISession.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, clinicId: true, updatedAt: true, createdAt: true },
    });
    return res.json({
      ok: true,
      data: {
        threads: sessions.map((s) => ({
          threadId: s.id,
          clinicId: s.clinicId,
          updatedAt: s.updatedAt,
          createdAt: s.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('[AI] threads list', error);
    return res.json({ ok: true, data: { threads: [] } });
  }
});

aiRouter.get('/threads/active', authenticate, async (req: AuthRequest, res) => {
  try {
    const sessionId = await resolveUserSessionId(req);
    const session = await prisma.aISession.findFirst({
      where: { id: sessionId, userId: req.user!.id },
    });
    let messages: Array<{ id: string; role: string; content: string; timestamp?: string }> = [];
    if (Array.isArray(session?.messages) && (session!.messages as any[]).length) {
      messages = session!.messages as any;
    } else {
      const rows = await prisma.aIMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 80,
      });
      messages = rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        timestamp: r.createdAt.toISOString(),
      }));
    }
    return res.json({
      ok: true,
      data: {
        threadId: sessionId,
        sessionId,
        messages,
        turnCount: messages.length,
        entities: {},
      },
    });
  } catch (error) {
    console.error('[AI] threads active', error);
    return res.json({ ok: true, data: { threadId: null, messages: [], turnCount: 0, entities: {} } });
  }
});

aiRouter.post('/threads/new', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId || DEMO_CLINIC_ID || 'platform';
    const id = crypto.randomUUID();
    await prisma.aISession.create({
      data: {
        id,
        userId: req.user!.id,
        clinicId,
        messages: [],
        context: {},
      },
    });
    return res.json({ ok: true, data: { threadId: id, sessionId: id } });
  } catch (error) {
    console.error('[AI] threads new', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать сессию' });
  }
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

  // Confirmed mutations coming back from an orchestrator confirm card
  // (createAppointment / createInvoice / createTreatmentPlan with
  // confirmed=true) execute through the same RBAC-checked tool layer.
  const { executeTool: runTool } = await import('./os/tools.js');
  const { toolsForRole } = await import('./os/registry.js');
  const allowed = toolsForRole(req.user!.role);
  if (allowed.has(action)) {
    const result = await runTool(action, params, {
      userId: req.user!.id,
      clinicId: req.user!.clinicId || null,
      role: req.user!.role,
    }, allowed);

    if (!result.ok) return res.json({ ok: true, data: { type: 'error', message: result.error } });
    if (result.needsConfirmation) {
      return res.json({ ok: true, data: { type: 'data', data: result.needsConfirmation, label: 'Требуется подтверждение' } });
    }
    return res.json({
      ok: true,
      data: {
        type: result.navigate ? 'created' : 'data',
        data: result.data,
        label: action,
        path: result.navigate,
      },
    });
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
    const {
      timeGreetingInTz,
      resolveTimeZone,
      clientTimeZoneFromRequest,
      DEFAULT_CLINIC_TZ,
    } = await import('./lib/timezone.js');
    const clinicId = req.user?.clinicId || DEMO_CLINIC_ID;
    let clinicTz: string | null = null;
    if (clinicId) {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { settings: true },
      });
      const settings = (clinic?.settings || {}) as { timezone?: string };
      clinicTz = settings.timezone || null;
    }
    const clientTz = clientTimeZoneFromRequest({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: (req.body || {}) as Record<string, unknown>,
    });
    const timeZone = resolveTimeZone(clientTz, clinicTz, DEFAULT_CLINIC_TZ);
    const greeting = timeGreetingInTz(new Date(), timeZone);

    const alerts = await aiService.getProactiveAlerts({
      userId: req.user?.id || 'guest',
      clinicId,
      role: req.user?.role || 'guest',
      sessionId: crypto.randomUUID(),
      metadata: { timeZone },
    });

    res.json({
      ok: true,
      data: {
        greeting: `${greeting}, ${req.user?.firstName || 'Гость'}!`,
        alerts: alerts.slice(0, 3),
        timeZone,
      },
    });
  } catch (error) {
    console.error('[AI Greeting Error]', error);
    res.status(500).json({ ok: false, error: 'Greeting failed' });
  }
});

aiRouter.get('/proactive', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { buildProactiveAlerts } = await import('./core/digitalTwin.js');
    const alerts = await buildProactiveAlerts({
      userId: req.user?.id || 'guest',
      clinicId: req.user?.isGuest ? null : (req.user?.clinicId || null),
      role: req.user?.isGuest ? 'GUEST' : (req.user?.role || 'guest'),
      isGuest: req.user?.isGuest === true,
    });
    res.json({ ok: true, data: { alerts } });
  } catch (error) {
    console.error('[AI Proactive Error]', error);
    res.status(500).json({ ok: false, error: 'Proactive failed' });
  }
});

/** Jarvis role briefing — used on login / «Что важно сегодня?» */
aiRouter.get('/briefing', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.isGuest) {
      return res.status(403).json({ ok: false, error: 'Briefing requires clinic user' });
    }
    const { buildJarvisBriefing } = await import('./core/jarvisBriefing.js');
    const clinicId = req.user!.clinicId || null;
    const clinic = clinicId
      ? await prisma.clinic.findUnique({
          where: { id: clinicId },
          select: { name: true },
        }).catch(() => null)
      : null;
    const { clientTimeZoneFromRequest } = await import('./lib/timezone.js');
    const timeZone = clientTimeZoneFromRequest({
      headers: req.headers as Record<string, string | string[] | undefined>,
      query: (req.query || {}) as Record<string, unknown>,
    });
    const briefing = await buildJarvisBriefing({
      userId: req.user!.id,
      clinicId,
      role: req.user!.role,
      firstName: req.user!.firstName,
      clinicName: clinic?.name,
      isGuest: false,
      timeZone,
    });
    res.json({
      ok: true,
      data: {
        reply: briefing.message,
        message: briefing.message,
        suggestions: briefing.suggestions,
        skill: 'practice',
        intent: 'MORNING_BRIEFING',
        action: { type: 'SHOW_BRIEFING', payload: briefing.payload },
        role: briefing.role,
        timeZone: briefing.payload?.timeZone || timeZone,
      },
    });
  } catch (error) {
    console.error('[AI Briefing Error]', error);
    res.status(500).json({ ok: false, error: 'Briefing failed' });
  }
});

aiRouter.post('/confirm', authenticate, async (req: AuthRequest, res) => {
  try {
    const { actionId, action, confirmed, data, params } = req.body || {};
    const toolName = String(action || actionId || '');
    if (!toolName || confirmed === undefined) {
      return res.status(400).json({ ok: false, error: 'action (или actionId) и confirmed обязательны' });
    }
    if (!confirmed) {
      return res.json({ ok: true, data: { confirmed: false, action: toolName } });
    }

    const { executeTool: runTool } = await import('./os/tools.js');
    const { toolsForRole } = await import('./os/registry.js');
    const allowed = toolsForRole(req.user!.role);
    if (!allowed.has(toolName)) {
      return res.status(403).json({ ok: false, error: 'Действие недоступно для роли' });
    }

    const result = await runTool(
      toolName,
      { ...(params || data || {}), confirmed: true },
      {
        userId: req.user!.id,
        clinicId: req.user!.clinicId || null,
        role: req.user!.role,
      },
      allowed,
    );

    if (!result.ok) return res.json({ ok: false, error: result.error });
    return res.json({
      ok: true,
      data: {
        confirmed: true,
        action: toolName,
        result: result.data,
        path: result.navigate,
      },
    });
  } catch (error) {
    console.error('[AI Confirm Error]', error);
    res.status(500).json({ ok: false, error: 'Confirm failed' });
  }
});

aiRouter.get('/digital-twin', authenticate, async (req: AuthRequest, res) => {
  try {
    const { buildDigitalTwin } = await import('./core/digitalTwin.js');
    const twin = await buildDigitalTwin(req.user!.id, req.user?.clinicId || null, {
      isGuest: req.user?.isGuest === true,
    });
    if (!twin) {
      return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
    }
    res.json({ ok: true, data: { twin } });
  } catch (error) {
    console.error('[AI Digital Twin Error]', error);
    res.status(500).json({ ok: false, error: 'Digital twin failed' });
  }
});