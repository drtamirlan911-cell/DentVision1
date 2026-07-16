import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import type { ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

const aiRouter = Router();

aiRouter.use(authenticate);

interface IntentResult {
  intent: string;
  confidence: number;
  action?: { type: string; params: Record<string, unknown> };
  reply: string;
  suggestions?: string[];
}

const INTENT_PATTERNS: { intent: string; patterns: RegExp[]; action?: string }[] = [
  {
    intent: 'CREATE_APPOINTMENT',
    patterns: [/запиши/i, /запись/i, /назначь/i],
    action: 'navigate_to_appointments',
  },
  {
    intent: 'SEARCH_PATIENT',
    patterns: [/найди/i, /поиск пациента/i, /пациент/i],
    action: 'open_patient_search',
  },
  {
    intent: 'OPEN_MEDICAL_CARD',
    patterns: [/медкарта/i, /medical card/i, /история болезни/i],
    action: 'open_medical_card',
  },
  {
    intent: 'SHOW_CBCT',
    patterns: [/покажи кт/i, /снимок/i, /рентген/i, /cbct/i],
    action: 'open_imaging',
  },
  {
    intent: 'CREATE_TREATMENT_PLAN',
    patterns: [/план лечения/i, /составь план/i],
    action: 'open_treatment_plan',
  },
  {
    intent: 'GENERATE_INVOICE',
    patterns: [/создай счёт/i, /выстави счет/i, /invoice/i],
    action: 'open_invoice_creation',
  },
  {
    intent: 'CHECK_DEBTS',
    patterns: [/задолженности/i, /неоплаченные/i, /долги/i],
    action: 'open_debts',
  },
  {
    intent: 'ORDER_PRODUCT',
    patterns: [/купить/i, /заказать товар/i, /marketplace/i],
    action: 'open_marketplace',
  },
  {
    intent: 'FIND_COURSE',
    patterns: [/курс/i, /обучение/i, /school/i],
    action: 'open_school',
  },
  {
    intent: 'GENERATE_REPORT',
    patterns: [/отчёт/i, /отчет/i, /аналитика/i],
    action: 'open_reports',
  },
  {
    intent: 'SEARCH_DOCUMENT',
    patterns: [/документ/i, /найди документ/i],
    action: 'open_documents',
  },
];

const INTENT_REPLIES: Record<string, string> = {
  CREATE_APPOINTMENT: 'Открываю запись на приём. Выберите пациента и удобное время.',
  SEARCH_PATIENT: 'Открываю поиск пациента. Введите имя, фамилию или телефон.',
  OPEN_MEDICAL_CARD: 'Открываю медицинскую карту. Выберите пациента.',
  SHOW_CBCT: 'Открываю снимки и изображения. Выберите нужный снимок.',
  CREATE_TREATMENT_PLAN: 'Перехожу к созданию плана лечения. Выберите пациента.',
  GENERATE_INVOICE: 'Открываю создание счёта. Укажите пациента и услуги.',
  CHECK_DEBTS: 'Показываю задолженности и неоплаченные счета.',
  ORDER_PRODUCT: 'Открываю маркетплейс для заказа товаров.',
  FIND_COURSE: 'Открываю каталог обучающих курсов.',
  GENERATE_REPORT: 'Перехожу к отчётам и аналитике.',
  SEARCH_DOCUMENT: 'Открываю поиск по документам.',
};

const INTENT_SUGGESTIONS: Record<string, string[]> = {
  CREATE_APPOINTMENT: ['Показать свободное время', 'Записать пациента сейчас'],
  SEARCH_PATIENT: ['Добавить нового пациента', 'Показать всех пациентов'],
  OPEN_MEDICAL_CARD: ['Показать историю лечения', 'Добавить запись'],
  SHOW_CBCT: ['Загрузить новый снимок', 'Сравнить снимки'],
  CREATE_TREATMENT_PLAN: ['Использовать шаблон', 'Новый план с нуля'],
  GENERATE_INVOICE: ['Выставить счёт за последний приём', 'Создать счёт на аванс'],
  CHECK_DEBTS: ['Отправить напоминание', 'Сформировать акт сверки'],
  ORDER_PRODUCT: ['Показать популярные товары', 'Мои заказы'],
  FIND_COURSE: ['Моё обучение', 'Рекомендованные курсы'],
  GENERATE_REPORT: ['Отчёт за месяц', 'Отчёт по специалистам'],
  SEARCH_DOCUMENT: ['Недавние документы', 'Договоры'],
};

function classifyIntent(text: string): IntentResult {
  const trimmed = text.trim().toLowerCase();

  for (const entry of INTENT_PATTERNS) {
    const exact = entry.patterns.some((p) => p.test(trimmed) && trimmed.split(/\s+/).length <= 5);
    const partial = entry.patterns.some((p) => p.test(trimmed));

    if (exact || partial) {
      const confidence = exact ? 0.95 + Math.random() * 0.05 : 0.6 + Math.random() * 0.29;
      const action = entry.action
        ? { type: entry.action, params: { query: trimmed, source: 'ai_query' } }
        : undefined;

      return {
        intent: entry.intent,
        confidence: Math.round(confidence * 100) / 100,
        action,
        reply: INTENT_REPLIES[entry.intent] || 'Чем я могу помочь?',
        suggestions: INTENT_SUGGESTIONS[entry.intent] || [],
      };
    }
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.3,
    reply: 'Извините, я не совсем понял ваш запрос. Пожалуйста, уточните, что вы хотите сделать.',
    suggestions: [
      'Записать пациента на приём',
      'Найти пациента',
      'Показать задолженности',
      'Создать отчёт',
    ],
  };
}

aiRouter.post('/query', async (req: AuthRequest, res) => {
  try {
    const { text, context } = req.body as { text?: string; context?: Record<string, unknown> };

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'Поле text обязательно' });
    }

    const result = classifyIntent(text);

    const action = await prisma.aIAction.create({
      data: {
        id: uid(),
        userId: req.user!.id,
        intent: result.intent,
        payload: { text, context: context as any, confidence: result.confidence },
        status: 'pending',
      },
    });

    if (result.intent !== 'UNKNOWN') {
      const recent = await prisma.aIAction.findMany({
        where: { userId: req.user!.id, intent: result.intent },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      if (recent.length > 1) {
        const diffDays =
          (new Date().getTime() - new Date(recent[recent.length - 1].createdAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays < 1) {
          result.confidence = Math.min(result.confidence + 0.05, 1.0);
        }
      }
    }

    const response: ApiResponse = {
      ok: true,
      data: {
        intent: result.intent,
        confidence: result.confidence,
        action: result.action,
        reply: result.reply,
        suggestions: result.suggestions,
        actionId: action.id,
      },
    };

    return res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.get('/history', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [actions, total] = await Promise.all([
      prisma.aIAction.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.aIAction.count({ where: { userId: req.user!.id } }),
    ]);

    return res.json({
      ok: true,
      data: actions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.get('/actions', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [actions, total] = await Promise.all([
      prisma.aIAction.findMany({
        where: { userId: req.user!.id, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.aIAction.count({ where: { userId: req.user!.id, status: 'pending' } }),
    ]);

    return res.json({
      ok: true,
      data: actions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.post('/confirm/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const action = await prisma.aIAction.findUnique({ where: { id } });
    if (!action) {
      return res.status(404).json({ ok: false, error: 'Действие не найдено' });
    }
    if (action.userId !== req.user!.id) {
      return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    }

    const updated = await prisma.aIAction.update({
      where: { id },
      data: { status: 'confirmed', result: { confirmedAt: new Date().toISOString() } },
    });

    return res.json({ ok: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.get('/digital-twin', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не определена' });
    }

    const [visits, appointments, inventory] = await Promise.all([
      prisma.visit.findMany({
        where: { doctorId: req.user!.id },
        include: { patient: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'desc' },
        take: 100,
      }),
      prisma.appointment.findMany({
        where: { clinicId, doctorId: req.user!.id },
        orderBy: { date: 'desc' },
        take: 100,
      }),
      prisma.inventoryItem.findMany({
        where: { clinicId },
        orderBy: { quantity: 'asc' },
        take: 20,
      }),
    ]);

    const diagnosisCounts: Record<string, number> = {};
    for (const v of visits) {
      if (v.diagnosis) {
        const diags = v.diagnosis.split(/[,;]/).map((d) => d.trim());
        for (const d of diags) {
          diagnosisCounts[d] = (diagnosisCounts[d] || 0) + 1;
        }
      }
    }

    const topDiagnoses = Object.entries(diagnosisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([diagnosis, count]) => ({ diagnosis, count }));

    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED').length;
    const pendingAppointments = appointments.filter(
      (a) => a.status === 'PENDING' || a.status === 'CONFIRMED'
    ).length;

    const lowStockItems = inventory.filter((i) => i.quantity <= i.minimum).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      minimum: i.minimum,
    }));

    const specializations: string[] = [];
    for (const d of Object.keys(diagnosisCounts)) {
      const lower = d.toLowerCase();
      if (lower.includes('кариес') || lower.includes('пульпит')) specializations.push('Терапия');
      if (lower.includes('ортодонт') || lower.includes('прикус')) specializations.push('Ортодонтия');
      if (lower.includes('имплант') || lower.includes('протез')) specializations.push('Имплантология');
      if (lower.includes('гигиен') || lower.includes('чистк'))
        specializations.push('Гигиена');
      if (lower.includes('хирург') || lower.includes('удален'))
        specializations.push('Хирургия');
    }
    const uniqueSpecs = [...new Set(specializations)];

    const learningPath = uniqueSpecs.length > 0
      ? uniqueSpecs.map((spec) => `Рекомендовано повышение квалификации: ${spec}`)
      : ['Рекомендовано начать с базового курса терапевтической стоматологии'];

    return res.json({
      ok: true,
      data: {
        specialities: uniqueSpecs.length > 0 ? uniqueSpecs : ['Терапия'],
        commonDiagnoses: topDiagnoses,
        appointmentsCompleted: completedAppointments,
        appointmentsPending: pendingAppointments,
        equipmentNeeds: lowStockItems,
        learningPath,
        lastActive: visits.length > 0 ? visits[0].date : null,
        totalVisits: visits.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.get('/proactive', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    const userId = req.user!.id;

    const alerts: { type: string; priority: string; message: string }[] = [];

    if (!clinicId) {
      return res.json({ ok: true, data: { alerts } });
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: startOfToday, lte: endOfTomorrow },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });

    for (const apt of upcomingAppointments) {
      alerts.push({
        type: 'upcoming_appointment',
        priority: 'high',
        message: `Завтра приём: ${apt.patient.firstName} ${apt.patient.lastName} в ${apt.date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      });
    }

    const unpaidInvoices = await prisma.invoice.findMany({
      where: { clinicId, status: 'UNPAID' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const inv of unpaidInvoices) {
      alerts.push({
        type: 'unpaid_invoice',
        priority: inv.amount > 50000 ? 'high' : 'medium',
        message: `Неоплаченный счёт №${inv.id.slice(0, 8)} на сумму ${inv.amount} ₽`,
      });
    }

    const lowStockItems = await prisma.inventoryItem.findMany({
      where: { clinicId, quantity: { lte: prisma.inventoryItem.fields ? 0 : 0 } },
      orderBy: { quantity: 'asc' },
      take: 10,
    });

    if (lowStockItems.length === 0) {
      const items = await prisma.inventoryItem.findMany({
        where: { clinicId },
        orderBy: { quantity: 'asc' },
        take: 10,
      });
      for (const item of items.filter((i) => i.quantity <= i.minimum)) {
        alerts.push({
          type: 'low_stock',
          priority: item.quantity === 0 ? 'high' : 'medium',
          message: `Заканчивается ${item.name}: осталось ${item.quantity} ${item.unit || 'шт.'}`,
        });
      }
    }

    for (const alert of alerts) {
      await prisma.aIAlert.create({
        data: {
          id: uid(),
          userId,
          type: alert.type,
          priority: alert.priority,
          message: alert.message,
        },
      });
    }

    return res.json({ ok: true, data: { alerts } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.get('/greeting', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    const user = req.user!;
    const now = new Date();
    const hour = now.getHours();

    let timeGreeting: string;
    if (hour < 6) timeGreeting = 'Доброй ночи';
    else if (hour < 12) timeGreeting = 'Доброе утро';
    else if (hour < 18) timeGreeting = 'Добрый день';
    else timeGreeting = 'Добрый вечер';

    const stats: Record<string, number> = {};

    if (clinicId) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const [todayAppointments, totalPatients, unpaidInvoicesCount] = await Promise.all([
        prisma.appointment.count({
          where: { clinicId, date: { gte: todayStart }, status: { not: 'CANCELLED' } },
        }),
        prisma.patient.count({ where: { clinicId } }),
        prisma.invoice.count({ where: { clinicId, status: 'UNPAID' } }),
      ]);
      stats.todayAppointments = todayAppointments;
      stats.totalPatients = totalPatients;
      stats.unpaidInvoices = unpaidInvoicesCount;
    }

    return res.json({
      ok: true,
      data: {
        greeting: `${timeGreeting}, ${user.firstName}!`,
        stats,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.post('/context', async (req: AuthRequest, res) => {
  try {
    const { context } = req.body as { context?: Record<string, unknown> };

    if (!context || typeof context !== 'object') {
      return res.status(400).json({ ok: false, error: 'Поле context обязательно' });
    }

    const existing = await prisma.aISession.findFirst({
      where: { userId: req.user!.id },
    });

    if (existing) {
      const updated = await prisma.aISession.update({
        where: { id: existing.id },
        data: { context: context as any },
      });
      return res.json({ ok: true, data: updated });
    }

    const session = await prisma.aISession.create({
      data: {
        id: uid(),
        userId: req.user!.id,
        clinicId: req.user!.clinicId || '',
        messages: [],
        context: context as any,
      },
    });

    return res.json({ ok: true, data: session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

aiRouter.delete('/context', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.aISession.findFirst({
      where: { userId: req.user!.id },
    });

    if (existing) {
      await prisma.aISession.update({
        where: { id: existing.id },
        data: { context: {}, messages: [] },
      });
    }

    return res.json({ ok: true, data: { cleared: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

export { aiRouter };
