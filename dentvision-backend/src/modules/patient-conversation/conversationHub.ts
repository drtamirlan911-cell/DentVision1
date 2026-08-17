/**
 * Two small SSE fan-outs, same shape as `ai.notifications.routes.ts`'s
 * `SSEManager` but kept local rather than shared: the patient side is keyed
 * by conversation id (one patient's thread) and the staff side by clinic id
 * (every OWNER/ADMIN watching their inbox) — different keyspaces that must
 * never cross, so reusing the AI notifications hub's clinic-keyed broadcast
 * for the patient side would risk one patient's SSE connection receiving
 * another patient's conversation events.
 *
 * In-memory, per process — the same limit the rest of this product's realtime
 * accepts on this tier. A second instance keeps its own connections; a client
 * that misses a broadcast still sees the message on its next poll/reconnect,
 * since the source of truth is the database, not the stream.
 */

import type { Response } from 'express';

class SSEHub {
  private clients = new Map<string, Set<Response>>();

  add(key: string, res: Response): () => void {
    if (!this.clients.has(key)) this.clients.set(key, new Set());
    this.clients.get(key)!.add(res);

    res.on('close', () => {
      this.clients.get(key)?.delete(res);
      if (this.clients.get(key)?.size === 0) this.clients.delete(key);
    });

    return () => {
      this.clients.get(key)?.delete(res);
    };
  }

  broadcast(key: string, event: unknown): void {
    const clients = this.clients.get(key);
    if (!clients || clients.size === 0) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(payload);
  }

  clientCount(key: string): number {
    return this.clients.get(key)?.size || 0;
  }
}

/** Keyed by `PatientConversation.id` — the patient's own thread. */
export const patientConversationHub = new SSEHub();

/** Keyed by `clinicId` — every open/updated thread at that clinic. */
export const clinicInboxHub = new SSEHub();
