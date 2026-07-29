import { AbstractAgent, AgentTool, EventActionDefinition } from '../interfaces.js';
import { AgentMetadata } from '../interfaces.js';
import { AIContext, AIResponse } from '../../types/ai.types.js';
import { CRMEvent, EventType } from '../../../events/EventTypes.js';
import { EventActionResult } from '../interfaces.js';
import { prisma } from '../../../../lib/prisma.js';
import { SHOP_TOOLS } from './tools.js';

export class ShopAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'shop',
    name: 'Shop AI',
    domain: 'shop',
    description: 'Управление складом, закупка материалов, проверка остатков',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 3,
  };

  constructor() {
    super();
    for (const tool of SHOP_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'CHECK_INVENTORY',
      'ORDER_MATERIALS',
      'SUPPLIER_INFO',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'CHECK_INVENTORY':
        return this.checkInventory(context, params);
      case 'ORDER_MATERIALS':
        return this.orderMaterials(context, params);
      case 'SUPPLIER_INFO':
        return this.supplierInfo(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [
      {
        eventType: EventType.InventoryLow,
        priority: 90,
        timeout: 10000,
      },
      {
        eventType: EventType.DiagnosisSaved,
        priority: 60,
        timeout: 15000,
      },
    ];
  }

  async handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult> {
    switch (event.type) {
      case EventType.InventoryLow:
        return this.onInventoryLow(event);
      case EventType.DiagnosisSaved:
        return this.onDiagnosisSaved(event);
      default:
        return { success: false, action: actionName, message: `Unknown event: ${event.type}` };
    }
  }

  // ─── Event Handlers ───

  private async onInventoryLow(event: CRMEvent): Promise<EventActionResult> {
    const { itemId, itemName, currentQuantity, minimumQuantity } = event.payload;
    if (!itemId) {
      return { success: false, action: 'onInventoryLow', message: 'No itemId' };
    }

    return {
      success: true,
      action: 'onInventoryLow',
      message: `Критически низкий остаток: ${itemName} (${currentQuantity}/${minimumQuantity})`,
      data: { itemId, itemName, currentQuantity, minimumQuantity },
      notifyUserIds: [event.userId],
      timelineEntry: {
        action: 'Склад',
        result: `Низкий остаток: ${itemName} — ${currentQuantity} шт. (минимум: ${minimumQuantity})`,
      },
    };
  }

  private async onDiagnosisSaved(event: CRMEvent): Promise<EventActionResult> {
    const { patientId, diagnosis } = event.payload;

    return {
      success: true,
      action: 'onDiagnosisSaved',
      message: 'Диагноз сохранён. Проверяем наличие необходимых материалов.',
      data: { patientId, diagnosis },
      timelineEntry: {
        action: 'Склад',
        result: `Проверка материалов для диагноза: ${diagnosis}`,
      },
    };
  }

  // ─── Intent Handlers ───

  private async checkInventory(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Показываю текущие остатки на складе',
      intent: 'CHECK_INVENTORY',
      action: { type: 'INVENTORY_CHECKED', payload: params },
      suggestions: ['ORDER_MATERIALS', 'SUPPLIER_INFO'],
    };
  }

  private async orderMaterials(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const { itemId, quantity } = params;
    if (!itemId || !quantity) {
      return { message: 'Укажите товар и количество', intent: 'ORDER_MATERIALS', suggestions: [] };
    }

    return {
      message: `Заявка на закупку ${quantity} шт. сформирована`,
      intent: 'ORDER_MATERIALS',
      action: { type: 'PURCHASE_ORDER_CREATED', payload: { itemId, quantity } },
      suggestions: [],
    };
  }

  private async supplierInfo(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    return {
      message: 'Показываю информацию о поставщиках',
      intent: 'SUPPLIER_INFO',
      action: { type: 'SUPPLIER_INFO_RETRIEVED', payload: params },
      suggestions: ['CHECK_INVENTORY', 'ORDER_MATERIALS'],
    };
  }
}
