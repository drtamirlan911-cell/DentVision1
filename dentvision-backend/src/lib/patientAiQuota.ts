/**
 * Daily cap on assistant turns per patient — in memory, per process.
 *
 * The same shape as `guestAiQuota.ts`, and for the same reason: this product
 * runs on a free tier with no Redis, and the provider bill has already been
 * hit once in this project's history. Patients outnumber staff by orders of
 * magnitude, so an uncapped patient-facing assistant is the one surface where
 * a bad day costs real money.
 *
 * The honest limits of doing it this way: the count resets on deploy, and a
 * second instance would keep its own tally. Both are acceptable for a cap
 * meant to stop runaway spend rather than to meter entitlement — and both
 * fail open, which for a patient asking about their own treatment is the
 * right direction to fail.
 */

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

export function patientAiRemaining(userId: string): number {
  return Math.max(0, PATIENT_AI_DAILY_LIMIT - getBucket(userId).count);
}

/** Consume one turn. Returns what is left, or -1 when the cap is already spent. */
export function consumePatientAi(userId: string): number {
  const b = getBucket(userId);
  if (b.count >= PATIENT_AI_DAILY_LIMIT) return -1;
  b.count += 1;
  buckets.set(userId, b);
  return Math.max(0, PATIENT_AI_DAILY_LIMIT - b.count);
}

/** Testing seam — the bucket map is module state that would leak between cases. */
export function __resetPatientAiQuota(): void {
  buckets.clear();
}
