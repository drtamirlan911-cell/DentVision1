import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { RADIOLOGY_TOOLS } from './tools.js';

export class RadiologyAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'radiology',
    name: 'Radiology AI',
    domain: 'radiology',
    description: 'Анализ рентгеновских снимков, выявление патологий',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of RADIOLOGY_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'ANALYZE_XRAY',
      'DETECT_PATHOLOGY',
      'XRAY_REPORT',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'ANALYZE_XRAY':
        return this.analyzeXray(context, params);
      case 'DETECT_PATHOLOGY':
        return this.detectPathology(context, params);
      case 'XRAY_REPORT':
        return this.xrayReport(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.XrayUploaded,
        priority: 95,
        timeout: 20000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.XrayUploaded:
        return this.onXrayUploaded(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onXrayUploaded(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, imageUrl, imageType } = event.payload;
    if (!patientId || !imageUrl) {
      return { success: false, action: 'onXrayUploaded', message: 'No patientId or imageUrl' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { firstName: true, lastName: true },
    });

    return {
      success: true,
      action: 'onXrayUploaded',
      message: `Новый снимок (${imageType}) загружен для ${patient?.firstName} ${patient?.lastName}. Требуется анализ.`,
      data: { patientId, imageUrl, imageType },
      timelineEntry: {
        action: 'Рентгеновский анализ',
        result: `Загружен снимок ${imageType} для ${patient?.firstName} ${patient?.lastName}`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async analyzeXray(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const { imageUrl, patientId } = params;
    if (!imageUrl || !patientId) {
      return { message: 'Укажите изображение и пациента', intent: 'ANALYZE_XRAY', suggestions: [] };
    }

    return {
      message: 'Анализ снимка выполняется...',
      intent: 'ANALYZE_XRAY',
      action: { type: 'XRAY_ANALYZED', payload: { imageUrl, patientId } },
      suggestions: ['DETECT_PATHOLOGY', 'XRAY_REPORT'],
    };
  }

  private async detectPathology(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const imageUrl = params.imageUrl as string;
    if (!imageUrl) {
      return { message: 'Укажите изображение', intent: 'DETECT_PATHOLOGY', suggestions: [] };
    }

    return {
      message: 'Выявление патологий выполняется...',
      intent: 'DETECT_PATHOLOGY',
      action: { type: 'PATHOLOGY_DETECTED', payload: { imageUrl } },
      suggestions: ['XRAY_REPORT'],
    };
  }

  private async xrayReport(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'XRAY_REPORT', suggestions: [] };
    }

    return {
      message: 'Отчёт по снимку сформирован',
      intent: 'XRAY_REPORT',
      action: { type: 'XRAY_REPORT_GENERATED', payload: { patientId } },
      suggestions: [],
    };
  }
}
