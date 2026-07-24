import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { DOCUMENTATION_TOOLS } from './tools.js';

export class DocumentationAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'documentation',
    name: 'Documentation AI',
    domain: 'documentation',
    description: 'Автоматическое формирование медицинской документации',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of DOCUMENTATION_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'GENERATE_DOCUMENTATION',
      'CREATE_TREATMENT_PLAN',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'GENERATE_DOCUMENTATION':
        return this.generateDocumentation(context, params);
      case 'CREATE_TREATMENT_PLAN':
        return this.createTreatmentPlan(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.TreatmentCompleted,
        priority: 85,
        timeout: 10000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.TreatmentCompleted:
        return this.onTreatmentCompleted(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onTreatmentCompleted(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, appointmentId, doctorId, treatments, diagnosis } = event.payload;
    if (!patientId) {
      return { success: false, action: 'onTreatmentCompleted', message: 'No patientId' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true },
    });

    return {
      success: true,
      action: 'onTreatmentCompleted',
      message: `Лечение завершено для ${patient?.firstName} ${patient?.lastName}. Формируем документацию.`,
      data: { patientId, appointmentId, doctorId, treatments, diagnosis },
      timelineEntry: {
        action: 'Документация',
        result: `Для ${patient?.firstName} ${patient?.lastName} формируется медицинская запись`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async generateDocumentation(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'GENERATE_DOCUMENTATION', suggestions: [] };
    }

    return {
      message: 'Медицинская документация сформирована',
      intent: 'GENERATE_DOCUMENTATION',
      action: { type: 'DOCUMENTATION_GENERATED', payload: { patientId } },
      suggestions: [],
    };
  }

  private async createTreatmentPlan(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'CREATE_TREATMENT_PLAN', suggestions: [] };
    }

    return {
      message: 'План лечения создан',
      intent: 'CREATE_TREATMENT_PLAN',
      action: { type: 'TREATMENT_PLAN_CREATED', payload: { patientId } },
      suggestions: [],
    };
  }
}
