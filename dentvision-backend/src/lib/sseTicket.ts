/**
 * Short-lived, one-time-use tickets for authenticating `EventSource`
 * connections. `EventSource` cannot set an `Authorization` header, so SSE
 * endpoints have always had to carry *something* in the query string — this
 * codebase's SSE routes did that with the caller's real access token, which
 * is exactly the token used to authenticate every other API call. That token
 * sitting in a URL means it can end up in proxy logs, browser history, and
 * referrer headers, for as long as the token itself remains valid (the same
 * TTL as normal API auth).
 *
 * A ticket is scoped to a single stream kind, expires in `TICKET_TTL_SECONDS`,
 * and can only be redeemed once — even a ticket that leaks into a log is
 * worthless within a minute and can't be replayed to open a second
 * connection. Redemption tracking is in-memory (`usedTickets`), the same
 * known single-instance limit already documented for the SSE hubs
 * themselves (`conversationHub.ts`) — acceptable on the current single-Render-
 * instance deployment, not safe to assume once there are multiple.
 */
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config.js';

const TICKET_TTL_SECONDS = 45;

interface TicketPayload {
  sub: string;
  scope: string;
  jti: string;
}

/** jti -> when it's safe to forget (a little past the ticket's own JWT expiry). */
const usedTickets = new Map<string, number>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [jti, forgetAt] of usedTickets) {
    if (forgetAt <= now) usedTickets.delete(jti);
  }
}

/** Mint a ticket for `userId`, redeemable only against streams of `scope`. */
export function issueSseTicket(userId: string, scope: string): string {
  const jti = randomUUID();
  return jwt.sign({ sub: userId, scope, jti } satisfies TicketPayload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TICKET_TTL_SECONDS,
  });
}

/**
 * Verify and redeem a ticket. Returns the userId on success. A ticket that's
 * expired, malformed, scoped to a different stream, or already redeemed
 * returns `null` — callers should treat all of those identically (401), not
 * distinguish "already used" from "invalid" (no reason to help an attacker
 * tell replay attempts apart from garbage).
 */
export function consumeSseTicket(ticket: string, scope: string): string | null {
  sweepExpired();
  let payload: TicketPayload;
  try {
    payload = jwt.verify(ticket, env.JWT_SECRET, { algorithms: ['HS256'] }) as TicketPayload;
  } catch {
    return null;
  }
  if (!payload.sub || !payload.jti || payload.scope !== scope) return null;
  if (usedTickets.has(payload.jti)) return null;
  usedTickets.set(payload.jti, Date.now() + (TICKET_TTL_SECONDS + 15) * 1000);
  return payload.sub;
}
