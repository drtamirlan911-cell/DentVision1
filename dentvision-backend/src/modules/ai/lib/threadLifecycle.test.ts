import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  deleteAiThreadAndCreateNext,
  lockExistingAiSessionForSync,
  resolveScopedAiSessionId,
  updateExistingAiSessionSnapshot,
} from './threadLifecycle.js';

const USER_ID = 'user-1';
const SCOPE = 'org:org-1';
const NEXT_ID = 'new-session-123';

describe('AI thread lifecycle workspace boundaries', () => {
  const findFirst = vi.fn();
  const create = vi.fn();
  const deleteMany = vi.fn();
  const updateMany = vi.fn();
  const tx = {
    aISession: { deleteMany, create, updateMany },
    aIMessage: {},
  } as unknown as Prisma.TransactionClient;
  const db = {
    aISession: { findFirst, create, deleteMany },
    $transaction: vi.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx)),
  } as unknown as PrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: NEXT_ID });
    deleteMany.mockResolvedValue({ count: 0 });
    updateMany.mockResolvedValue({ count: 0 });
  });

  it('reuses only the requested thread owned by this user in this workspace', async () => {
    findFirst.mockResolvedValueOnce({ id: 'owned-session-123' });

    await expect(resolveScopedAiSessionId(db, {
      userId: USER_ID, clinicId: SCOPE, requested: 'owned-session-123', createId: NEXT_ID,
    })).resolves.toBe('owned-session-123');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'owned-session-123', userId: USER_ID, clinicId: SCOPE },
      select: { id: true },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new thread for a stale or foreign requested id instead of falling back to another thread', async () => {
    await expect(resolveScopedAiSessionId(db, {
      userId: USER_ID, clinicId: SCOPE, requested: 'foreign-session-123', createId: NEXT_ID,
    })).resolves.toBe(NEXT_ID);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-session-123', userId: USER_ID, clinicId: SCOPE },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: { id: NEXT_ID, userId: USER_ID, clinicId: SCOPE, messages: [], context: {} },
    });
  });

  it('uses the latest owned thread only when the caller supplies no session id', async () => {
    findFirst.mockResolvedValueOnce({ id: 'latest-owned-123' });

    await expect(resolveScopedAiSessionId(db, {
      userId: USER_ID, clinicId: SCOPE, createId: NEXT_ID,
    })).resolves.toBe('latest-owned-123');

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, clinicId: SCOPE },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('locks only the matching owner and active workspace before snapshot reads', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(lockExistingAiSessionForSync(tx, {
      sessionId: 'session-123', userId: USER_ID, clinicId: SCOPE,
    })).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'session-123', userId: USER_ID, clinicId: SCOPE },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('does not sync a transcript when the scoped session no longer exists', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(lockExistingAiSessionForSync(tx, {
      sessionId: 'deleted-session-123', userId: USER_ID, clinicId: SCOPE,
    })).resolves.toBe(false);
  });

  it('updates the mirror only for the matching owner and active workspace', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(updateExistingAiSessionSnapshot(tx, {
      sessionId: 'session-123', userId: USER_ID, clinicId: SCOPE, messages: [] as Prisma.InputJsonValue,
    })).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'session-123', userId: USER_ID, clinicId: SCOPE },
      data: { messages: [] },
    });
  });

  it('does not update transcript children when the session was already deleted', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(updateExistingAiSessionSnapshot(tx, {
      sessionId: 'deleted-session-123', userId: USER_ID, clinicId: SCOPE, messages: [] as Prisma.InputJsonValue,
    })).resolves.toBe(false);
  });

  it('does not create a replacement when the requested thread is missing or foreign', async () => {
    deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(deleteAiThreadAndCreateNext(db, {
      threadId: 'foreign-session-123', userId: USER_ID, clinicId: SCOPE, nextSessionId: NEXT_ID,
    })).resolves.toBeNull();

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'foreign-session-123', userId: USER_ID, clinicId: SCOPE },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('deletes the owned thread and creates its replacement in one transaction', async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 });

    await expect(deleteAiThreadAndCreateNext(db, {
      threadId: 'owned-session-123', userId: USER_ID, clinicId: SCOPE, nextSessionId: NEXT_ID,
    })).resolves.toBe(NEXT_ID);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { id: NEXT_ID, userId: USER_ID, clinicId: SCOPE, messages: [], context: {} },
    });
  });
});
