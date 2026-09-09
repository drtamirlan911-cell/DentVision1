import prisma from './prisma.js';

export type IdempotencyReserve =
  | { status: 'reserved' }
  | { status: 'exists'; resultId: string }
  | { status: 'in_flight' };

const DEFAULT_TTL_MS = 3_600_000;

/**
 * Reserve a key without turning an expected concurrent duplicate into a
 * Prisma P2002 error. A short PostgreSQL transaction-scoped advisory lock
 * serializes only callers for the same key; the unique index remains the
 * final integrity guarantee. Expired reservations are reusable.
 */
export async function reserveIdempotencyKey(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<IdempotencyReserve> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const now = new Date();
    const record = await tx.idempotencyRecord.findUnique({ where: { key }, select: { paymentId: true, expiresAt: true } });

    if (record && record.expiresAt <= now) {
      await tx.idempotencyRecord.deleteMany({ where: { key, expiresAt: { lte: now } } });
    } else if (record?.paymentId) {
      return { status: 'exists', resultId: record.paymentId };
    } else if (record) {
      return { status: 'in_flight' };
    }

    await tx.idempotencyRecord.create({ data: { key, expiresAt: new Date(Date.now() + ttlMs) } });
    return { status: 'reserved' };
  });
}

export async function completeIdempotencyKey(key: string, resultId: string, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
  await prisma.idempotencyRecord.upsert({
    where: { key },
    create: { key, paymentId: resultId, expiresAt: new Date(Date.now() + ttlMs) },
    update: { paymentId: resultId, expiresAt: new Date(Date.now() + ttlMs) },
  });
}

export async function deleteIdempotencyKey(key: string): Promise<void> {
  await prisma.idempotencyRecord.deleteMany({ where: { key } }).catch(() => {});
}
