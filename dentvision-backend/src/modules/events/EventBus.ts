import { randomUUID } from 'crypto';
import {
  EventType,
  CRMEvent,
  EventSubscriber,
  IEventBus,
  EventContext,
  EventStats,
} from './EventTypes.js';
import { eventStore } from './EventStore.js';

const COUNT = 10;
const POLL_INTERVAL_MS = 250;
const RECOVERY_INTERVAL_MS = 30_000;

export class EventBus implements IEventBus {
  private subscribers = new Map<EventType | '*', EventSubscriber[]>();
  private connected = false;
  private stats = { published: 0, processed: 0, failed: 0 };
  private databasePollTimer: ReturnType<typeof setInterval> | null = null;
  private databasePollRunning = false;
  private lastLeaseRecoveryAt = 0;

  async connect(): Promise<void> {
    this.connected = true;
    console.log('[EventBus] Using PostgreSQL durable event queue');
    this.startDatabasePolling();
  }

  async disconnect(): Promise<void> {
    if (this.databasePollTimer) {
      clearInterval(this.databasePollTimer);
      this.databasePollTimer = null;
    }
    this.connected = false;
    console.log('[EventBus] Disconnected');
  }

  async publish(
    type: EventType,
    payload: Record<string, unknown>,
    context: EventContext
  ): Promise<string> {
    const event: CRMEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date(),
      source: context.source,
      clinicId: context.clinicId,
      userId: context.userId,
      payload,
      metadata: {
        ip: context.ip,
        userAgent: context.userAgent,
      },
    };

    await eventStore.save(event);
    this.stats.published++;
    return event.id;
  }

  subscribe(type: EventType | '*', handler: EventSubscriber): () => void {
    const handlers = this.subscribers.get(type) ?? [];
    handlers.push(handler);
    this.subscribers.set(type, handlers);
    console.log(`[EventBus] Subscriber added for: ${type}`);

    return () => {
      const current = this.subscribers.get(type);
      if (!current) return;
      const index = current.indexOf(handler);
      if (index >= 0) current.splice(index, 1);
      if (current.length === 0) this.subscribers.delete(type);
    };
  }

  getStats(): EventStats {
    return {
      connected: this.connected,
      mode: 'postgres',
      published: this.stats.published,
      processed: this.stats.processed,
      failed: this.stats.failed,
      subscribers: Array.from(this.subscribers.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      ),
    };
  }

  private startDatabasePolling(): void {
    if (this.databasePollTimer) return;

    this.databasePollTimer = setInterval(() => {
      void this.pollDatabaseEvents();
    }, POLL_INTERVAL_MS);

    void this.pollDatabaseEvents();
  }

  private async pollDatabaseEvents(): Promise<void> {
    if (this.databasePollRunning) return;
    this.databasePollRunning = true;

    try {
      const now = Date.now();
      if (now - this.lastLeaseRecoveryAt >= RECOVERY_INTERVAL_MS) {
        await eventStore.recoverStaleProcessing();
        this.lastLeaseRecoveryAt = now;
      }

      const events = await eventStore.claimPending(COUNT);
      for (const event of events) {
        const ok = await this.callSubscribers(event);
        if (ok) {
          await eventStore.markCompleted(event.id);
        }
      }
    } catch (error) {
      console.error('[EventBus] PostgreSQL poll error:', error);
    } finally {
      this.databasePollRunning = false;
    }
  }

  private async callSubscribers(event: CRMEvent): Promise<boolean> {
    let ok = true;

    for (const handler of this.subscribers.get(event.type) ?? []) {
      if (!(await this.callHandler(handler, event))) ok = false;
    }

    for (const handler of this.subscribers.get('*') ?? []) {
      if (!(await this.callHandler(handler, event))) ok = false;
    }

    return ok;
  }

  private async callHandler(
    handler: EventSubscriber,
    event: CRMEvent
  ): Promise<boolean> {
    try {
      await handler(event);
      this.stats.processed++;
      return true;
    } catch (err) {
      this.stats.failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[EventBus] Handler error for ${event.type}:`, message);
      await eventStore.markFailed(event.id, message);
      return false;
    }
  }
}

export const eventBus = new EventBus();
