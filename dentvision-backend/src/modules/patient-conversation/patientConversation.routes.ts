// @ts-nocheck
/**
 * The patient's side of the live-human channel — reading and replying to a
 * thread `askClinicStaff` already opened. There is no "start a live chat"
 * button here on purpose: the assistant is the one deciding when a human is
 * needed (see `patientTools.ts::askClinicStaff`), so a thread only exists
 * once that has already happened.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { verifyAccessToken } from '../../lib/jwt.js';
import { resolvePatientForUser } from '../patient-portal/patientLink.js';
import * as convo from './patientConversation.service.js';
import { patientConversationHub } from './conversationHub.js';
import type { AuthRequest } from '../../types/index.js';

export const patientConversationRouter = Router();

async function requireLinkedPatient(req: AuthRequest, res: any) {
  const match = await resolvePatientForUser(req.user!);
  if (!match) {
    res.status(403).json({ ok: false, error: 'Ваш аккаунт ещё не связан с картой пациента.' });
    return null;
  }
  return match;
}

patientConversationRouter.use(authenticate);

patientConversationRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const match = await requireLinkedPatient(req, res);
    if (!match) return;

    const conversation = await convo.getCurrentConversation(req.user!.id, match.clinicId);
    if (!conversation) return res.json({ ok: true, data: null });

    const messages = await convo.getMessages(conversation.id);
    return res.json({
      ok: true,
      data: {
        id: conversation.id,
        status: conversation.status,
        createdAt: conversation.createdAt,
        // Patient-facing view — internal staff bookkeeping (who claimed it,
        // why the assistant handed off) stays out of this response.
        messages: messages
          .filter((m) => m.authorType !== 'SYSTEM')
          .map((m) => ({ id: m.id, authorType: m.authorType, body: m.body, createdAt: m.createdAt })),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientConversationRouter.post('/message', async (req: AuthRequest, res) => {
  try {
    const match = await requireLinkedPatient(req, res);
    if (!match) return;

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Пустое сообщение' });
    if (text.length > 2000) return res.status(400).json({ ok: false, error: 'Сообщение слишком длинное' });

    const conversation = await convo.getCurrentConversation(req.user!.id, match.clinicId);
    if (!conversation || conversation.status === 'RESOLVED') {
      return res.status(404).json({
        ok: false,
        error: 'Открытого диалога с клиникой нет. Спросите ассистента — он передаст вопрос при необходимости.',
      });
    }

    const message = await convo.appendMessage(conversation.id, 'PATIENT', text);
    patientConversationHub.broadcast(conversation.id, { type: 'message', message });
    return res.json({ ok: true, data: message });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * SSE, token via query string — an `EventSource` cannot set an Authorization
 * header, the same constraint `ai.notifications.routes.ts` works around.
 * Verified with `verifyAccessToken` (the same check `authenticate` runs),
 * not a hand-rolled `jwt.verify`, so this endpoint cannot drift from the
 * app's actual auth rules.
 */
patientConversationRouter.get('/stream', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(401).json({ ok: false, error: 'token обязателен' });

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return res.status(401).json({ ok: false, error: 'Недействительный токен' });
  }

  const { default: prisma } = await import('../../lib/prisma.js');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

  const match = await resolvePatientForUser(user as any);
  if (!match) return res.status(403).json({ ok: false, error: 'Карта пациента не найдена' });

  const conversation = await convo.getCurrentConversation(userId, match.clinicId);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Диалог не найден' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', conversationId: conversation.id })}\n\n`);

  const unsubscribe = patientConversationHub.add(conversation.id, res);
  const keepalive = setInterval(() => res.write(`: keepalive ${Date.now()}\n\n`), 30_000);
  res.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});
