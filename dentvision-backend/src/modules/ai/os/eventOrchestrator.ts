import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { eventBus, eventStore } from '../../events/index.js';
import { CRMEvent } from '../../events/EventTypes.js';
import { matchEventRules, EventRule, EventRuleAction } from './eventRules.js';
import { getActionHandler, EventActionResult } from './eventActions.js';
import { sseManager } from '../ai.notifications.routes.js';
import prisma from '../../../lib/prisma.js';
import { simpleChat } from '../llm/client.js';

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

const AGENT_ROLES: Record<string, string[]> = {
  doctor: ['DOCTOR', 'ASSISTANT'],
  reception: ['ADMIN', 'ASSISTANT'],
  finance: ['CASHIER', 'OWNER', 'MANAGER'],
  ceo: ['OWNER', 'SUPERADMIN'],
  supply: ['MANAGER', 'OWNER', 'ADMIN'],
  lab: ['LAB', 'MANAGER'],
};

function notificationId(eventId: string, userId: string, actionIndex: number): string {
  return `ai_${createHash('sha256')
    .update(`${eventId}:${userId}:${actionIndex}`)
    .digest('hex')
    .slice(0, 45)}`;
}

/**
 * The model is the reasoning layer, not the source of truth. For the proactive
 * CEO heartbeat we give it only the deterministic facts already collected by
 * the Event Action and require a short operational brief. If OpenAI is not
 * configured or fails, the deterministic message remains usable.
 */
async function enrichEmployeeResult(
  event: CRMEvent,
  action: EventRuleAction,
  result: EventActionResult,
): Promise<EventActionResult> {
  if (!result.success || !result.message || action.action !== 'generateDailySummary') {
    return result;
  }

  try {
    const facts = JSON.stringify({
      clinicId: event.clinicId,
      generatedAt: event.timestamp.toISOString(),
      metrics: result.data || {},
    });

    const brief = await simpleChat(
      [
        'Ты DentVision AI — постоянный операционный AI-сотрудник руководителя стоматологической клиники.',
        'Работай только с переданными фактами. Не выдумывай метрики, события, пациентов или финансовые значения.',
        'Не ставь медицинские диагнозы и не принимай критические медицинские или финансовые решения.',
        'Сформируй короткий рабочий бриф на русском в формате:',
        'Сейчас: ...',
        'Внимание: ...',
        'Возможность: ...',
        'Рекомендуемое действие: ...',
        'Если данных недостаточно, прямо укажи это. Не добавляй вступление или заключение.',
      ].join('\n'),
      facts,
      {
        maxTokens: 450,
      },
    );

    if (!brief.trim()) return result;

    return {
      ...result,
      message: brief.trim(),
      data: {
        ...(result.data || {}),
        aiReasoned: true,
        aiReasoningGeneratedAt: new Date().toISOString(),
      },
      timelineEntry: {
        action: 'AI-бриф руководителя',
        result: brief.trim(),
      },
    };
  } catch (error) {
    console.warn('[EventOrchestrator] AI employee reasoning failed; using deterministic result', error);
    return result;
  }
}

export class EventOrchestrator extends EventEmitter {
  private unsubscribe: (() => void) | null = null;
  private config: EventOrchestratorConfig;
  private activeCount = 0;
  private queue: Array<{ event: CRMEvent; resolve: () => void }> = [];

  constructor(config?: Partial<EventOrchestratorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = eventBus.subscribe('*', this.handleEvent.bind(this));
    if (this.config.logLevel !== 'silent') {
      console.log('[EventOrchestrator] Subscribed to EventBus');
    }
  }

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

  async processEvent(event: CRMEvent): Promise<ProcessedEvent> {
    return this.processEventInternal(event);
  }

  private async handleEvent(event: CRMEvent): Promise<void> {
    if (!this.config.enabled) return;

    if (this.activeCount >= this.config.concurrency) {
      return new Promise<void>((resolve) => this.queue.push({ event, resolve }));
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
    while (this.queue.length && this.activeCount < this.config.concurrency) {
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
    await eventStore.markProcessing(event.id);

    try {
      const rules = matchEventRules(event.type, event.payload as Record<string, unknown>);
      const results: EventActionResult[] = [];

      for (const rule of rules) {
        const parallel = rule.actions.filter((action) => action.parallel);
        const sequential = rule.actions.filter((action) => !action.parallel);

        if (parallel.length) {
          const settled = await Promise.allSettled(
            parallel.map((action) => this.executeAction(event, action)),
          );
          for (const item of settled) {
            if (item.status === 'fulfilled') results.push(item.value);
          }
        }

        for (const action of sequential) {
          results.push(await this.executeAction(event, action));
        }
      }

      const processed: ProcessedEvent = {
        event,
        rules,
        results,
        durationMs: Date.now() - start,
      };

      await this.publishRealtimeResults(processed);
      await eventStore.markCompleted(event.id, {
        results: results.map((result) => ({
          action: result.action,
          agent: result.agent,
          success: result.success,
        })),
      });
      this.emit('processed', processed);

      if (this.config.logLevel !== 'silent') {
        console.log(
          `[EventOrchestrator] ${event.type} processed: ${results.length} actions, ${processed.durationMs}ms`,
        );
      }

      return processed;
    } catch (error) {
      await eventStore.markFailed(event.id, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async resolveRecipients(
    event: CRMEvent,
    action: EventRuleAction,
    result: EventActionResult,
  ): Promise<string[]> {
    if (result.notifyUserIds?.length) return [...new Set(result.notifyUserIds)];

    const roles = AGENT_ROLES[action.agent] || [];
    if (!roles.length || !event.clinicId) return [];

    const members = await prisma.clinicMember.findMany({
      where: {
        clinicId: event.clinicId,
        role: { in: roles as any },
      },
      select: { userId: true },
      take: 50,
    });

    return [...new Set(members.map((member) => member.userId))];
  }

  private async publishRealtimeResults(processed: ProcessedEvent): Promise<void> {
    for (let index = 0; index < processed.results.length; index++) {
      const result = processed.results[index];
      if (!result.success || !result.message) continue;

      const rule = processed.rules.find((candidate) =>
        candidate.actions.some((action) => action.action === result.action),
      );
      const action = rule?.actions.find((candidate) => candidate.action === result.action);
      if (!action) continue;

      try {
        const targets = await this.resolveRecipients(processed.event, action, result);
        if (!targets.length) continue;

        const title = result.critical
          ? 'DentVision AI — требует внимания'
          : `DentVision AI — ${result.agent}`;
        const notificationData = {
          eventId: processed.event.id,
          eventType: processed.event.type,
          agent: result.agent,
          action: result.action,
          message: result.message,
          critical: Boolean(result.critical),
          data: result.data || {},
          timelineEntry: result.timelineEntry || null,
        };

        await Promise.all(
          targets.map((userId) =>
            prisma.notification
              .upsert({
                where: { id: notificationId(processed.event.id, userId, index) },
                create: {
                  id: notificationId(processed.event.id, userId, index),
                  userId,
                  type: result.critical ? 'error' : 'workflow',
                  title,
                  message: result.message!,
                  link:
                    typeof result.data?.patientId === 'string'
                      ? `/crm/patients/${result.data.patientId}`
                      : null,
                },
                update: {
                  title,
                  message: result.message!,
                  link:
                    typeof result.data?.patientId === 'string'
                      ? `/crm/patients/${result.data.patientId}`
                      : null,
                },
              })
              .catch((error) => {
                console.warn('[EventOrchestrator] notification persistence failed', error);
                return null;
              }),
          ),
        );

        sseManager.broadcast(processed.event.clinicId, {
          id: `ai-event-${processed.event.id}-${index}`,
          type: result.critical ? 'alert' : 'ai_event',
          data: notificationData,
          timestamp: new Date().toISOString(),
          clinicId: processed.event.clinicId,
          targetUserIds: targets,
        });
      } catch (error) {
        console.warn('[EventOrchestrator] proactive delivery failed', error);
      }
    }
  }

  private async executeAction(
    event: CRMEvent,
    action: EventRuleAction,
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
      const timeout = action.timeout || 15_000;
      const result = await Promise.race([
        handler(event),
        new Promise<EventActionResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Action ${action.action} timed out after ${timeout}ms`)), timeout),
        ),
      ]);

      return enrichEmployeeResult(event, action, result);
    } catch (error) {
      console.error(`[EventOrchestrator] Action ${action.action} failed:`, error);
      return {
        success: false,
        action: action.action,
        agent: action.agent,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

let instance: EventOrchestrator | null = null;

export function getEventOrchestrator(
  config?: Partial<EventOrchestratorConfig>,
): EventOrchestrator {
  if (!instance) instance = new EventOrchestrator(config);
  return instance;
}

export function resetEventOrchestrator(): void {
  if (instance) instance.stop();
  instance = null;
}
