import type { Prisma, PrismaClient } from '@prisma/client';

type SessionDatabase = Pick<PrismaClient, 'aISession' | '$transaction'>;

export async function resolveScopedAiSessionId(
  db: SessionDatabase,
  input: { userId: string; clinicId: string; requested?: string; createId: string },
): Promise<string> {
  if (input.requested) {
    const owned = await db.aISession.findFirst({
      where: { id: input.requested, userId: input.userId, clinicId: input.clinicId },
      select: { id: true },
    });
    if (owned) return owned.id;
  } else {
    const existing = await db.aISession.findFirst({
      where: { userId: input.userId, clinicId: input.clinicId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  await db.aISession.create({
    data: {
      id: input.createId,
      userId: input.userId,
      clinicId: input.clinicId,
      messages: [],
      context: {},
    },
  });
  return input.createId;
}

/**
 * Update the parent row before touching transcript children. The UPDATE locks
 * the session row so a concurrent DELETE either wins first (count=0) or waits
 * until this transaction commits and then cascades the child messages.
 */
export async function updateExistingAiSessionSnapshot(
  tx: Prisma.TransactionClient,
  input: { sessionId: string; userId: string; clinicId: string; messages: Prisma.InputJsonValue },
): Promise<boolean> {
  const updated = await tx.aISession.updateMany({
    where: { id: input.sessionId, userId: input.userId, clinicId: input.clinicId },
    data: { messages: input.messages },
  });
  return updated.count === 1;
}

/** Delete only the caller's thread in the active workspace and open a fresh one atomically. */
export async function deleteAiThreadAndCreateNext(
  db: PrismaClient,
  input: { threadId: string; userId: string; clinicId: string; nextSessionId: string },
): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const deleted = await tx.aISession.deleteMany({
      where: { id: input.threadId, userId: input.userId, clinicId: input.clinicId },
    });
    if (deleted.count !== 1) return null;

    await tx.aISession.create({
      data: {
        id: input.nextSessionId,
        userId: input.userId,
        clinicId: input.clinicId,
        messages: [],
        context: {},
      },
    });
    return input.nextSessionId;
  });
}
