import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { PATIENT_TOOLS } from './tools.js';

export class PatientAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'patient',
    name: 'Patient AI',
    domain: 'patient',
    description: 'Общение с пациентами, ответы на вопросы, запись на приём',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 5,
  };

  constructor() {
    super();
    for (const tool of PATIENT_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'PATIENT_INFO',
      'TREATMENT_HISTORY',
      'SEND_MESSAGE',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'PATIENT_INFO':
        return this.getPatientInfo(context, params);
      case 'TREATMENT_HISTORY':
        return this.getTreatmentHistory(context, params);
      case 'SEND_MESSAGE':
        return this.sendMessage(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.AppointmentBooked,
        priority: 50,
        timeout: 10000,
      },
      {
        eventType: EventType.FollowUpDue,
        priority: 75,
        timeout: 15000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.AppointmentBooked:
        return this.onAppointmentBooked(event);
      case EventType.FollowUpDue:
        return this.onFollowUpDue(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onAppointmentBooked(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, doctorId, date, time } = event.payload;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true, phone: true },
    });

    return {
      success: true,
      action: 'onAppointmentBooked',
      message: `Запись подтверждена: ${patient?.firstName} ${patient?.lastName} на ${date} ${time}`,
      data: { patientId, doctorId, date, time },
      timelineEntry: {
        action: 'Запись',
        result: `${patient?.firstName} ${patient?.lastName} записан на ${date} ${time}`,
      },
    };
  }

  private async onFollowUpDue(event: CRMEvent): Promise<EventActionResult> {
    const { patientId } = event.payload;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true, phone: true },
    });

    return {
      success: true,
      action: 'onFollowUpDue',
      message: `Напоминание для ${patient?.firstName} ${patient?.lastName}: пора записаться на контрольный визит`,
      data: { patientId },
      notifyUserIds: [event.userId],
      timelineEntry: {
        action: 'Напоминание',
        result: `Напоминание ${patient?.firstName} ${patient?.lastName} — контрольный визит`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async getPatientInfo(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'PATIENT_INFO', suggestions: [] };
    }

    return {
      message: 'Информация о пациенте загружена',
      intent: 'PATIENT_INFO',
      action: { type: 'PATIENT_INFO_RETRIEVED', payload: { patientId } },
      suggestions: ['TREATMENT_HISTORY', 'SEND_MESSAGE'],
    };
  }

  private async getTreatmentHistory(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'TREATMENT_HISTORY', suggestions: [] };
    }

    return {
      message: 'История лечения загружена',
      intent: 'TREATMENT_HISTORY',
      action: { type: 'TREATMENT_HISTORY_RETRIEVED', payload: { patientId } },
      suggestions: ['SEND_MESSAGE'],
    };
  }

  private async sendMessage(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const { patientId, message } = params;
    if (!patientId || !message) {
      return { message: 'Укажите пациента и текст сообщения', intent: 'SEND_MESSAGE', suggestions: [] };
    }

    return {
      message: 'Сообщение отправлено',
      intent: 'SEND_MESSAGE',
      action: { type: 'MESSAGE_SENT', payload: { patientId, message } },
      suggestions: [],
    };
  }
}
