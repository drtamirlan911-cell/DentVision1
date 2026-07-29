/**
 * EventOrchestrator — bridges CRM Event Bus → AI Agents.
 *
 * Subscribes to all CRM events, matches them against rules,
 * executes actions, and stores results in the AI Event Store.
 */

import { EventEmitter } from 'node:events';
import { eventBus } from '../../events/index.js';
import { CRMEvent, EventType } from '../../events/EventTypes.js';
import { matchEventRules, EventRule, EventRuleAction } from './eventRules.js';
import { getActionHandler, EventActionResult } from './eventActions.js';

// ─── Types ───

export interface ProcessedEvent {
  event: CRMEvent;
  rules: EventRule[];
  results: EventActionResult[];
  durationMs: number;
}

export interface EventOrchestratorConfig {
  enabled: boolean;
  concurrency: number;
  logLevel: 'silent' | 'info' | 'debug';
}

const DEFAULT_CONFIG: EventOrchestratorConfig = {
  enabled: true,
  concurrency: 5,
  logLevel: 'info',
};

// ─── EventOrchestrator ───

export class EventOrchestrator extends EventEmitter {
  private unsubscribe: (() => void) | null = null;
  private config: EventOrchestratorConfig;
  private activeCount = 0;
  private queue: Array<{ event: CRMEvent; resolve: () => void }> = [];

  constructor(config?: Partial<EventOrchestratorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Start listening to events via EventBus. */
  start(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = eventBus.subscribe('*', this.handleEvent.bind(this));

    if (this.config.logLevel !== 'silent') {
      console.log('[EventOrchestrator] Subscribed to EventBus');
    }
  }

  /** Stop listening to events. */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.queue = [];
    if (this.config.logLevel !== 'silent') {
      console.log('[EventOrchestrator] Stopped');
    }
  }

  /** Process a single event manually (e.g., from test). */
  async processEvent(event: CRMEvent): Promise<ProcessedEvent> {
    return this.processEventInternal(event);
  }

  // ─── Internal ───

  private async handleEvent(event: CRMEvent): Promise<void> {
    if (!this.config.enabled) return;

    if (this.activeCount >= this.config.concurrency) {
      return new Promise<void>((resolve) => {
        this.queue.push({ event, resolve });
      });
    }

    this.activeCount++;
    try {
      await this.processEventInternal(event);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.config.concurrency) {
      const item = this.queue.shift()!;
      this.activeCount++;
      this.processEventInternal(item.event).finally(() => {
        this.activeCount--;
        item.resolve();
        this.processQueue();
      });
    }
  }

  private async processEventInternal(event: CRMEvent): Promise<ProcessedEvent> {
    const start = Date.now();
    const rules = matchEventRules(event.type, event.payload as Record<string, unknown>);

    if (this.config.logLevel === 'debug') {
      console.log(`[EventOrchestrator] ${event.type}: ${rules.length} rules matched`);
    }

    const results: EventActionResult[] = [];

    for (const rule of rules) {
      const parallelActions: EventRuleAction[] = [];
      const sequentialActions: EventRuleAction[] = [];

      for (const action of rule.actions) {
        if (action.parallel) {
          parallelActions.push(action);
        } else {
          sequentialActions.push(action);
        }
      }

      if (parallelActions.length > 0) {
        const parallelResults = await Promise.allSettled(
          parallelActions.map((a) => this.executeAction(event, a))
        );
        for (const r of parallelResults) {
          if (r.status === 'fulfilled') results.push(r.value);
        }
      }

      for (const action of sequentialActions) {
        const result = await this.executeAction(event, action);
        results.push(result);
      }
    }

    const durationMs = Date.now() - start;

    this.emit('processed', { event, rules, results, durationMs } satisfies ProcessedEvent);

    if (this.config.logLevel !== 'silent') {
      console.log(
        `[EventOrchestrator] ${event.type} processed: ${results.length} actions, ${durationMs}ms`
      );
    }

    return { event, rules, results, durationMs };
  }

  private async executeAction(
    event: CRMEvent,
    action: EventRuleAction
  ): Promise<EventActionResult> {
    const handler = getActionHandler(action.action);
    if (!handler) {
      return {
        success: false,
        action: action.action,
        agent: action.agent,
        message: `Unknown action: ${action.action}`,
      };
    }

    try {
      const timeout = action.timeout || 15000;
      const result = await Promise.race([
        handler(event),
        new Promise<EventActionResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Action ${action.action} timed out after ${timeout}ms`)), timeout)
        ),
      ]);

      if (this.config.logLevel === 'debug') {
        console.log(
          `[EventOrchestrator] Action ${action.action} completed: ${result.success ? 'OK' : 'FAIL'}`
        );
      }

      return result;
    } catch (err) {
      console.error(`[EventOrchestrator] Action ${action.action} failed:`, err);
      return {
        success: false,
        action: action.action,
        agent: action.agent,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ─── Singleton ───

let instance: EventOrchestrator | null = null;

export function getEventOrchestrator(
  config?: Partial<EventOrchestratorConfig>
): EventOrchestrator {
  if (!instance) {
    instance = new EventOrchestrator(config);
  }
  return instance;
}

export function resetEventOrchestrator(): void {
  if (instance) {
    instance.stop();
  }
  instance = null;
}
