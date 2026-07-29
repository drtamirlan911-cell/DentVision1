import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { CEO_TOOLS } from './tools.js';

export class CEOAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'ceo',
    name: 'Director AI',
    domain: 'ceo',
    description: 'Стратегическая аналитика, отчёты для руководства, утренний брифинг',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 2,
  };

  constructor() {
    super();
    for (const tool of CEO_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'DAILY_SUMMARY',
      'REVENUE_CHART',
      'DOCTOR_PERFORMANCE',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'DAILY_SUMMARY':
        return this.dailySummary(context, params);
      case 'REVENUE_CHART':
        return this.revenueChart(context, params);
      case 'DOCTOR_PERFORMANCE':
        return this.doctorPerformance(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.DailySummary,
        priority: 95,
        timeout: 30000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.DailySummary:
        return this.onDailySummary(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onDailySummary(event: CRMEvent): Promise<EventActionResult> {
    const today = new Date().toISOString().split('T')[0];

    const totalPatients = await prisma.patient.count();
    const todayAppointments = await prisma.appointment.count({
      where: {
        date: today,
      },
    });

    return {
      success: true,
      action: 'onDailySummary',
      message: `Ежедневная сводка за ${today}: ${todayAppointments} приёмов, ${totalPatients} пациентов в базе`,
      data: { date: today, totalPatients, todayAppointments },
      timelineEntry: {
        action: 'Утренний брифинг',
        result: `Сводка за ${today}: ${todayAppointments} приёмов`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async dailySummary(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Ежедневная сводка сформирована',
      intent: 'DAILY_SUMMARY',
      action: { type: 'DAILY_SUMMARY_GENERATED', payload: params },
      suggestions: ['REVENUE_CHART', 'DOCTOR_PERFORMANCE'],
    };
  }

  private async revenueChart(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Данные выручки загружены для построения графика',
      intent: 'REVENUE_CHART',
      action: { type: 'REVENUE_CHART_DATA', payload: params },
      suggestions: ['DAILY_SUMMARY'],
    };
  }

  private async doctorPerformance(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Отчёт об эффективности врачей сформирован',
      intent: 'DOCTOR_PERFORMANCE',
      action: { type: 'DOCTOR_PERFORMANCE_REPORT', payload: params },
      suggestions: ['DAILY_SUMMARY', 'REVENUE_CHART'],
    };
  }
}
