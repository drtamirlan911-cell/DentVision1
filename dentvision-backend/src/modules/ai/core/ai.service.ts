import { AIContext, AIResponse, AIMessage } from '../types/ai.types.js';
import { classifyIntent, extractIntentParams, Intent } from '../types/intent.types.js';
import { agentRouter } from './agent.router.js';
import { DoctorAgent } from '../agents/doctor.agent.js';
import { OwnerAgent } from '../agents/owner.agent.js';
import { AdminAgent } from '../agents/admin.agent.js';
import { memoryEngine } from '../memory/memory.engine.js';
import { contextManager } from './context.manager.js';
import { prisma } from '../../../lib/prisma.js';
import { timeGreetingInTz } from '../lib/timezone.js';

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
    agentRouter.register('GET_MEDICAL_CARD', new DoctorAgent());
    agentRouter.register('CREATE_TREATMENT_PLAN', new DoctorAgent());
    agentRouter.register('VIEW_CBCT', new DoctorAgent());
    agentRouter.register('SHOW_CBCT', new DoctorAgent());
    agentRouter.register('VIEW_SCHEDULE', new DoctorAgent());

    agentRouter.register('GENERATE_REPORT', new OwnerAgent());
    agentRouter.register('CHECK_DEBTS', new OwnerAgent());
    agentRouter.register('GET_DEBTORS', new OwnerAgent());
    agentRouter.register('GET_ANALYTICS', new OwnerAgent());
    agentRouter.register('GENERATE_INVOICE', new OwnerAgent());
    agentRouter.register('MORNING_BRIEFING', new OwnerAgent());
    agentRouter.register('VIEW_SCHEDULE', new OwnerAgent());

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
    const params = extractIntentParams(text, intent);

    // Save user message
    await this.saveMessage(sessionId, 'user', text);

    // Navigation intents → return an action the frontend can execute (allowed for all roles)
    const navAction = this.mapNavigationAction(intent);
    if (navAction) {
      if (context.isGuest && ['OpenSchedule', 'OpenCashier', 'OpenFinance', 'OpenPatients'].includes(navAction)) {
        const message = guestProductPitch('Для расписания и кассы нужна клиника — войдите или откройте демо.');
        await this.saveMessage(sessionId, 'assistant', message);
        return {
          message,
          intent,
          suggestions: guestSuggestions(),
        };
      }
      const label = this.navigationLabel(intent);
      const response: AIResponse = {
        message: `Открываю: **${label}**`,
        intent,
        action: { type: navAction, payload: {} },
        suggestions: context.isGuest
          ? guestSuggestions()
          : ['Показать расписание', 'Проверить долги', 'Показать выручку'],
      };
      await this.saveMessage(sessionId, 'assistant', response.message);
      return response;
    }

    // Greeting / login: Jarvis briefing for clinic users; guests get product concierge.
    if (context.isGuest && (intent === Intent.UNKNOWN || isGreetingText(text))) {
      const message = guestWelcomeMessage();
      await this.saveMessage(sessionId, 'assistant', message);
      return { message, intent: 'GUEST_WELCOME', suggestions: guestSuggestions() };
    }

    if (!context.isGuest && (isGreetingText(text) || isBriefingAsk(text) || intent === Intent.MORNING_BRIEFING)) {
      try {
        const briefing = await agentRouter.route(context, 'MORNING_BRIEFING', params);
        await this.saveMessage(sessionId, 'assistant', briefing.message);
        return briefing;
      } catch (e) {
        console.warn('[AI] briefing fallback', e);
      }
    }

    if (intent === Intent.UNKNOWN) {
      const message =
        'На связи. Могу дать сводку дня, открыть расписание, выручку, долги или склад.\n\n' +
        'Например: «Что важно сегодня?», «Покажи расписание», «Проверь долги».';
      await this.saveMessage(sessionId, 'assistant', message);
      return {
        message,
        intent,
        suggestions: ['Что важно сегодня?', 'Показать расписание', 'Показать выручку', 'Проверить долги'],
      };
    }

    // Guests never run clinic CRM agents (empty clinic → zeros / confusing UX).
    const GUEST_CRM = new Set([
      'SEARCH_PATIENT', 'VIEW_SCHEDULE', 'GET_ANALYTICS', 'VIEW_CBCT',
      'CHECK_DEBTS', 'GENERATE_REPORT', 'LOW_STOCK',
      'VIEW_PATIENT', 'OPEN_MEDICAL_CARD_NAV', 'SHOW_CBCT', 'MORNING_BRIEFING',
      'GET_DEBTORS', 'GENERATE_INVOICE',
    ]);
    if (context.isGuest && GUEST_CRM.has(intent)) {
      const message = guestProductPitch(
        'Сводка клиники, расписание и долги доступны после входа. Пока могу рассказать о возможностях DentVision или открыть демо.',
      );
      await this.saveMessage(sessionId, 'assistant', message);
      return { message, intent: 'GUEST_GATE', suggestions: guestSuggestions() };
    }

    if (context.isGuest) {
      // Allow marketplace / school style intents via agents if any remain
      const response = await agentRouter.route(context, intent, params);
      await this.saveMessage(sessionId, 'assistant', response.message);
      return { ...response, suggestions: response.suggestions?.length ? response.suggestions : guestSuggestions() };
    }

    // Check permissions
    const permissions = await contextManager.getCurrentPermissions(context.userId, context.clinicId);
    if (!this.hasPermission(permissions, intent)) {
      return this.permissionDenied(intent);
    }

    // Route to agent
    const response = await agentRouter.route(context, intent, params);

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
    const modulesByIntent: Record<string, string[]> = {
      CREATE_APPOINTMENT: ['appointments'],
      VIEW_SCHEDULE: ['appointments'],
      SEARCH_PATIENT: ['patients'],
      OPEN_MEDICAL_CARD: ['patients', 'medical'],
      GET_MEDICAL_CARD: ['patients', 'medical'],
      CREATE_TREATMENT_PLAN: ['treatment-plans', 'medical'],
      CHECK_DEBTS: ['billing', 'reports'],
      GET_DEBTORS: ['billing', 'reports'],
      GET_ANALYTICS: ['reports', 'billing'],
      GENERATE_REPORT: ['reports'],
      GENERATE_INVOICE: ['billing'],
      MORNING_BRIEFING: ['reports', 'appointments', 'billing'],
      SHOW_CBCT: ['medical'],
      VIEW_CBCT: ['medical'],
      LOW_STOCK: ['inventory'],
    };
    const modules = modulesByIntent[intent] || [intent.split('_')[0].toLowerCase()];
    return permissions.some(
      (p) => p === '*' || modules.some((m) => p === m || p.startsWith(`${m}:`))
    );
  }

  private permissionDenied(intent: string): AIResponse {
    return {
      message: `Нет прав для действия: ${intent}`,
      intent,
      suggestions: ['Обратитесь к администратору'],
    };
  }

  private mapNavigationAction(intent: string): string | null {
    const map: Record<string, string> = {
      [Intent.OPEN_CRM]: 'OpenCRM',
      [Intent.OPEN_SCHEDULE]: 'OpenSchedule',
      [Intent.OPEN_PATIENTS]: 'OpenPatients',
      [Intent.OPEN_SCHOOL]: 'OpenSchool',
      [Intent.OPEN_SHOP]: 'OpenShop',
      [Intent.OPEN_FINANCE]: 'OpenFinance',
      [Intent.OPEN_LABORATORY]: 'OpenLab',
      [Intent.OPEN_ANALYTICS]: 'OpenAnalytics',
      [Intent.OPEN_INVENTORY]: 'OpenInventory',
      [Intent.OPEN_DOCUMENTS]: 'OpenDocuments',
      [Intent.OPEN_MEDICAL_CARD_NAV]: 'OpenMedicalCard',
      // Requests that don't need a live data lookup to be useful — send the
      // user straight to the relevant module instead of falling back to
      // "no specialized agent for this intent".
      [Intent.FIND_COURSE]: 'OpenSchool',
      [Intent.ORDER_PRODUCT]: 'OpenShop',
      [Intent.RECOMMEND_PRODUCT]: 'OpenShop',
      [Intent.SEARCH_DOCUMENT]: 'OpenDocuments',
      [Intent.RECALL_PATIENT]: 'OpenReminders',
      [Intent.LOW_STOCK]: 'OpenInventory',
    };
    return map[intent] ?? null;
  }

  private navigationLabel(intent: string): string {
    const map: Record<string, string> = {
      [Intent.OPEN_CRM]: 'CRM',
      [Intent.OPEN_SCHEDULE]: 'Расписание',
      [Intent.OPEN_PATIENTS]: 'Пациенты',
      [Intent.OPEN_SCHOOL]: 'Школа',
      [Intent.OPEN_SHOP]: 'Магазин',
      [Intent.OPEN_FINANCE]: 'Финансы',
      [Intent.OPEN_LABORATORY]: 'Лаборатория',
      [Intent.OPEN_ANALYTICS]: 'Аналитика',
      [Intent.OPEN_INVENTORY]: 'Склад',
      [Intent.OPEN_DOCUMENTS]: 'Документы',
      [Intent.OPEN_MEDICAL_CARD_NAV]: 'Медицинская карта',
      [Intent.FIND_COURSE]: 'Школа',
      [Intent.ORDER_PRODUCT]: 'Магазин',
      [Intent.RECOMMEND_PRODUCT]: 'Магазин',
      [Intent.SEARCH_DOCUMENT]: 'Документы',
      [Intent.RECALL_PATIENT]: 'Напоминания',
      [Intent.LOW_STOCK]: 'Склад',
    };
    return map[intent] ?? 'раздел';
  }

  async getProactiveAlerts(context: AIContext): Promise<Array<{ type: string; priority: string; message: string }>> {
    const alerts = [];

    const unpaidCount = await prisma.invoice.count({
      where: { clinicId: context.clinicId, status: 'UNPAID' },
    });
    if (unpaidCount > 0) {
      alerts.push({ type: 'error', priority: 'high', message: `Неоплаченных счетов: ${unpaidCount}` });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const upcoming = await prisma.appointment.count({
      where: { clinicId: context.clinicId, date: { gte: new Date(), lte: tomorrow }, status: 'CONFIRMED' },
    });
    if (upcoming > 0) {
      alerts.push({ type: 'warning', priority: 'medium', message: `Завтра записей: ${upcoming}` });
    }

    return alerts;
  }
}

function isGreetingText(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  return (
    /^(привет|здравствуй|добрый|hello|hi|приветствие|сводка|брифинг)\b/i.test(t)
    || t === 'приветствие'
    || t === 'сводка при входе'
    || t === 'jarvis briefing'
  );
}

function isBriefingAsk(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  return /что\s+важно|сводка|брифинг|обзор\s+дня|резюме\s+дня/.test(t);
}

function guestSuggestions(): string[] {
  return ['Чем полезен DentVision?', 'Открыть демо-клинику', 'Что в Academy OS?'];
}

function guestWelcomeMessage(): string {
  // Server runs in UTC; greet by clinic default TZ (KZ).
  const greeting = timeGreetingInTz();
  return [
    `${greeting}! Я DentVision Intelligence — ваш гид по стоматологической SuperApp.`,
    '',
    'Здесь можно:',
    '• **CRM клиники** — расписание, пациенты, касса и медкарты в одном месте',
    '• **Маркетплейс** — закупки у проверенных поставщиков',
    '• **Academy OS** — курсы и вебинары для врачей',
    '• **ИИ-ассистент** — после входа работает с живыми данными вашей клиники',
    '',
    'Спросите что угодно о платформе — или откройте демо, чтобы посмотреть CRM в деле.',
  ].join('\n');
}

function guestProductPitch(lead: string): string {
  return [
    lead,
    '',
    'DentVision объединяет клинику, закупки и обучение:',
    '• единый ИИ-рабочий стол',
    '• CRM без разрозненных таблиц',
    '• маркетплейс и Academy OS рядом',
    '',
    'Войдите или откройте демо — и я смогу работать с вашими данными.',
  ].join('\n');
}

export const aiService = new AIService();