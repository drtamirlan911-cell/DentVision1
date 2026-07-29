import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { FINANCE_TOOLS } from './tools.js';

export class FinanceAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'finance',
    name: 'Finance AI',
    domain: 'finance',
    description: 'Финансовый контроль, аналитика, управление счетами',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of FINANCE_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'GET_REVENUE',
      'GET_DEBTS',
      'CREATE_INVOICE',
      'FINANCIAL_REPORT',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'GET_REVENUE':
        return this.getRevenue(context, params);
      case 'GET_DEBTS':
        return this.getDebts(context, params);
      case 'CREATE_INVOICE':
        return this.createInvoice(context, params);
      case 'FINANCIAL_REPORT':
        return this.financialReport(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.PaymentReceived,
        priority: 70,
        timeout: 10000,
      },
      {
        eventType: EventType.PaymentOverdue,
        priority: 85,
        timeout: 15000,
      },
      {
        eventType: EventType.InvoiceCreated,
        priority: 50,
        timeout: 10000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.PaymentReceived:
        return this.onPaymentReceived(event);
      case EventType.PaymentOverdue:
        return this.onPaymentOverdue(event);
      case EventType.InvoiceCreated:
        return this.onInvoiceCreated(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onPaymentReceived(event: CRMEvent): Promise<EventActionResult> {
    const { invoiceId, patientId, amount, currency } = event.payload;

    return {
      success: true,
      action: 'onPaymentReceived',
      message: `Получена оплата: ${amount} ${currency} по счёту ${invoiceId}`,
      data: { invoiceId, patientId, amount, currency },
      timelineEntry: {
        action: 'Оплата',
        result: `Получено ${amount} ${currency}`,
      },
    };
  }

  private async onPaymentOverdue(event: CRMEvent): Promise<EventActionResult> {
    const { invoiceId, patientId } = event.payload;

    return {
      success: true,
      action: 'onPaymentOverdue',
      message: 'Обнаружен просроченный платёж. Требуется взыскание.',
      data: { invoiceId, patientId },
      notifyUserIds: [event.userId],
      timelineEntry: {
        action: 'Просрочка',
        result: `Просроченный платёг по счёту ${invoiceId}`,
      },
    };
  }

  private async onInvoiceCreated(event: CRMEvent): Promise<EventActionResult> {
    const { invoiceId, patientId, amount } = event.payload;

    return {
      success: true,
      action: 'onInvoiceCreated',
      message: `Создан счёт ${invoiceId} на сумму ${amount}`,
      data: { invoiceId, patientId, amount },
      timelineEntry: {
        action: 'Счёт',
        result: `Создан счёт ${invoiceId}`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async getRevenue(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Данные о выручке загружены',
      intent: 'GET_REVENUE',
      action: { type: 'REVENUE_RETRIEVED', payload: params },
      suggestions: ['FINANCIAL_REPORT'],
    };
  }

  private async getDebts(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Список задолженностей загружен',
      intent: 'GET_DEBTS',
      action: { type: 'DEBTS_RETRIEVED', payload: params },
      suggestions: ['CREATE_INVOICE'],
    };
  }

  private async createInvoice(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const { patientId, amount, description } = params;
    if (!patientId || !amount) {
      return { message: 'Укажите пациента и сумму', intent: 'CREATE_INVOICE', suggestions: [] };
    }

    return {
      message: `Счёт на сумму ${amount} создан`,
      intent: 'CREATE_INVOICE',
      action: { type: 'INVOICE_CREATED', payload: { patientId, amount, description } },
      suggestions: [],
    };
  }

  private async financialReport(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Финансовый отчёт сформирован',
      intent: 'FINANCIAL_REPORT',
      action: { type: 'FINANCIAL_REPORT_GENERATED', payload: params },
      suggestions: ['GET_REVENUE', 'GET_DEBTS'],
    };
  }
}
