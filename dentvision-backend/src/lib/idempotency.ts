import prisma from './prisma.js';

/**
 * Prisma-backed idempotency, generalised out of `payments.routes.ts`.
 *
 * A key is reserved first — the unique constraint on `IdempotencyRecord.key`
 * serializes concurrent identical requests — and only linked to whatever it
 * produced once that row exists. `resultId` is deliberately generic (the
 * column underneath is still `paymentId`, kept as-is rather than migrating a
 * live financial table): payments store a payment id there, other callers
 * (patient creation) store whatever id their own create produced.
 */
export type IdempotencyReserve =
  | { status: 'reserved' }
  | { status: 'exists'; resultId: string }
  | { status: 'in_flight' };

const DEFAULT_TTL_MS = 3_600_000;

/**
 * `ttlMs` controls how long an *unsent* `Idempotency-Key` header's
 * server-derived fallback (a hash of user+body) keeps deduping identical
 * requests. Payments and patient records default to the full hour: a
 * genuine duplicate payment for the same invoice, or the same patient
 * re-submitted with identical details, is something that should almost
 * never happen on purpose. A shop order is different — reordering the exact
 * same single item shortly after is completely ordinary — so callers where
 * that matters (see `shop.routes.ts`) pass a much shorter window: enough to
 * absorb a double-click or a retried request, not long enough to silently
 * swallow a deliberate repeat purchase.
 */
export async function reserveIdempotencyKey(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<IdempotencyReserve> {
  try {
    await prisma.idempotencyRecord.create({
      data: { key, expiresAt: new Date(Date.now() + ttlMs) },
    });
    return { status: 'reserved' };
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err;
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key },
      select: { paymentId: true, expiresAt: true },
    });
    if (record && record.expiresAt <= new Date()) {
      // Expired — treat as absent. Delete-then-create rather than update, so
      // a genuine concurrent racer still gets `in_flight` off the unique
      // constraint instead of both sides sailing through as `reserved`.
      await prisma.idempotencyRecord.deleteMany({ where: { key, expiresAt: { lte: new Date() } } });
      try {
        await prisma.idempotencyRecord.create({ data: { key, expiresAt: new Date(Date.now() + ttlMs) } });
        return { status: 'reserved' };
      } catch (err2: any) {
        if (err2?.code !== 'P2002') throw err2;
        return { status: 'in_flight' };
      }
    }
    if (record?.paymentId) return { status: 'exists', resultId: record.paymentId };
    return { status: 'in_flight' };
  }
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
