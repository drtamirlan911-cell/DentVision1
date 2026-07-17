import { Agent } from '../core/agent.router.js';
import { AIContext, AIResponse } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';

export class OwnerAgent implements Agent {
  name = 'owner';

  canHandle(intent: string): boolean {
    const ownerIntents = [
      'GENERATE_REPORT',
      'CHECK_DEBTS',
      'GET_ANALYTICS',
      'GENERATE_INVOICE',
      'VIEW_SCHEDULE',
    ];
    return ownerIntents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    const lower = intent.toLowerCase();

    switch (intent) {
      case 'GENERATE_REPORT':
        return this.generateReport(context, params);
      case 'CHECK_DEBTS':
        return this.getDebtors(context);
      case 'GET_ANALYTICS':
        return this.getAnalytics(context, params);
      case 'GENERATE_INVOICE':
        return this.createInvoice(context, params);
      case 'VIEW_SCHEDULE':
        return this.viewSchedule(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  private async getAnalytics(context: AIContext, params: Record<string, unknown>) {
    const type = params.type as string || 'overview';

    if (type === 'revenue') {
      const invoices = await prisma.invoice.findMany({
        where: { clinicId: context.clinicId, status: 'PAID' },
        select: { amount: true, createdAt: true },
      });
      const total = invoices.reduce((sum, i) => sum + i.amount, 0);
      return {
        message: `Выручка: ${total.toLocaleString()} ₽`,
        intent: 'GET_ANALYTICS',
        action: { type: 'SHOW_REVENUE', payload: { total, byMonth: this.groupByMonth(invoices) } },
        suggestions: ['Выручка по врачам', 'Выручка по услугам', 'Сравнить с прошлым месяцем'],
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
        message: 'Загрузка врачей (мин/мес):',
        intent: 'GET_ANALYTICS',
        action: {
          type: 'SHOW_UTILIZATION',
          payload: doctors.map(d => ({ name: `${d.firstName} ${d.lastName}`, minutes: byDoctor[d.id] })),
        },
        suggestions: ['Детали по врачу', 'Свободные слоты', 'Планы на неделю'],
      };
    }

    return { message: 'Доступные отчеты: revenue, doctors, debtors, patients', intent: 'GET_ANALYTICS', suggestions: ['Выручка', 'Врачи', 'Должники'] };
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
    return {
      message: `Должников: ${invoices.length}, сумма: ${total.toLocaleString()} ₽`,
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
      suggestions: ['Позвонить должникам', 'Отправить напоминания', 'Детальный отчет'],
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
      message: `Счет ${invoice.id.slice(0, 8)} на ${Number(amount).toLocaleString()} ₽ создан`,
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