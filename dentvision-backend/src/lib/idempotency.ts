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

export async function reserveIdempotencyKey(key: string): Promise<IdempotencyReserve> {
  try {
    await prisma.idempotencyRecord.create({
      data: { key, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    return { status: 'reserved' };
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err;
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key },
      select: { paymentId: true },
    });
    if (record?.paymentId) return { status: 'exists', resultId: record.paymentId };
    return { status: 'in_flight' };
  }
}

export async function completeIdempotencyKey(key: string, resultId: string): Promise<void> {
  await prisma.idempotencyRecord.upsert({
    where: { key },
    create: { key, paymentId: resultId, expiresAt: new Date(Date.now() + 3_600_000) },
    update: { paymentId: resultId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
}

export async function deleteIdempotencyKey(key: string): Promise<void> {
  await prisma.idempotencyRecord.deleteMany({ where: { key } }).catch(() => {});
}
