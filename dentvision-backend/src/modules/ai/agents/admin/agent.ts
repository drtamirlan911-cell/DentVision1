import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { ADMIN_TOOLS } from './tools.js';

export class AdminAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'admin',
    name: 'Admin AI',
    domain: 'admin',
    description: 'Администрирование клиники, управление расписанием, уведомления',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of ADMIN_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'MANAGE_SCHEDULE',
      'STAFF_LIST',
      'AUDIT_LOG',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'MANAGE_SCHEDULE':
        return this.manageSchedule(context, params);
      case 'STAFF_LIST':
        return this.staffList(context, params);
      case 'AUDIT_LOG':
        return this.auditLog(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.PatientNoShow,
        priority: 70,
        timeout: 10000,
      },
      {
        eventType: EventType.AppointmentCancelled,
        priority: 60,
        timeout: 10000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.PatientNoShow:
        return this.onPatientNoShow(event);
      case EventType.AppointmentCancelled:
        return this.onAppointmentCancelled(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onPatientNoShow(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, doctorId } = event.payload;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true, phone: true },
    });

    return {
      success: true,
      action: 'onPatientNoShow',
      message: `Пациент ${patient?.firstName} ${patient?.lastName} не явился на приём`,
      data: { patientId, doctorId },
      notifyUserIds: [event.userId],
      timelineEntry: {
        action: 'Пропуск',
        result: `${patient?.firstName} ${patient?.lastName} — неявка на приём`,
      },
    };
  }

  private async onAppointmentCancelled(event: CRMEvent): Promise<EventActionResult> {
    const { appointmentId, patientId } = event.payload;

    return {
      success: true,
      action: 'onAppointmentCancelled',
      message: `Приём ${appointmentId} отменён. Предложите перенос.`,
      data: { appointmentId, patientId },
      timelineEntry: {
        action: 'Отмена',
        result: `Приём ${appointmentId} отменён`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async manageSchedule(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Расписание загружено',
      intent: 'MANAGE_SCHEDULE',
      action: { type: 'SCHEDULE_MANAGED', payload: params },
      suggestions: ['STAFF_LIST'],
    };
  }

  private async staffList(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Список персонала загружен',
      intent: 'STAFF_LIST',
      action: { type: 'STAFF_LIST_RETRIEVED', payload: params },
      suggestions: ['MANAGE_SCHEDULE', 'AUDIT_LOG'],
    };
  }

  private async auditLog(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Журнал аудита загружен',
      intent: 'AUDIT_LOG',
      action: { type: 'AUDIT_LOG_RETRIEVED', payload: params },
      suggestions: [],
    };
  }
}
