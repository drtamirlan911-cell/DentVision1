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
          status: 'PENDING',
        },
      });
    } catch (err) {
      console.error('[EventStore] Failed to save event:', err);
    }
  }

  async markProcessing(eventId: string): Promise<void> {
    try {
      await prisma.aIEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSING' },
      });
    } catch (err) {
      console.error('[EventStore] Failed to mark processing:', err);
    }
  }

  async markCompleted(eventId: string, result?: Record<string, unknown>): Promise<void> {
    try {
      await prisma.aIEvent.update({
        where: { id: eventId },
        data: {
          status: 'COMPLETED',
          result: result ? (result as unknown as Prisma.InputJsonValue) : undefined,
          processedAt: new Date(),
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
          status: event && event.retries >= event.maxRetries ? 'FAILED' : 'PENDING',
          error,
          retries: { increment: 1 },
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
      prisma.aIEvent.count({ where: { ...where, status: 'PENDING' } }),
      prisma.aIEvent.count({ where: { ...where, status: 'PROCESSING' } }),
      prisma.aIEvent.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.aIEvent.count({ where: { ...where, status: 'FAILED' } }),
    ]);

    return { total, pending, processing, completed, failed };
  }

  async retryEvent(eventId: string): Promise<boolean> {
    const event = await prisma.aIEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'FAILED') return false;

    await prisma.aIEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING', retries: 0, error: null },
    });

    return true;
  }
}

export const eventStore = new EventStore();
