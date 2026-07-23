import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { FOLLOWUP_TOOLS } from './tools.js';

export class FollowUpAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'followup',
    name: 'FollowUp AI',
    domain: 'followup',
    description: 'Контрольные звонки и напоминания пациентам',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of FOLLOWUP_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'SEND_FOLLOWUP',
      'SCHEDULE_FOLLOWUP',
      'FOLLOWUP_STATUS',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'SEND_FOLLOWUP':
        return this.sendFollowUp(context, params);
      case 'SCHEDULE_FOLLOWUP':
        return this.scheduleFollowUp(context, params);
      case 'FOLLOWUP_STATUS':
        return this.getFollowUpStatus(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.TreatmentCompleted,
        priority: 80,
        timeout: 10000,
      },
      {
        eventType: EventType.FollowUpDue,
        priority: 90,
        timeout: 15000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.TreatmentCompleted:
        return this.onTreatmentCompleted(event);
      case EventType.FollowUpDue:
        return this.onFollowUpDue(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onTreatmentCompleted(event: CRMEvent): Promise<EventActionResult> {
    const { patientId } = event.payload;
    if (!patientId) {
      return { success: false, action: 'onTreatmentCompleted', message: 'No patientId' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true, phone: true },
    });

    if (!patient) {
      return { success: false, action: 'onTreatmentCompleted', message: 'Patient not found' };
    }

    // Schedule 48h follow-up
    const followUpDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.remember(`followup:${patientId}`, {
      type: 'post-treatment',
      patientName: `${patient.firstName} ${patient.lastName}`,
      scheduledAt: followUpDate.toISOString(),
    }, 'short', 48 * 60 * 60 * 1000);

    return {
      success: true,
      action: 'onTreatmentCompleted',
      message: `Контроль запланирован для ${patient.firstName} ${patient.lastName} через 48ч`,
      data: { patientId, followUpDate },
      timelineEntry: {
        action: 'Follow-up запланирован',
        result: `Контроль ${patient.firstName} ${patient.lastName} через 48ч`,
      },
    };
  }

  private async onFollowUpDue(event: CRMEvent): Promise<EventActionResult> {
    const { patientId } = event.payload;
    if (!patientId) {
      return { success: false, action: 'onFollowUpDue', message: 'No patientId' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true, phone: true },
    });

    return {
      success: true,
      action: 'onFollowUpDue',
      message: `Время контрольного звонка: ${patient?.firstName} ${patient?.lastName}`,
      data: { patientId, patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown' },
      notifyUserIds: [event.userId],
      timelineEntry: {
        action: 'Контрольный звонок',
        result: `${patient?.firstName} ${patient?.lastName} — пора позвонить`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async sendFollowUp(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'SEND_FOLLOWUP', suggestions: [] };
    }

    return {
      message: 'Follow-up сообщение отправлено',
      intent: 'SEND_FOLLOWUP',
      action: { type: 'FOLLOWUP_SENT', payload: { patientId } },
      suggestions: [],
    };
  }

  private async scheduleFollowUp(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const { patientId, date } = params;
    if (!patientId || !date) {
      return { message: 'Укажите пациента и дату', intent: 'SCHEDULE_FOLLOWUP', suggestions: [] };
    }

    return {
      message: `Контроль запланирован на ${date}`,
      intent: 'SCHEDULE_FOLLOWUP',
      action: { type: 'FOLLOWUP_SCHEDULED', payload: { patientId, date } },
      suggestions: [],
    };
  }

  private async getFollowUpStatus(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Показываю статус контрольных звонков',
      intent: 'FOLLOWUP_STATUS',
      suggestions: [],
    };
  }
}
