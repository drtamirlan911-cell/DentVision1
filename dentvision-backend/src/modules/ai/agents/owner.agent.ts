import { Agent } from '../core/agent.router.js';
import { AIContext, AIResponse } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';
import { formatClinicMoney, resolveClinicCurrency } from '../lib/currency.js';
// morningBriefing → buildJarvisBriefing (role-aware)

export class OwnerAgent implements Agent {
  name = 'owner';

  canHandle(intent: string): boolean {
    const ownerIntents = [
      'GENERATE_REPORT',
      'CHECK_DEBTS',
      'GET_DEBTORS',
      'GET_ANALYTICS',
      'GENERATE_INVOICE',
      'VIEW_SCHEDULE',
      'MORNING_BRIEFING',
    ];
    return ownerIntents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'GENERATE_REPORT':
        return this.generateReport(context, params);
      case 'CHECK_DEBTS':
      case 'GET_DEBTORS':
        return this.getDebtors(context);
      case 'GET_ANALYTICS':
        return this.getAnalytics(context, params);
      case 'GENERATE_INVOICE':
        return this.createInvoice(context, params);
      case 'VIEW_SCHEDULE':
        return this.viewSchedule(context, params);
      case 'MORNING_BRIEFING':
        return this.morningBriefing(context);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  private async morningBriefing(context: AIContext): Promise<AIResponse> {
    const { buildJarvisBriefing } = await import('../core/jarvisBriefing.js');
    const meta = context.metadata || {};
    let firstName = String(meta.firstName || meta.userName || '').trim() || null;
    if (!firstName) {
      const u = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { firstName: true },
      }).catch(() => null);
      firstName = u?.firstName || null;
    }
    let clinicName = String(meta.clinicName || '').trim() || null;
    if (!clinicName && context.clinicId) {
      const c = await prisma.clinic.findUnique({
        where: { id: context.clinicId },
        select: { name: true },
      }).catch(() => null);
      clinicName = c?.name || null;
    }

    const briefing = await buildJarvisBriefing({
      userId: context.userId,
      clinicId: context.clinicId || null,
      role: context.role,
      firstName,
      clinicName,
      isGuest: context.isGuest,
    });

    return {
      message: briefing.message,
      intent: 'MORNING_BRIEFING',
      action: {
        type: 'SHOW_BRIEFING',
        payload: briefing.payload,
      },
      suggestions: briefing.suggestions,
    };
  }

  private async getAnalytics(context: AIContext, params: Record<string, unknown>) {
    const type = (params.type as string) || 'overview';

    if (type === 'revenue' || type === 'overview') {
      const invoices = await prisma.invoice.findMany({
        where: { clinicId: context.clinicId, status: 'PAID' },
        select: { amount: true, createdAt: true },
      });
      const total = invoices.reduce((sum, i) => sum + i.amount, 0);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthTotal = invoices
        .filter((i) => i.createdAt >= monthStart)
        .reduce((sum, i) => sum + i.amount, 0);
      const money = await resolveClinicCurrency(context.clinicId);
      const fmt = (n: number) => formatClinicMoney(n, money);

      return {
        message: [
          '**Финансы клиники**',
          '',
          `• Выручка всего: **${fmt(total)}**`,
          `• За текущий месяц: **${fmt(monthTotal)}**`,
          `• Оплаченных счетов: **${invoices.length}**`,
        ].join('\n'),
        intent: 'GET_ANALYTICS',
        action: { type: 'SHOW_REVENUE', payload: { total, monthTotal, byMonth: this.groupByMonth(invoices) } },
        suggestions: ['Проверить долги', 'Что важно сегодня?', 'Открыть аналитику'],
      };
    }

    if (type === 'doctors') {
      const appointments = await prisma.appointment.findMany({
        where: { clinicId: context.clinicId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        select: { doctorId: true, duration: true },
        take: 1000,
      });
      const byDoctor = appointments.reduce((acc, a) => {
        acc[a.doctorId] = (acc[a.doctorId] || 0) + (a.duration || 30);
        return acc;
      }, {} as Record<string, number>);

      const doctors = await prisma.user.findMany({
        where: { id: { in: Object.keys(byDoctor) } },
        select: { id: true, firstName: true, lastName: true },
      });

      return {
        message: 'Загрузка врачей (мин):',
        intent: 'GET_ANALYTICS',
        action: {
          type: 'SHOW_UTILIZATION',
          payload: doctors.map(d => ({ name: `${d.firstName} ${d.lastName}`, minutes: byDoctor[d.id] })),
        },
        suggestions: ['Детали по врачу', 'Свободные слоты', 'Планы на неделю'],
      };
    }

    return {
      message: 'Доступно: выручка, загрузка врачей, должники.',
      intent: 'GET_ANALYTICS',
      suggestions: ['Показать выручку', 'Проверить долги', 'Что важно сегодня?'],
    };
  }

  private async getDebtors(context: AIContext) {
    const invoices = await prisma.invoice.findMany({
      where: { clinicId: context.clinicId, status: { in: ['UNPAID', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const patientIds = [...new Set(invoices.map(i => i.patientId).filter(Boolean))] as string[];
    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    const patientMap = new Map(patients.map(p => [p.id, p]));
    const total = invoices.reduce((sum, i) => sum + i.amount, 0);
    const money = await resolveClinicCurrency(context.clinicId);
    const fmt = (n: number) => formatClinicMoney(n, money);

    const lines = [
      '**Долги клиники**',
      '',
      `• Должников: **${invoices.length}**`,
      `• Сумма: **${fmt(total)}**`,
    ];
    if (invoices.length > 0) {
      lines.push('', 'Ближайшие:');
      for (const inv of invoices.slice(0, 3)) {
        const p = inv.patientId ? patientMap.get(inv.patientId) : undefined;
        const name = p ? `${p.firstName} ${p.lastName}` : 'Пациент';
        lines.push(`• ${name} — ${fmt(inv.amount)}`);
      }
    }

    return {
      message: lines.join('\n'),
      intent: 'CHECK_DEBTS',
      action: {
        type: 'SHOW_DEBTORS',
        payload: invoices.map(i => {
          const p = i.patientId ? patientMap.get(i.patientId) : undefined;
          return {
            patient: p ? `${p.firstName} ${p.lastName}` : 'Неизвестно',
            amount: i.amount,
            phone: p?.phone || null,
          };
        }),
      },
      suggestions: ['Отправить напоминания', 'Показать выручку', 'Что важно сегодня?'],
    };
  }

  private async generateReport(context: AIContext, params: Record<string, unknown>) {
    return { message: 'Генерация отчета в разработке', intent: 'GENERATE_REPORT', suggestions: ['Настроить отчеты'] };
  }

  private async createInvoice(context: AIContext, params: Record<string, unknown>) {
    const { patientId, amount, items, notes } = params;
    if (!patientId || !amount) {
    return {
      message: 'Укажите пациента и сумму',
      intent: 'GENERATE_INVOICE',
      needsConfirmation: true,
      confirmData: { patientId, amount, items, notes },
      suggestions: [],
    };
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        clinicId: context.clinicId,
        patientId: patientId as string,
        amount: Number(amount),
        status: 'UNPAID',
        items: items as any || [],
        notes: notes as string || '',
      },
    });

    return {
      message: `Счет ${invoice.id.slice(0, 8)} на ${formatClinicMoney(Number(amount), await resolveClinicCurrency(context.clinicId))} создан`,
      intent: 'GENERATE_INVOICE',
      action: { type: 'OPEN_INVOICE', payload: { invoiceId: invoice.id } },
      suggestions: ['Отправить пациенту', 'Отметить оплаченным', 'Создать следующий'],
    };
  }

  private async viewSchedule(context: AIContext, params: Record<string, unknown>) {
    const date = params.date as string || new Date().toISOString().split('T')[0];
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: { clinicId: context.clinicId, date: { gte: start, lte: end } },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });

    return {
      message: `Расписание на ${new Date(date).toLocaleDateString('ru-RU')}: ${appointments.length} записей`,
      intent: 'VIEW_SCHEDULE',
      action: { type: 'OPEN_SCHEDULE', payload: { appointments, date } },
      suggestions: [],
    };
  }

  private groupByMonth(invoices: { amount: number; createdAt: Date }[]) {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      const key = inv.createdAt.toISOString().slice(0, 7);
      map.set(key, (map.get(key) || 0) + inv.amount);
    }
    return Object.fromEntries(map);
  }
}