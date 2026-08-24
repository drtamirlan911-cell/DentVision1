/**
 * Leader election for polling jobs (`src/jobs/*.ts`).
 *
 * Every job in `src/jobs/` runs on a plain `setInterval` started once per
 * server process (`src/index.ts`). That's correct for a single instance —
 * today's deployment — but the moment a second instance runs (horizontal
 * scaling), each one runs every job on its own clock: reminders sent twice,
 * approvals expired twice, the recall agent proposing the same follow-up
 * twice. Nothing here changes for a single instance; this only starts
 * mattering, and only then, once a second instance exists.
 *
 * `pg_try_advisory_xact_lock` — not the session-level variant — because the
 * lock must be tied to one transaction, not one pooled connection: a
 * session-level lock would outlive the connection it was taken on the
 * moment that connection returns to Prisma's pool, handing the "lock" to
 * whichever caller happens to reuse that connection next.
 */

import prisma from './prisma.js';

/**
 * Deterministic 32-bit hash of the job's name into the bigint key
 * `pg_try_advisory_xact_lock` takes. Collisions between two job names would
 * only ever make two *different* jobs mutually exclude each other — never a
 * false "I hold the lock" — so a cheap hash over the handful of job names
 * this file will ever see is enough; no need for a real hash function.
 */
function lockKey(name: string): bigint {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0;
  }
  return BigInt(hash);
}

/**
 * Runs `fn` only if this process wins the named lock for the duration of
 * the call — every other instance's concurrent attempt gets `locked: false`
 * back immediately (non-blocking) and skips its own run for this tick.
 * Returns `undefined` when this instance lost the race, so callers can
 * still log/branch on "did I actually run" if they want to.
 */
export async function withJobLock<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const key = lockKey(name);
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${key}) AS locked`;
      if (!rows[0]?.locked) return undefined;
      return fn();
    },
    // Generous: the lock — and the transaction holding it — must outlive
    // whatever the job body itself does, which runs on its own connection
    // via the top-level `prisma` client, not `tx`.
    { timeout: 60_000, maxWait: 5_000 },
  );
}
