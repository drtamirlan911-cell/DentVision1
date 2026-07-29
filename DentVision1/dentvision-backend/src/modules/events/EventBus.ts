import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  EventType,
  CRMEvent,
  EventSubscriber,
  IEventBus,
  EventContext,
  EventStats,
} from './EventTypes.js';
import { eventStore } from './EventStore.js';

const STREAM_KEY = 'dentvision:events';
const CONSUMER_GROUP = 'ai-orchestrator';
const CONSUMER_NAME = `worker-${randomUUID().slice(0, 8)}`;
const BLOCK_MS = 5000;
const COUNT = 10;

export class EventBus implements IEventBus {
  private redis: InstanceType<typeof Redis> | null = null;
  private memoryEmitter = new EventEmitter();
  private subscribers = new Map<EventType | '*', EventSubscriber[]>();
  private connected = false;
  private useRedis = false;
  private stats = { published: 0, processed: 0, failed: 0 };
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy(times: number) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        });

        await this.redis.ping();

        // Create consumer group (ignore if already exists)
        try {
          await this.redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
        } catch (err: any) {
          if (!err.message.includes('BUSYGROUP')) {
            throw err;
          }
        }

        this.useRedis = true;
        this.connected = true;
        console.log('[EventBus] Connected to Redis Streams');

        // Start polling for events
        this.startPolling();
        return;
      } catch (err) {
        console.warn('[EventBus] Redis connection failed, falling back to in-memory:', err);
        this.redis = null;
      }
    }

    // Fallback to in-memory
    this.useRedis = false;
    this.connected = true;
    console.log('[EventBus] Using in-memory mode (no Redis)');
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
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

    // Persist to database
    await eventStore.save(event);

    if (this.useRedis && this.redis) {
      // Publish to Redis Stream
      await this.redis.xadd(
        STREAM_KEY,
        '*',
        'id', event.id,
        'type', event.type,
        'source', event.source,
        'clinicId', event.clinicId,
        'userId', event.userId,
        'payload', JSON.stringify(event.payload),
        'timestamp', event.timestamp.toISOString()
      );
    } else {
      // In-memory: emit directly
      this.memoryEmitter.emit(event.type, event);
      this.memoryEmitter.emit('*', event);
    }

    this.stats.published++;
    console.log(`[EventBus] Published: ${event.type} (${event.id})`);

    return event.id;
  }

  subscribe(type: EventType | '*', handler: EventSubscriber): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
    }
    this.subscribers.get(type)!.push(handler);

    // For in-memory mode, attach to EventEmitter
    if (!this.useRedis) {
      this.memoryEmitter.on(type, async (event: CRMEvent) => {
        await this.callHandler(handler, event);
      });
    }

    console.log(`[EventBus] Subscriber added for: ${type}`);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
      if (!this.useRedis) {
        this.memoryEmitter.removeListener(type, handler as any);
      }
    };
  }

  getStats(): EventStats {
    return {
      connected: this.connected,
      mode: this.useRedis ? 'redis' : 'memory',
      published: this.stats.published,
      processed: this.stats.processed,
      failed: this.stats.failed,
      subscribers: Array.from(this.subscribers.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      ),
    };
  }

  // ─── Private Methods ───

  private startPolling(): void {
    if (!this.redis) return;

    this.pollTimer = setInterval(async () => {
      await this.pollEvents();
    }, 1000);

    // Initial poll
    this.pollEvents().catch(console.error);
  }

  private async pollEvents(): Promise<void> {
    if (!this.redis) return;

    try {
      const results = await this.redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', COUNT.toString(),
        'BLOCK', BLOCK_MS.toString(),
        'STREAMS', STREAM_KEY, '>'
      ) as [string, [string, string[]][]][] | null;

      if (!results || results.length === 0) return;

      for (const [, messages] of results) {
        for (const [messageId, fields] of messages) {
          await this.processRedisMessage(messageId, fields);
        }
      }
    } catch (err) {
      console.error('[EventBus] Poll error:', err);
    }
  }

  private async processRedisMessage(
    messageId: string,
    fields: string[]
  ): Promise<void> {
    const event: CRMEvent = {
      id: '',
      type: '' as EventType,
      timestamp: new Date(),
      source: '',
      clinicId: '',
      userId: '',
      payload: {},
    };

    // Parse fields
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];

      switch (key) {
        case 'id': event.id = value; break;
        case 'type': event.type = value as EventType; break;
        case 'source': event.source = value; break;
        case 'clinicId': event.clinicId = value; break;
        case 'userId': event.userId = value; break;
        case 'payload': event.payload = JSON.parse(value); break;
        case 'timestamp': event.timestamp = new Date(value); break;
      }
    }

    await this.callSubscribers(event);

    // Acknowledge message
    if (this.redis) {
      await this.redis.xack(STREAM_KEY, CONSUMER_GROUP, messageId);
    }
  }

  private async callSubscribers(event: CRMEvent): Promise<void> {
    // Call type-specific subscribers
    const typeHandlers = this.subscribers.get(event.type) || [];
    for (const handler of typeHandlers) {
      await this.callHandler(handler, event);
    }

    // Call wildcard subscribers
    const wildcardHandlers = this.subscribers.get('*') || [];
    for (const handler of wildcardHandlers) {
      await this.callHandler(handler, event);
    }
  }

  private async callHandler(
    handler: EventSubscriber,
    event: CRMEvent
  ): Promise<void> {
    try {
      await handler(event);
      this.stats.processed++;
    } catch (err) {
      this.stats.failed++;
      console.error(`[EventBus] Handler error for ${event.type}:`, err);

      // Update event status in store
      await eventStore.markFailed(event.id, (err as Error).message);
    }
  }
}

// Singleton
export const eventBus = new EventBus();
