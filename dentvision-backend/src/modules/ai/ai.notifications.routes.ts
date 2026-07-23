/**
 * SSE Notification Server — real-time AI notifications for frontend.
 *
 * Provides Server-Sent Events endpoint for:
 *  - AI event processing results
 *  - Proactive alerts
 *  - Agent status updates
 */

import { Router, Response, Request } from 'express';
import { EventEmitter } from 'events';

// ─── Types ───

export interface NotificationEvent {
  id: string;
  type: 'ai_event' | 'alert' | 'agent_status' | 'timeline_update';
  data: Record<string, unknown>;
  timestamp: string;
  clinicId: string;
}

// ─── SSE Manager ───

class SSEManager extends EventEmitter {
  private clients = new Map<string, Set<Response>>();

  /** Register a client for a clinic. */
  addClient(clinicId: string, res: Response): () => void {
    if (!this.clients.has(clinicId)) {
      this.clients.set(clinicId, new Set());
    }
    this.clients.get(clinicId)!.add(res);

    // Cleanup on disconnect
    res.on('close', () => {
      this.clients.get(clinicId)?.delete(res);
      if (this.clients.get(clinicId)?.size === 0) {
        this.clients.delete(clinicId);
      }
    });

    return () => {
      this.clients.get(clinicId)?.delete(res);
    };
  }

  /** Send event to all clients of a clinic. */
  broadcast(clinicId: string, event: NotificationEvent): void {
    const clients = this.clients.get(clinicId);
    if (!clients || clients.size === 0) return;

    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  }

  /** Send event to all connected clients. */
  broadcastAll(event: NotificationEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const [, clients] of this.clients) {
      for (const client of clients) {
        client.write(payload);
      }
    }
  }

  /** Get connected client count for a clinic. */
  getClientCount(clinicId: string): number {
    return this.clients.get(clinicId)?.size || 0;
  }

  /** Get total connected clients. */
  getTotalClients(): number {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.size;
    }
    return total;
  }
}

export const sseManager = new SSEManager();

// ─── Routes ───

const router = Router();

/**
 * GET /api/ai/notifications/stream
 * SSE endpoint for real-time AI notifications.
 * Query params: clinicId (required)
 */
router.get('/stream', (req: Request, res: Response) => {
  const clinicId = req.query.clinicId as string;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'clinicId required' });
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection event
  const connectEvent: NotificationEvent = {
    id: `connect-${Date.now()}`,
    type: 'agent_status',
    data: { status: 'connected', message: 'SSE connection established' },
    timestamp: new Date().toISOString(),
    clinicId,
  };
  res.write(`data: ${JSON.stringify(connectEvent)}\n\n`);

  // Register client
  const unsubscribe = sseManager.addClient(clinicId, res);

  // Send keepalive every 30s
  const keepalive = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, 30_000);

  // Cleanup
  res.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

/**
 * GET /api/ai/notifications/stats
 * Get SSE connection stats.
 */
router.get('/stats', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      totalClients: sseManager.getTotalClients(),
    },
  });
});

export default router;

// ─── Helper: emit notification from EventOrchestrator ───

export function emitAINotification(
  clinicId: string,
  event: NotificationEvent
): void {
  sseManager.broadcast(clinicId, event);
}

export function emitTimelineUpdate(
  clinicId: string,
  data: Record<string, unknown>
): void {
  sseManager.broadcast(clinicId, {
    id: `timeline-${Date.now()}`,
    type: 'timeline_update',
    data,
    timestamp: new Date().toISOString(),
    clinicId,
  });
}

export function emitProactiveAlert(
  clinicId: string,
  data: Record<string, unknown>
): void {
  sseManager.broadcast(clinicId, {
    id: `alert-${Date.now()}`,
    type: 'alert',
    data,
    timestamp: new Date().toISOString(),
    clinicId,
  });
}
