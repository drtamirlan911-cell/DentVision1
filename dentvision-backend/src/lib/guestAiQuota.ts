/**
 * Daily cap on guest AI requests.
 *
 * Counted in Redis when it is available, so the cap is one number across every
 * instance and survives a deploy. Without Redis this falls back to the
 * per-process map it has always used — same behaviour as before, including its
 * honest limitations: the tally resets on restart and a second instance keeps
 * its own.
 */

import { counterKeys, incrementDaily, readDaily } from './dailyCounter.js';

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

export async function guestAiRemaining(userId: string): Promise<number> {
  const shared = await readDaily(counterKeys.guestQuota(userId));
  if (shared !== null) return Math.max(0, GUEST_AI_LIMIT - shared);
  return Math.max(0, GUEST_AI_LIMIT - getBucket(userId).count);
}

export async function guestAiAllowed(userId: string): Promise<boolean> {
  return (await guestAiRemaining(userId)) > 0;
}

/**
 * Consume one guest AI request. Returns what is left, or -1 when blocked.
 *
 * Increment first, then compare: `INCRBY` is atomic, so two instances cannot
 * both read "1 left" and both let a request through. Checking before
 * incrementing gives no such guarantee.
 */
export async function consumeGuestAi(userId: string): Promise<number> {
  const total = await incrementDaily(counterKeys.guestQuota(userId));
  if (total !== null) {
    if (total > GUEST_AI_LIMIT) return -1;
    return Math.max(0, GUEST_AI_LIMIT - total);
  }
  const b = getBucket(userId);
  if (b.count >= GUEST_AI_LIMIT) return -1;
  b.count += 1;
  buckets.set(userId, b);
  return Math.max(0, GUEST_AI_LIMIT - b.count);
}

/** Testing seam — the bucket map is module state that would leak between cases. */
export function __resetGuestAiQuota(): void {
  buckets.clear();
}

export function isGuestEmail(email?: string | null): boolean {
  return String(email || '').toLowerCase().endsWith('@guest.local');
}
