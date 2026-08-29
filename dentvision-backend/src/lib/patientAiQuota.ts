/**
 * Daily cap on assistant turns per patient.
 *
 * The same shape as `guestAiQuota.ts`, and for the same reason: the provider
 * bill has already been hit once in this project's history. Patients outnumber
 * staff by orders of magnitude, so an uncapped patient-facing assistant is the
 * one surface where a bad day costs real money.
 *
 * Counted in Redis when it is available, so the cap is one number across every
 * instance and survives a deploy. Without Redis it falls back to the
 * per-process map described above, with the limits that implies.
 *
 * Either way it fails open: a Redis outage must not stop a patient asking
 * about their own treatment, which is why an unreachable counter degrades to
 * memory instead of refusing.
 */

import { clearDaily, counterKeys, incrementDaily, readDaily } from './dailyCounter.js';

export const PATIENT_AI_DAILY_LIMIT = 40;

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

export async function patientAiRemaining(userId: string): Promise<number> {
  const shared = await readDaily(counterKeys.patientQuota(userId));
  if (shared !== null) return Math.max(0, PATIENT_AI_DAILY_LIMIT - shared);
  return Math.max(0, PATIENT_AI_DAILY_LIMIT - getBucket(userId).count);
}

/**
 * Consume one turn. Returns what is left, or -1 when the cap is already spent.
 *
 * Increment first, then compare — `INCRBY` is atomic, so two instances cannot
 * both see the last turn as free.
 */
export async function consumePatientAi(userId: string): Promise<number> {
  const total = await incrementDaily(counterKeys.patientQuota(userId));
  if (total !== null) {
    if (total > PATIENT_AI_DAILY_LIMIT) return -1;
    return Math.max(0, PATIENT_AI_DAILY_LIMIT - total);
  }
  const b = getBucket(userId);
  if (b.count >= PATIENT_AI_DAILY_LIMIT) return -1;
  b.count += 1;
  buckets.set(userId, b);
  return Math.max(0, PATIENT_AI_DAILY_LIMIT - b.count);
}

/** Testing seam — both the map and the shared key are state that would leak. */
export async function __resetPatientAiQuota(userId?: string): Promise<void> {
  buckets.clear();
  if (userId) await clearDaily(counterKeys.patientQuota(userId));
}
