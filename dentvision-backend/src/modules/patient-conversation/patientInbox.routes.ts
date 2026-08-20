// @ts-nocheck
/**
 * The staff side: where a patient's escalated question actually gets
 * answered. Scoped to OWNER/ADMIN — the same pair `notifyClinicOwners` and
 * `askClinicStaff` (#196) already notify, so the inbox shows exactly the
 * people who were told about it.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireClinicScope } from '../../lib/clinicAccess.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';
import { issueSseTicket, consumeSseTicket } from '../../lib/sseTicket.js';
import * as convo from './patientConversation.service.js';
import {
  EscalationError,
  listEscalations,
  resolveEscalation,
} from '../ai-admin/conversation/escalation.service.js';
import { clinicInboxHub, patientConversationHub } from './conversationHub.js';
import type { AuthRequest } from '../../types/index.js';

export const patientInboxRouter = Router();

const INBOX_ROLES = new Set(['OWNER', 'ADMIN', 'SUPERADMIN']);
const SSE_SCOPE = 'clinic-inbox';

/** `requireClinicScope` proves clinic membership; this adds the role bar the inbox needs on top of it. */
async function requireInboxAccess(req: AuthRequest, res: any): Promise<string | null> {
  const clinicId = requireClinicScope(req, res);
  if (!clinicId) return null;
  const access = await resolveClinicAccess(req.user!.id, clinicId);
  if (!access || !INBOX_ROLES.has(access.role)) {
    res.status(403).json({ ok: false, error: 'Доступно только владельцу и администратору клиники' });
    return null;
  }
  return clinicId;
}

// `authenticate` is applied per-route, not with a blanket `.use()` — see the
// matching comment in patientConversation.routes.ts: a router-level
// `.use(authenticate)` in front of /stream rejected every SSE connection
// before the route's own (ticket-based) check ever ran, since `EventSource`
// carries neither an Authorization header nor a cross-origin cookie.
patientInboxRouter.get('/conversations', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const status = req.query.status as any;
    const list = await convo.listForClinic(clinicId, status || undefined);
    return res.json({ ok: true, data: list });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientInboxRouter.get('/conversations/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const thread = await convo.getThreadForClinic(clinicId, req.params.id);
    return res.json({ ok: true, data: thread });
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientInboxRouter.post('/conversations/:id/claim', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const conversation = await convo.claimConversation(clinicId, req.params.id, req.user!.id);
    clinicInboxHub.broadcast(clinicId, { type: 'claimed', conversationId: conversation.id, by: req.user!.id });
    return res.json({ ok: true, data: conversation });
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    if (e?.code === 'FORBIDDEN') return res.status(409).json({ ok: false, error: e.message });
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientInboxRouter.post('/conversations/:id/reply', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Пустое сообщение' });

    const message = await convo.replyAsStaff(clinicId, req.params.id, req.user!.id, text);
    patientConversationHub.broadcast(req.params.id, { type: 'message', message });
    clinicInboxHub.broadcast(clinicId, { type: 'reply', conversationId: req.params.id });
    return res.json({ ok: true, data: message });
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    if (e?.code === 'FORBIDDEN') return res.status(409).json({ ok: false, error: e.message });
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientInboxRouter.post('/conversations/:id/resolve', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const conversation = await convo.resolveConversation(clinicId, req.params.id);
    clinicInboxHub.broadcast(clinicId, { type: 'resolved', conversationId: conversation.id });
    return res.json({ ok: true, data: conversation });
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * POST /api/patient-inbox/ticket
 * Mint a short-lived, one-time ticket for the /stream connection below.
 */
patientInboxRouter.post('/ticket', authenticate, (req: AuthRequest, res) => {
  res.json({ ok: true, data: { ticket: issueSseTicket(req.user!.id, SSE_SCOPE) } });
});

/** Same one-time-ticket SSE shape as the patient side — see that file's doc comment. */
patientInboxRouter.get('/stream', async (req, res) => {
  const ticket = String(req.query.ticket || '');
  const clinicId = String(req.query.clinicId || '');
  if (!ticket || !clinicId) return res.status(401).json({ ok: false, error: 'ticket и clinicId обязательны' });

  const userId = consumeSseTicket(ticket, SSE_SCOPE);
  if (!userId) return res.status(401).json({ ok: false, error: 'Недействительный или истёкший ticket' });

  const access = await resolveClinicAccess(userId, clinicId);
  if (!access || !INBOX_ROLES.has(access.role)) {
    return res.status(403).json({ ok: false, error: 'Нет доступа' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const unsubscribe = clinicInboxHub.add(clinicId, res);
  const keepalive = setInterval(() => res.write(`: keepalive ${Date.now()}\n\n`), 30_000);
  res.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

// ─── AI escalations ───
//
// Lives beside the conversation inbox because it is the same job: a human
// picking up what the assistant could not handle. `markEscalated` already
// notified the clinic's owners; what did not exist was any way to see what is
// still outstanding, or to close it. The schema was ready for both —
// `resolvedAt`, `resolvedBy` and an index on `[clinicId, resolvedAt]` — and
// nothing wrote or read them.

/** What is still waiting on a human. Clinic-scoped in the query. */
patientInboxRouter.get('/escalations', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const data = await listEscalations(clinicId, {
      includeResolved: req.query.includeResolved === 'true',
      take: req.query.take ? Number(req.query.take) : undefined,
    });
    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/** Close one out, recording who did it — the end state the model always had. */
patientInboxRouter.post('/escalations/:id/resolve', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = await requireInboxAccess(req, res);
    if (!clinicId) return;
    const data = await resolveEscalation(clinicId, String(req.params.id), req.user!.id);
    return res.json({ ok: true, data });
  } catch (e: any) {
    if (e instanceof EscalationError) return res.status(404).json({ ok: false, error: e.message });
    return res.status(500).json({ ok: false, error: e.message });
  }
});
