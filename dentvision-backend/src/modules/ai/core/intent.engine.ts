import { Intent, classifyIntent } from '../types/intent.types.js';
import { AIContext, AIResponse, IntentResult, FunctionCall, AIMessage } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';

export class IntentEngine {
  async classify(text: string, context: AIContext): Promise<IntentResult> {
    const { intent, confidence } = classifyIntent(text);
    
    const parameters = this.extractParameters(text, intent, context);
    const needsConfirmation = this.requiresConfirmation(intent);

    return {
      intent,
      confidence,
      parameters,
      needsConfirmation,
    };
  }

  private extractParameters(text: string, intent: Intent, context: AIContext): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    switch (intent) {
      case 'CREATE_APPOINTMENT':
        params.date = this.extractDate(text);
        params.time = this.extractTime(text);
        params.patientId = context.currentPatientId;
        break;
      case 'SEARCH_PATIENT':
        params.query = this.extractName(text);
        break;
      case 'ORDER_PRODUCT':
        params.productQuery = this.extractProductName(text);
        break;
      case 'FIND_COURSE':
        params.category = this.extractCategory(text);
        break;
      case 'GENERATE_INVOICE':
        params.patientId = context.currentPatientId;
        params.amount = this.extractAmount(text);
        break;
    }

    return params;
  }

  private extractDate(text: string): string | undefined {
    const dateMatch = text.match(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})|(завтра)|(послезавтра)|(через\s+\d+\s+дн)/i);
    return dateMatch ? dateMatch[0] : undefined;
  }

  private extractTime(text: string): string | undefined {
    const timeMatch = text.match(/(\d{1,2}:\d{2})|(\d{1,2}\s*ч)/i);
    return timeMatch ? timeMatch[0] : undefined;
  }

  private extractName(text: string): string | undefined {
    const nameMatch = text.match(/(?:пациента?|клиента?)\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/i);
    return nameMatch ? nameMatch[1] : undefined;
  }

  private extractProductName(text: string): string | undefined {
    const match = text.match(/(?:товар|материал|продукт)\s+([А-ЯЁа-яёA-Za-z0-9\s]+)/i);
    return match ? match[1] : undefined;
  }

  private extractCategory(text: string): string | undefined {
    const match = text.match(/(?:курс|обучение)\s+(?:по|на)\s+([А-ЯЁа-яё\s]+)/i);
    return match ? match[1] : undefined;
  }

  private extractAmount(text: string): number | undefined {
    const match = text.match(/(\d+(?:\s\d{3})*(?:[.,]\d{2})?)\s*(?:руб|₽|тенге|₸)/i);
    return match ? parseFloat(match[1].replace(/\s/g, '').replace(',', '.')) : undefined;
  }

  private requiresConfirmation(intent: Intent): boolean {
    const confirmationRequired = [
      'CREATE_APPOINTMENT',
      'GENERATE_INVOICE',
      'ORDER_PRODUCT',
      'CREATE_TREATMENT_PLAN',
    ];
    return confirmationRequired.includes(intent);
  }
}