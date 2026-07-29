/**
 * Server-side guest AI quota (in-memory, per process).
 * Free-tier safe: no Redis required; resets daily and on deploy restart.
 */

export const GUEST_AI_LIMIT = 20;

type Bucket = { day: string; count: number };

const buckets = new Map<string, Bucket>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getBucket(userId: string): Bucket {
  const day = todayKey();
  const cur = buckets.get(userId);
  if (!cur || cur.day !== day) {
    const next = { day, count: 0 };
    buckets.set(userId, next);
    return next;
  }
  return cur;
}

export function guestAiRemaining(userId: string): number {
  const b = getBucket(userId);
  return Math.max(0, GUEST_AI_LIMIT - b.count);
}

export function guestAiAllowed(userId: string): boolean {
  return guestAiRemaining(userId) > 0;
}

/** Consume one guest AI request. Returns remaining after consume, or -1 if blocked. */
export function consumeGuestAi(userId: string): number {
  const b = getBucket(userId);
  if (b.count >= GUEST_AI_LIMIT) return -1;
  b.count += 1;
  buckets.set(userId, b);
  return Math.max(0, GUEST_AI_LIMIT - b.count);
}

export function isGuestEmail(email?: string | null): boolean {
  return String(email || '').toLowerCase().endsWith('@guest.local');
}
