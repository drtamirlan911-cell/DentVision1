/**
 * Brute-force login protection — persisted in DB so it survives restarts and
 * works across multi-instance deployments.
 *
 * Soft lock: 5 failures → 15 min. Hard lock: 10 failures → 1 hour.
 */
import prisma from './prisma.js';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SOFT_LOCK_ATTEMPTS = 5;
const HARD_LOCK_ATTEMPTS = 10;

function key(email: string, ip: string): string {
  return `${email.toLowerCase()}:${ip}`;
}

async function getOrCreate(email: string, ip: string) {
  try {
    return await prisma.$queryRawUnsafe<Array<{ id: string; count: number; first_attempt: Date; locked_until: Date | null }>>(
      `INSERT INTO "login_attempts" ("email", "ip", "count", "first_attempt")
       VALUES ($1, $2, 0, now())
       ON CONFLICT ("email", "ip") DO NOTHING`,
      email.toLowerCase(),
      ip,
    );
  } catch {
    // The caller must not bypass brute-force protection when persistence fails.
    return null;
  }
}

export async function checkLoginAttempts(
  email: string,
  ip: string,
): Promise<{ allowed: boolean; remainingAttempts: number; lockoutMinutes: number | null }> {
  try {
    const created = await getOrCreate(email, ip);
    if (created === null) {
      return { allowed: false, remainingAttempts: 0, lockoutMinutes: 1 };
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ count: number; locked_until: Date | null }>>(
      `SELECT "count", "locked_until" FROM "login_attempts" WHERE "email" = $1 AND "ip" = $2`,
      email.toLowerCase(),
      ip,
    );
    if (!rows.length) return { allowed: true, remainingAttempts: SOFT_LOCK_ATTEMPTS, lockoutMinutes: null };

    const row = rows[0];
    if (row.locked_until) {
      const remaining = new Date(row.locked_until).getTime() - Date.now();
      if (remaining > 0) {
        return { allowed: false, remainingAttempts: 0, lockoutMinutes: Math.ceil(remaining / 60000) };
      }
      // Lock expired — reset the row
      await prisma.$queryRawUnsafe(
        `UPDATE "login_attempts" SET "count" = 0, "locked_until" = NULL, "updated_at" = now() WHERE "email" = $1 AND "ip" = $2`,
        email.toLowerCase(),
        ip,
      );
      return { allowed: true, remainingAttempts: SOFT_LOCK_ATTEMPTS, lockoutMinutes: null };
    }

    const remaining = SOFT_LOCK_ATTEMPTS - row.count;
    return { allowed: true, remainingAttempts: Math.max(0, remaining), lockoutMinutes: null };
  } catch {
    // DB availability is a prerequisite for authentication. Never bypass the
    // brute-force gate when its state cannot be read reliably.
    return { allowed: false, remainingAttempts: 0, lockoutMinutes: 1 };
  }
}

export async function recordFailedAttempt(email: string, ip: string): Promise<void> {
  try {
    const created = await getOrCreate(email, ip);
    if (created === null) return;

    const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT "count" FROM "login_attempts" WHERE "email" = $1 AND "ip" = $2`,
      email.toLowerCase(),
      ip,
    );
    if (!rows.length) return;

    const nextCount = rows[0].count + 1;
    let lockedUntil: string | null = null;

    if (nextCount >= HARD_LOCK_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + ONE_HOUR_MS).toISOString();
    } else if (nextCount >= SOFT_LOCK_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + FIFTEEN_MIN_MS).toISOString();
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "login_attempts" SET "count" = $3, "locked_until" = $4::timestamptz, "updated_at" = now()
       WHERE "email" = $1 AND "ip" = $2`,
      email.toLowerCase(),
      ip,
      nextCount,
      lockedUntil,
    );
  } catch { /* persistence failure is handled by the next login check */ }
}

export async function resetAttempts(email: string, ip: string): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(
      `DELETE FROM "login_attempts" WHERE "email" = $1 AND "ip" = $2`,
      email.toLowerCase(),
      ip,
    );
  } catch { /* persistence failure is handled by the next login check */ }
}
