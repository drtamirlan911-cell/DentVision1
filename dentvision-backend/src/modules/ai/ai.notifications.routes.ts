import { Router, Response, Request } from 'express';
import { EventEmitter } from 'events';
import { isOriginAllowed } from '../../lib/cors.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';
import { authenticate } from '../../middleware/auth.js';
import { issueSseTicket, consumeSseTicket } from '../../lib/sseTicket.js';
import type { AuthRequest } from '../../types/index.js';

const SSE_SCOPE = 'ai-notifications';

export interface NotificationEvent {
  id: string;
  type: 'ai_event' | 'alert' | 'agent_status' | 'timeline_update';
  data: Record<string, unknown>;
  timestamp: string;
  clinicId: string;
  targetUserIds?: string[];
}

class SSEManager extends EventEmitter {
  private clients = new Map<string, Map<Response, string>>();

  addClient(clinicId: string, res: Response, userId: string): () => void {
    if (!this.clients.has(clinicId)) this.clients.set(clinicId, new Map());
    this.clients.get(clinicId)!.set(res, userId);
    res.on('close', () => {
      this.clients.get(clinicId)?.delete(res);
      if (this.clients.get(clinicId)?.size === 0) this.clients.delete(clinicId);
    });
    return () => this.clients.get(clinicId)?.delete(res);
  }

  /** Broadcast only to the intended users; an omitted target is clinic-wide status, not patient data. */
  broadcast(clinicId: string, event: NotificationEvent): void {
    const clients = this.clients.get(clinicId);
    if (!clients || clients.size === 0) return;
    const targets = event.targetUserIds?.length ? new Set(event.targetUserIds) : null;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const [client, userId] of clients) {
      if (targets && !targets.has(userId)) continue;
      client.write(payload);
    }
  }

  broadcastAll(event: NotificationEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const clients of this.clients.values()) for (const client of clients.keys()) client.write(payload);
  }

  getClientCount(clinicId: string): number { return this.clients.get(clinicId)?.size || 0; }
  getTotalClients(): number {
    let total = 0;
    for (const clients of this.clients.values()) total += clients.size;
    return total;
  }
}

export const sseManager = new SSEManager();

const router = Router();

router.post('/ticket', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ ok: true, data: { ticket: issueSseTicket(req.user!.id, SSE_SCOPE) } });
});

router.get('/stream', async (req: Request, res: Response) => {
  const clinicId = req.query.clinicId as string;
  const ticket = req.query.ticket as string;
  if (!clinicId || !ticket) {
    res.status(401).json({ ok: false, error: 'clinicId and ticket required' });
    return;
  }

  const userId = consumeSseTicket(ticket, SSE_SCOPE);
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Invalid or expired ticket' });
    return;
  }
  const access = await resolveClinicAccess(userId, clinicId);
  if (!access) { res.status(403).json({ ok: false, error: 'Нет доступа к клинике' }); return; }

  const origin = req.headers.origin || '';
  const allowedOrigin = isOriginAllowed(origin) ? origin : process.env.CORS_ORIGIN || '';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  res.write(`data: ${JSON.stringify({ id: `connect-${Date.now()}`, type: 'agent_status', data: { status: 'connected', message: 'SSE connection established' }, timestamp: new Date().toISOString(), clinicId })}\n\n`);
  const unsubscribe = sseManager.addClient(clinicId, res, userId);
  const keepalive = setInterval(() => res.write(`: keepalive ${Date.now()}\n\n`), 30_000);
  res.on('close', () => { clearInterval(keepalive); unsubscribe(); });
});

router.get('/stats', (_req: Request, res: Response) => {
  res.json({ ok: true, data: { totalClients: sseManager.getTotalClients() } });
});

export default router;
