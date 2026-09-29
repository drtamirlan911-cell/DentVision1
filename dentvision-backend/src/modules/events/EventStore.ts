import { PrismaClient, Prisma } from '@prisma/client';
import { CRMEvent } from './EventTypes.js';

const prisma = new PrismaClient();

export class EventStore {
  async save(event: CRMEvent): Promise<void> {
    try {
      await prisma.aIEvent.create({
        data: {
          id: event.id,
          type: event.type,
          source: event.source,
          clinicId: event.clinicId,
          userId: event.userId,
          payload: event.payload as unknown as Prisma.InputJsonValue,
          status: 'pending',
        },
      });
    } catch (err) {
      console.error('[EventStore] Failed to save event:', err);
      throw err;
    }
  }

  async markProcessing(eventId: string): Promise<void> {
    try {
      await prisma.aIEvent.update({
        where: { id: eventId },
        data: { status: 'processing', processingAt: new Date() },
      });
    } catch (err) {
      console.error('[EventStore] Failed to mark processing:', err);
    }
  }

  /**
   * Claim pending events durably in PostgreSQL. Multiple API instances can
   * poll concurrently because SKIP LOCKED makes each row owned by one
   * transaction at a time.
   */
  async claimPending(limit = 10): Promise<CRMEvent[]> {
    try {
      return await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{
          id: string;
          type: string;
          source: string;
          clinicId: string;
          userId: string;
          payload: Prisma.JsonValue;
          createdAt: Date;
        }>>`
          SELECT "id", "type", "source", "clinicId", "userId", "payload", "createdAt"
          FROM "ai_events"
          WHERE "status" = 'pending' AND "retries" < "maxRetries"
          ORDER BY "createdAt" ASC
          LIMIT ${Math.max(1, Math.min(limit, 50))}
          FOR UPDATE SKIP LOCKED
        `;

        if (!rows.length) return [];

        await tx.aIEvent.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { status: 'processing', processingAt: new Date() },
        });

        return rows.map((row) => ({
          id: row.id,
          type: row.type as CRMEvent['type'],
          timestamp: row.createdAt,
          source: row.source,
          clinicId: row.clinicId,
          userId: row.userId,
          payload: (row.payload ?? {}) as Record<string, unknown>,
        }));
      });
    } catch (err) {
      console.error('[EventStore] Failed to claim pending events:', err);
      return [];
    }
  }

  /**
   * Recover leases left behind by a crashed worker. The lease is deliberately
   * short; handlers are expected to be idempotent and event completion remains
   * the source of truth.
   */
  async recoverStaleProcessing(leaseMs = 5 * 60 * 1000): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - leaseMs);
      const result = await prisma.aIEvent.updateMany({
        where: {
          status: 'processing',
          processingAt: { lt: cutoff },
        },
        data: { status: 'pending', processingAt: null },
      });
      return result.count;
    } catch (err) {
      console.error('[EventStore] Failed to recover stale events:', err);
      return 0;
    }
  }

  async markCompleted(eventId: string, result?: Record<string, unknown>): Promise<void> {
    try {
      await prisma.aIEvent.update({
        where: { id: eventId },
        data: {
          status: 'completed',
          result: result ? (result as unknown as Prisma.InputJsonValue) : undefined,
          processedAt: new Date(),
          processingAt: null,
        },
      });
    } catch (err) {
      console.error('[EventStore] Failed to mark completed:', err);
    }
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    try {
      const event = await prisma.aIEvent.findUnique({ where: { id: eventId } });

      await prisma.aIEvent.update({
        where: { id: eventId },
        data: {
          status: event && event.retries + 1 >= event.maxRetries ? 'failed' : 'pending',
          error,
          retries: { increment: 1 },
          processingAt: null,
        },
      });
    } catch (err) {
      console.error('[EventStore] Failed to mark failed:', err);
    }
  }

  async getEvents(params: {
    clinicId?: string;
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { clinicId, type, status, page = 1, limit = 50 } = params;

    const where: Prisma.AIEventWhereInput = {};
    if (clinicId) where.clinicId = clinicId;
    if (type) where.type = type;
    if (status) where.status = status as any;

    const [events, total] = await Promise.all([
      prisma.aIEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aIEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEventById(id: string) {
    return prisma.aIEvent.findUnique({ where: { id } });
  }

  async getStats(clinicId?: string) {
    const where: Prisma.AIEventWhereInput = clinicId ? { clinicId } : {};

    const [total, pending, processing, completed, failed] = await Promise.all([
      prisma.aIEvent.count({ where }),
      prisma.aIEvent.count({ where: { ...where, status: 'pending' } }),
      prisma.aIEvent.count({ where: { ...where, status: 'processing' } }),
      prisma.aIEvent.count({ where: { ...where, status: 'completed' } }),
      prisma.aIEvent.count({ where: { ...where, status: 'failed' } }),
    ]);

    return { total, pending, processing, completed, failed };
  }

  async retryEvent(eventId: string): Promise<boolean> {
    const event = await prisma.aIEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'failed') return false;

    await prisma.aIEvent.update({
      where: { id: eventId },
      data: { status: 'pending', retries: 0, error: null },
    });

    return true;
  }
}

export const eventStore = new EventStore();
