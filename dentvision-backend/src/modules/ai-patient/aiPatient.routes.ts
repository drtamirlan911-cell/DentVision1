/**
 * The patient assistant's endpoints.
 *
 * Mounted under the portal rather than under `/api/ai`, deliberately: the
 * staff router carries `guardAiAccess` (a clinic billing gate) and a role
 * surface that has nothing to do with a patient reading their own card. A
 * patient's access to their record should not depend on their clinic's plan.
 */

import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import { resolvePatientForUser } from '../patient-portal/patientLink.js';
import { runPatientTurn } from './patientAgent.js';
import { consumePatientAi, patientAiRemaining, PATIENT_AI_DAILY_LIMIT } from '../../lib/patientAiQuota.js';
import type { AuthRequest } from '../../types/index.js';

export const aiPatientRouter = Router();
aiPatientRouter.use(authenticate);

const AI_CONSENT_TYPE = 'ai_assistant';
const AI_CONSENT_VERSION = '1.0';
/** Turns replayed as context. Enough to follow a thread, short enough to stay cheap. */
const HISTORY_TURNS = 12;

async function hasAiConsent(userId: string): Promise<boolean> {
  const row = await prisma.consent.findFirst({
    where: { userId, type: AI_CONSENT_TYPE, version: AI_CONSENT_VERSION, accepted: true },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * The assistant's thread for this patient, reusing the existing AI tables.
 *
 * `AISession.clinicId` is required by the schema, and a patient always has one
 * — it is the clinic holding their card — so this needs no migration.
 */
async function getOrCreateSession(userId: string, clinicId: string) {
  const existing = await prisma.aISession.findFirst({
    where: { userId, clinicId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.aISession.create({
    data: { id: uid(), userId, clinicId, messages: [], context: { surface: 'patient-portal' } },
    select: { id: true },
  });
  return created.id;
}

/** Whether the patient has agreed, and how much of today's allowance is left. */
aiPatientRouter.get('/status', async (req: AuthRequest, res) => {
  try {
    const match = await resolvePatientForUser(req.user);
    return res.json({
      ok: true,
      data: {
        linked: Boolean(match),
        consented: await hasAiConsent(req.user.id),
        remaining: patientAiRemaining(req.user.id),
        dailyLimit: PATIENT_AI_DAILY_LIMIT,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/** Record the patient's agreement to let the assistant read their record. */
aiPatientRouter.post('/consent', async (req: AuthRequest, res) => {
  try {
    const accepted = req.body?.accepted !== false;
    await prisma.consent.create({
      data: {
        id: uid(),
        userId: req.user.id,
        type: AI_CONSENT_TYPE,
        version: AI_CONSENT_VERSION,
        accepted,
        ipAddress: req.ip || null,
      },
    });
    return res.json({ ok: true, data: { consented: accepted } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

aiPatientRouter.get('/history', async (req: AuthRequest, res) => {
  try {
    const match = await resolvePatientForUser(req.user);
    if (!match) return res.json({ ok: true, data: [] });
    const sessionId = await getOrCreateSession(req.user.id, match.clinicId);
    const rows = await prisma.aIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return res.json({ ok: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

aiPatientRouter.post('/chat', async (req: AuthRequest, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Пустое сообщение' });
    if (text.length > 2000) return res.status(400).json({ ok: false, error: 'Сообщение слишком длинное' });

    // Identity first, and only from the session. Everything downstream reads
    // this patient id; nothing reads one from the request body.
    const match = await resolvePatientForUser(req.user);
    if (!match) {
      return res.status(403).json({
        ok: false,
        error: 'Ваш аккаунт ещё не связан с картой пациента. Обратитесь в клинику.',
      });
    }

    if (!(await hasAiConsent(req.user.id))) {
      return res.status(412).json({ ok: false, error: 'CONSENT_REQUIRED' });
    }

    const remaining = consumePatientAi(req.user.id);
    if (remaining < 0) {
      return res.status(429).json({
        ok: false,
        error: `Дневной лимит вопросов исчерпан (${PATIENT_AI_DAILY_LIMIT}). Разделы кабинета и связь с клиникой работают как обычно.`,
      });
    }

    const sessionId = await getOrCreateSession(req.user.id, match.clinicId);

    const priorRows = await prisma.aIMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    });
    const history = priorRows.reverse().map((m: any) => ({ role: m.role, content: m.content }));

    const result = await runPatientTurn(text, history, {
      userId: req.user.id,
      patientId: match.id,
      clinicId: match.clinicId,
    });

    if (result.unavailable) {
      // The provider is down or unconfigured. Say so plainly instead of
      // returning an empty bubble the patient reads as "it ignored me".
      return res.status(503).json({
        ok: false,
        error: 'Ассистент сейчас недоступен. Разделы кабинета работают, а вопрос можно задать клинике напрямую.',
      });
    }

    await prisma.aIMessage.create({
      data: { id: uid(), sessionId, role: 'user', content: text, userId: req.user.id, clinicId: match.clinicId },
    });
    await prisma.aIMessage.create({
      data: {
        id: uid(),
        sessionId,
        role: 'assistant',
        content: result.reply,
        userId: req.user.id,
        clinicId: match.clinicId,
        prevUserText: text,
      },
    });

    return res.json({
      ok: true,
      data: {
        reply: result.reply,
        toolsUsed: result.toolsUsed,
        data: result.data,
        remaining,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});
