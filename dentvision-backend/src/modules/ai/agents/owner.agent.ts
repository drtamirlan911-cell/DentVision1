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
      'STOCK_ANALYSIS',
      'OCCUPANCY_RATE',
      'TOP_PATIENTS',
      'DOCTOR_PERFORMANCE',
      'CLINIC_METRICS',
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
      case 'STOCK_ANALYSIS':
        return this.stockAnalysis(context);
      case 'OCCUPANCY_RATE':
        return this.occupancyRate(context, params);
      case 'TOP_PATIENTS':
        return this.topPatients(context);
      case 'DOCTOR_PERFORMANCE':
        return this.doctorPerformance(context, params);
      case 'CLINIC_METRICS':
        return this.clinicMetrics(context);
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
      timeZone: typeof meta.timeZone === 'string' ? meta.timeZone : null,
    });

    return {
      message: briefing.message,
      intent: 'MORNING_BRIEFING',
      action: {
        type: 'SHOW_BRIEFING',
        payload: briefing.payload,
      },
      suggestions: briefing.suggestions?.length
        ? briefing.suggestions
        : ['Показать расписание', 'Проверить долги', 'Показать выручку', 'Аналитика клиники'],
    };
  }

  private async getAnalytics(context: AIContext, params: Record<string, unknown>) {
    const type = (params.type as string) || 'overview';

    if (type === 'revenue' || type === 'overview') {
      const invoices = await prisma.invoice.findMany({
        where: { clinicId: context.clinicId, status: 'paid' },
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

      const appointmentsToday = await prisma.appointment.count({
        where: { clinicId: context.clinicId, date: { gte: new Date(new Date().setHours(0,0,0,0)), lte: new Date(new Date().setHours(23,59,59,999)) } },
      });

      return {
        message: [
          '**Финансы клиники**',
          '',
          `• Выручка всего: **${fmt(total)}**`,
          `• За текущий месяц: **${fmt(monthTotal)}**`,
          `• Оплаченных счетов: **${invoices.length}**`,
          `• Записей сегодня: **${appointmentsToday}**`,
        ].join('\n'),
        intent: 'GET_ANALYTICS',
        action: { type: 'SHOW_REVENUE', payload: { total, monthTotal, byMonth: this.groupByMonth(invoices), appointmentsToday } },
        suggestions: ['Проверить долги', 'Что важно сегодня?', 'Загрузка врачей', 'Открыть аналитику'],
      };
    }

    if (type === 'doctors') {
      const appointments = await prisma.appointment.findMany({
        where: { clinicId: context.clinicId, status: { in: ['confirmed', 'completed'] } },
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
      message: 'Доступно: выручка, загрузка врачей, должники, аналитика склада.',
      intent: 'GET_ANALYTICS',
      suggestions: ['Показать выручку', 'Проверить долги', 'Аналитика склада', 'Что важно сегодня?'],
    };
  }

  private async stockAnalysis(context: AIContext) {
    const inventory = await prisma.inventoryItem.findMany({
      where: { clinicId: context.clinicId },
      orderBy: { quantity: 'asc' },
      take: 20,
    });

    if (!inventory.length) {
      return { message: 'Склад пуст или не подключён', intent: 'STOCK_ANALYSIS', suggestions: ['Добавить товар', 'Закупка'] };
    }

    const lowStock = inventory.filter(i => i.quantity <= (i.minimum || 5));
    const totalItems = inventory.reduce((sum, i) => sum + (i.quantity * (i.price || 0)), 0);
    const money = await resolveClinicCurrency(context.clinicId);
    const fmt = (n: number) => formatClinicMoney(n, money);

    const lines = [
      '**Аналитика склада**',
      '',
      `• Всего позиций: **${inventory.length}**`,
      `• Запас на складе: **${fmt(totalItems)}**`,
      lowStock.length ? `• Требуют закупки: **${lowStock.length}**` : '',
      '',
      lowStock.length ? '**Заканчивается:**' : '',
      ...lowStock.slice(0, 5).map(i => `• ${i.name} — остаток ${i.quantity} ${i.unit || 'шт'}`),
    ].filter(Boolean);

    return {
      message: lines.join('\n'),
      intent: 'STOCK_ANALYSIS',
      action: {
        type: 'SHOW_INVENTORY',
        payload: { items: inventory, lowStock: lowStock.slice(0, 5), totalValue: totalItems },
      },
      suggestions: lowStock.length
        ? ['Заказать расходники', 'Полный отчёт склада']
        : ['Полный отчёт склада', 'Закупка'],
    };
  }

  private async occupancyRate(context: AIContext, params: Record<string, unknown>) {
    const period = (params.period as string) || 'week';
    const now = new Date();
    let start: Date;
    if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'today') {
      start = new Date(now.setHours(0, 0, 0, 0));
    } else {
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
    }

    const totalSlots = 8 * 60; // 8 hours * 60 min
    const appointments = await prisma.appointment.findMany({
      where: { clinicId: context.clinicId, date: { gte: start }, status: { in: ['confirmed', 'completed'] } },
      select: { duration: true, doctorId: true },
    });

    const totalMinutes = appointments.reduce((sum, a) => sum + (a.duration || 30), 0);
    const doctors = await prisma.clinicMember.count({ where: { clinicId: context.clinicId, role: 'DOCTOR' } });
    const availableMinutes = totalSlots * (doctors || 1);
    const occupancy = availableMinutes > 0 ? Math.round((totalMinutes / availableMinutes) * 100) : 0;

    return {
      message: `**Загрузка клиники**\n\n• Период: **${period === 'today' ? 'Сегодня' : period === 'month' ? 'Месяц' : 'Неделя'}**\n• Загрузка: **${occupancy}%**\n• Всего минут: **${totalMinutes}** из **${availableMinutes}**\n• Врачей: **${doctors}**`,
      intent: 'OCCUPANCY_RATE',
      action: {
        type: 'SHOW_OCCUPANCY',
        payload: { period, occupancy, totalMinutes, availableMinutes, doctorsCount: doctors },
      },
      suggestions: ['Загрузка по врачам', 'Сегодня', 'Неделя', 'Месяц'],
    };
  }

  private async topPatients(context: AIContext) {
    const patients = await prisma.patient.findMany({
      where: { clinicId: context.clinicId },
      include: {
        invoices: { where: { status: 'paid' }, select: { amount: true } },
        visits: { select: { id: true } },
        appointments: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const sorted = patients
      .map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        totalSpent: p.invoices.reduce((sum, i) => sum + i.amount, 0),
        visitsCount: p.visits.length + p.appointments.length,
        phone: p.phone,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const money = await resolveClinicCurrency(context.clinicId);
    const fmt = (n: number) => formatClinicMoney(n, money);

    const lines = [
      '**Топ пациентов**',
      '',
      ...sorted.map((p, i) => `${i + 1}. ${p.name} — ${fmt(p.totalSpent)} (${p.visitsCount} визитов)`),
    ];

    return {
      message: lines.join('\n'),
      intent: 'TOP_PATIENTS',
      action: { type: 'SHOW_TOP_PATIENTS', payload: sorted },
      suggestions: ['Выручка', 'Долги', 'Расписание'],
    };
  }

  private async doctorPerformance(context: AIContext, params: Record<string, unknown>) {
    const doctorId = params.doctorId as string;

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId: context.clinicId,
        ...(doctorId ? { doctorId } : {}),
        status: { in: ['confirmed', 'completed'] },
      },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    });

    const byDoctor = appointments.reduce((acc, a) => {
      const name = a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : 'Неизвестно';
      if (!acc[name]) acc[name] = { appointments: 0, minutes: 0, completed: 0 };
      acc[name].appointments++;
      acc[name].minutes += a.duration || 30;
      if (a.status === 'completed') acc[name].completed++;
      return acc;
    }, {} as Record<string, { appointments: number; minutes: number; completed: number }>);

    const lines = [
      '**Эффективность врачей**',
      '',
      ...Object.entries(byDoctor).map(([name, data]) =>
        `• **${name}** — ${data.appointments} записей, ${Math.round(data.minutes / 60)}ч, завершено ${data.completed}`
      ),
    ];

    return {
      message: lines.join('\n'),
      intent: 'DOCTOR_PERFORMANCE',
      action: { type: 'SHOW_DOCTOR_PERFORMANCE', payload: byDoctor },
      suggestions: ['Загрузка клиники', 'Выручка', 'Топ пациентов'],
    };
  }

  private async clinicMetrics(context: AIContext) {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPatients,
      appointmentsToday,
      appointmentsMonth,
      invoicesPaid,
      invoicesUnpaid,
      doctorsCount,
      inventoryItems,
    ] = await Promise.all([
      prisma.patient.count({ where: { clinicId: context.clinicId } }),
      prisma.appointment.count({ where: { clinicId: context.clinicId, date: { gte: todayStart }, status: { in: ['confirmed', 'completed'] } } }),
      prisma.appointment.count({ where: { clinicId: context.clinicId, date: { gte: monthStart } } }),
      prisma.invoice.aggregate({ where: { clinicId: context.clinicId, status: 'paid' }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { clinicId: context.clinicId, status: 'unpaid' }, _sum: { amount: true } }),
      prisma.clinicMember.count({ where: { clinicId: context.clinicId, role: 'DOCTOR' } }),
      prisma.inventoryItem.count({ where: { clinicId: context.clinicId } }),
    ]);

    const money = await resolveClinicCurrency(context.clinicId);
    const fmt = (n: number) => formatClinicMoney(n, money);

    return {
      message: [
        '**Сводка клиники**',
        '',
        `👥 Пациентов всего: **${totalPatients}**`,
        `📅 Записей сегодня: **${appointmentsToday}**`,
        `📅 Записей за месяц: **${appointmentsMonth}**`,
        `🩺 Врачей: **${doctorsCount}**`,
        `💰 Выручка: **${fmt(invoicesPaid._sum.amount || 0)}**`,
        `⚠️ Долги: **${fmt(invoicesUnpaid._sum.amount || 0)}**`,
        `📦 Позиций на складе: **${inventoryItems}**`,
      ].join('\n'),
      intent: 'CLINIC_METRICS',
      action: {
        type: 'SHOW_CLINIC_METRICS',
        payload: {
          totalPatients,
          appointmentsToday,
          appointmentsMonth,
          doctorsCount,
          revenue: invoicesPaid._sum.amount || 0,
          debt: invoicesUnpaid._sum.amount || 0,
          inventoryItems,
        },
      },
      suggestions: ['Выручка', 'Долги', 'Загрузка врачей', 'Склад'],
    };
  }

  private async getDebtors(context: AIContext) {
    const invoices = await prisma.invoice.findMany({
      where: { clinicId: context.clinicId, status: { in: ['unpaid', 'partial'] } },
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
      suggestions: ['Показать расписание', 'Показать выручку', 'Что важно сегодня?'],
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
        status: 'unpaid',
        items: items as any || [],
        notes: notes as string || '',
      },
    });

    const money = await resolveClinicCurrency(context.clinicId);
    return {
      message: `Счет ${invoice.id.slice(0, 8)} на ${formatClinicMoney(Number(amount), money)} создан`,
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
