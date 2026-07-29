import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { CLINICAL_TOOLS } from './tools.js';

export class ClinicalAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'clinical',
    name: 'Clinical AI',
    domain: 'clinical',
    description: 'Анализ жалоб, рекомендации обследований, предварительные диагнозы',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of CLINICAL_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'ANALYZE_SYMPTOMS',
      'RECOMMEND_EXAMS',
      'PRELIMINARY_DIAGNOSIS',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'ANALYZE_SYMPTOMS':
        return this.analyzeSymptoms(context, params);
      case 'RECOMMEND_EXAMS':
        return this.recommendExams(context, params);
      case 'PRELIMINARY_DIAGNOSIS':
        return this.preliminaryDiagnosis(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.PatientCreated,
        priority: 90,
        timeout: 10000,
      },
      {
        eventType: EventType.ComplaintUpdated,
        priority: 85,
        timeout: 15000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.PatientCreated:
        return this.onPatientCreated(event);
      case EventType.ComplaintUpdated:
        return this.onComplaintUpdated(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onPatientCreated(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, complaints } = event.payload;
    if (!patientId) {
      return { success: false, action: 'onPatientCreated', message: 'No patientId' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true },
    });

    if (!patient) {
      return { success: false, action: 'onPatientCreated', message: 'Patient not found' };
    }

    return {
      success: true,
      action: 'onPatientCreated',
      message: `Новый пациент: ${patient.firstName} ${patient.lastName}. Требуется анализ жалоб.`,
      data: { patientId, complaints },
      timelineEntry: {
        action: 'Клинический анализ',
        result: `Зарегистрирован новый пациент ${patient.firstName} ${patient.lastName}`,
      },
    };
  }

  private async onComplaintUpdated(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, complaint } = event.payload;
    if (!patientId) {
      return { success: false, action: 'onComplaintUpdated', message: 'No patientId' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true },
    });

    return {
      success: true,
      action: 'onComplaintUpdated',
      message: `Обновлены жалобы пациента ${patient?.firstName} ${patient?.lastName}`,
      data: { patientId, complaint },
      timelineEntry: {
        action: 'Жалоба обновлена',
        result: `${patient?.firstName} ${patient?.lastName}: ${complaint}`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async analyzeSymptoms(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    const symptoms = params.symptoms as string;
    if (!patientId || !symptoms) {
      return { message: 'Укажите пациента и симптомы', intent: 'ANALYZE_SYMPTOMS', suggestions: [] };
    }

    return {
      message: `Анализ симптомов: ${symptoms}`,
      intent: 'ANALYZE_SYMPTOMS',
      action: { type: 'SYMPTOMS_ANALYZED', payload: { patientId, symptoms } },
      suggestions: ['RECOMMEND_EXAMS', 'PRELIMINARY_DIAGNOSIS'],
    };
  }

  private async recommendExams(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'RECOMMEND_EXAMS', suggestions: [] };
    }

    return {
      message: 'Рекомендации по обследованиям сформированы',
      intent: 'RECOMMEND_EXAMS',
      action: { type: 'EXAMS_RECOMMENDED', payload: { patientId } },
      suggestions: [],
    };
  }

  private async preliminaryDiagnosis(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'PRELIMINARY_DIAGNOSIS', suggestions: [] };
    }

    return {
      message: 'Предварительные предположения сформированы. Необходима консультация врача.',
      intent: 'PRELIMINARY_DIAGNOSIS',
      action: { type: 'DIAGNOSIS_PRELIMINARY', payload: { patientId } },
      suggestions: ['RECOMMEND_EXAMS'],
    };
  }
}
