import { AIContext, AIResponse, AIMessage } from '../types/ai.types.js';
import { classifyIntent } from '../types/intent.types.js';
import { agentRouter } from './agent.router.js';
import { DoctorAgent } from '../agents/doctor.agent.js';
import { OwnerAgent } from '../agents/owner.agent.js';
import { AdminAgent } from '../agents/admin.agent.js';
import { memoryEngine } from '../memory/memory.engine.js';
import { contextManager } from './context.manager.js';
import { prisma } from '../../../lib/prisma.js';

export class AIService {
  constructor() {
    this.registerAgents();
  }

  private registerAgents(): void {
    agentRouter.register('SEARCH_PATIENT', new DoctorAgent());
    agentRouter.register('CREATE_APPOINTMENT', new DoctorAgent());
    agentRouter.register('UPDATE_APPOINTMENT', new DoctorAgent());
    agentRouter.register('CANCEL_APPOINTMENT', new DoctorAgent());
    agentRouter.register('OPEN_MEDICAL_CARD', new DoctorAgent());
    agentRouter.register('CREATE_TREATMENT_PLAN', new DoctorAgent());
    agentRouter.register('VIEW_CBCT', new DoctorAgent());
    agentRouter.register('VIEW_SCHEDULE', new DoctorAgent());

    agentRouter.register('GENERATE_REPORT', new OwnerAgent());
    agentRouter.register('CHECK_DEBTS', new OwnerAgent());
    agentRouter.register('GET_ANALYTICS', new OwnerAgent());
    agentRouter.register('GENERATE_INVOICE', new OwnerAgent());

    agentRouter.register('SEARCH_PATIENT', new AdminAgent());
    agentRouter.register('CREATE_APPOINTMENT', new AdminAgent());
    agentRouter.register('RECORD_PAYMENT', new AdminAgent());
  }

  async processMessage(
    text: string,
    context: AIContext,
    sessionId: string
  ): Promise<AIResponse> {
    // Load session memory
    await this.loadSessionMemory(context, sessionId);

    // Classify intent
    const intentResult = classifyIntent(text);
    const intent = intentResult.intent;

    // Save user message
    await this.saveMessage(sessionId, 'user', text);

    // Check permissions
    const permissions = await contextManager.getCurrentPermissions(context.userId, context.clinicId);
    if (!this.hasPermission(permissions, intent)) {
      return this.permissionDenied(intent);
    }

    // Route to agent
    const response = await agentRouter.route(context, intent, {});

    // Save assistant message
    await this.saveMessage(sessionId, 'assistant', response.message);

    // Save session memory
    await this.saveSessionMemory(context, sessionId);

    // Update context if needed
    if (response.contextUpdate) {
      await memoryEngine.setSession(
        `context_${response.contextUpdate.type}`,
        response.contextUpdate.id,
        context.userId,
        context.clinicId
      );
    }

    // Add proactive alerts for owner/admin
    if (['OWNER', 'ADMIN', 'SUPERADMIN'].includes(context.role)) {
      const alerts = await this.getProactiveAlerts(context);
      if (alerts.length > 0) {
        response.message += '\n\n⚠️ ' + alerts.map(a => a.message).join('\n⚠️ ');
      }
    }

    return response;
  }

  private async loadSessionMemory(context: AIContext, sessionId: string): Promise<void> {
    const messages = await prisma.aIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    // Could restore context from messages
  }

  private async saveMessage(sessionId: string, role: string, content: string): Promise<void> {
    await prisma.aIMessage.create({
      data: { id: crypto.randomUUID(), sessionId, role: role as any, content },
    });
  }

  private async saveSessionMemory(context: AIContext, sessionId: string): Promise<void> {
    await memoryEngine.setSession('context', context, context.userId, context.clinicId);
  }

  private hasPermission(permissions: string[], intent: string): boolean {
    if (permissions.includes('*')) return true;
    const intentModule = intent.split('_')[0].toLowerCase();
    return permissions.some(p => p === '*' || p.startsWith(`${intentModule}:`));
  }

  private permissionDenied(intent: string): AIResponse {
    return {
      message: `Нет прав для действия: ${intent}`,
      intent,
      suggestions: ['Обратитесь к администратору'],
    };
  }

  async getProactiveAlerts(context: AIContext): Promise<Array<{ type: string; priority: string; message: string }>> {
    const alerts = [];

    const unpaidCount = await prisma.invoice.count({
      where: { clinicId: context.clinicId, status: 'UNPAID' },
    });
    if (unpaidCount > 0) {
      alerts.push({ type: 'unpaid', priority: 'high', message: `Неоплаченных счетов: ${unpaidCount}` });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const upcoming = await prisma.appointment.count({
      where: { clinicId: context.clinicId, date: { gte: new Date(), lte: tomorrow }, status: 'CONFIRMED' },
    });
    if (upcoming > 0) {
      alerts.push({ type: 'upcoming', priority: 'medium', message: `Завтра записей: ${upcoming}` });
    }

    return alerts;
  }
}

export const aiService = new AIService();