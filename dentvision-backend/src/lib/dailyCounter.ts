/**
 * A daily counter shared by every instance.
 *
 * Three spend guards — the model token budget and the guest/patient assistant
 * quotas — used to live in `Map`s inside one process. Both quota files said so
 * in their own comments: the tally resets on deploy, and a second instance
 * keeps its own. On two instances a clinic therefore spent twice the daily
 * budget it was told it had, and a restart cleared the guard entirely.
 *
 * Redis makes the count one number. When Redis is absent every function here
 * returns `null`, and the caller keeps its existing in-memory path — so a
 * deployment without Redis behaves exactly as it does today.
 */

import { getRedis } from './redis.js'

/** Two days: covers the UTC day plus clock skew, and expires itself. */
const TTL_SECONDS = 48 * 60 * 60

/** The day component of every key, so midnight is a new key, not a cron job. */
export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10)
}

/**
 * Add to today's counter and return the new total.
 *
 * `null` means "no shared counter available" — no Redis configured, or the
 * call failed. Callers fall back to their own memory rather than failing the
 * request: for a patient asking about their own treatment, failing open is the
 * right direction, and that was already this code's documented decision.
 */
export async function incrementDaily(key: string, by = 1): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const total = await redis.incrby(key, by)
    // Only on creation. Re-arming the TTL on every write would slide the
    // expiry forward forever and keep yesterday's key alive.
    if (total === by) await redis.expire(key, TTL_SECONDS)
    return total
  } catch {
    return null
  }
}

/** Today's total, or `null` when there is no shared counter to read. */
export async function readDaily(key: string): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    if (raw === null || raw === undefined) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return null
  }
}

/** Drop a counter. Used by tests and by an operator clearing a stuck quota. */
export async function clearDaily(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(key)
  } catch {
    /* nothing to do: the key expires on its own */
  }
}

export const counterKeys = {
  modelBudget: (tier: string, day = utcDay()) => `dv:ai:budget:${day}:${tier}`,
  guestQuota: (userId: string, day = utcDay()) => `dv:ai:quota:guest:${day}:${userId}`,
  patientQuota: (userId: string, day = utcDay()) => `dv:ai:quota:patient:${day}:${userId}`,
}
