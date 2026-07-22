/**
 * Jarvis-style role briefing — concise, proactive, action-oriented.
 * Used on login and for «Что важно сегодня?».
 */
import { prisma } from '../../../lib/prisma.js';
import { formatClinicMoney, resolveClinicCurrency } from '../lib/currency.js';
import {
  DEFAULT_CLINIC_TZ,
  resolveTimeZone,
  timeGreetingInTz,
  zonedDayRange,
} from '../lib/timezone.js';

export type BriefingRole =
  | 'owner'
  | 'director'
  | 'admin'
  | 'doctor'
  | 'assistant'
  | 'reception'
  | 'buyer'
  | 'staff'
  | 'guest';

export interface JarvisBriefingResult {
  message: string;
  suggestions: string[];
  payload: Record<string, unknown>;
  role: BriefingRole;
}

function normalizeRole(role?: string | null): BriefingRole {
  const r = String(role || '').toLowerCase();
  if (r === 'owner' || r === 'руководитель' || r === 'director' || r === 'директор') {
    return r.includes('direct') || r === 'директор' ? 'director' : 'owner';
  }
  if (r === 'admin' || r === 'администратор' || r === 'cashier' || r === 'касса') return 'admin';
  if (r === 'doctor' || r === 'врач') return 'doctor';
  if (r === 'assistant' || r === 'ассистент') return 'assistant';
  if (r === 'reception' || r === 'ресепшн') return 'reception';
  if (r === 'buyer' || r === 'закуп' || r === 'manager' || r === 'менеджер') return 'buyer';
  if (r === 'guest' || r === 'гость') return 'guest';
  return 'staff';
}

function firstName(name?: string | null, fallback = 'коллега'): string {
  const n = String(name || '').trim();
  if (!n) return fallback;
  return n.split(/\s+/)[0];
}

/** Role → which alert categories to keep (priority filter). */
export function alertCategoriesForRole(role?: string | null): Set<string> | null {
  const r = normalizeRole(role);
  if (r === 'guest') return new Set(['product']);
  if (r === 'owner' || r === 'director') {
    return new Set(['billing', 'appointments', 'stock', 'school', 'inbox', 'wallet']);
  }
  if (r === 'admin' || r === 'reception') {
    return new Set(['appointments', 'billing', 'inbox']);
  }
  if (r === 'doctor' || r === 'assistant') {
    return new Set(['appointments', 'school', 'inbox']);
  }
  if (r === 'buyer') {
    return new Set(['stock', 'wallet', 'billing', 'inbox']);
  }
  return null; // all
}

export function filterAlertsForRole<T extends { category?: string; type?: string }>(
  alerts: T[],
  role?: string | null,
): T[] {
  const allowed = alertCategoriesForRole(role);
  if (!allowed) return alerts;
  return alerts.filter((a) => allowed.has(String(a.category || a.type || '')));
}

export async function buildJarvisBriefing(opts: {
  userId: string;
  clinicId?: string | null;
  role?: string | null;
  firstName?: string | null;
  clinicName?: string | null;
  isGuest?: boolean;
  /** Prefer browser/client IANA zone when provided. */
  timeZone?: string | null;
}): Promise<JarvisBriefingResult> {
  const role = normalizeRole(opts.isGuest ? 'guest' : opts.role);
  const name = firstName(opts.firstName);

  let clinicTz: string | null = null;
  if (opts.clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: opts.clinicId },
      select: { settings: true },
    });
    const settings = (clinic?.settings || {}) as { timezone?: string };
    clinicTz = settings.timezone || null;
  }
  // User device zone first, then clinic settings, then KZ default.
  const timeZone = resolveTimeZone(opts.timeZone, clinicTz, DEFAULT_CLINIC_TZ);

  const greet = timeGreetingInTz(new Date(), timeZone);
  const { start: dayStart, end: dayEnd, dateLabel } = zonedDayRange(timeZone);

  if (role === 'guest' || !opts.clinicId) {
    return {
      role,
      message: [
        `${greet}, ${name}. Я — DentVision Intelligence.`,
        '',
        'На связи как операционный ИИ: после входа держу руку на пульсе расписания, кассы и склада.',
        'Пока могу провести по платформе или открыть демо-клинику.',
        '',
        'Готов начинать, когда скажете.',
      ].join('\n'),
      suggestions: ['Чем полезен DentVision?', 'Открыть демо-клинику', 'Что в Academy OS?'],
      payload: { mode: 'guest', timeZone },
    };
  }

  const clinicId = opts.clinicId;
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  // Previous calendar day in the clinic timezone
  const yParts = (() => {
    const prev = new Date(dayStart.getTime() - 12 * 60 * 60 * 1000);
    return zonedDayRange(timeZone, prev);
  })();
  const yesterdayStart = yParts.start;
  const yesterdayEnd = yParts.end;

  const doctorScoped = role === 'doctor' || role === 'assistant';

  const [
    apptsToday,
    myApptsToday,
    upcomingSoon,
    pendingConfirm,
    unpaidInvoices,
    paidYesterday,
    lowStock,
    unreadNotifs,
    courses,
    dentCashWallet,
    nextAppt,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { clinicId, date: { gte: dayStart, lte: dayEnd } },
    }),
    doctorScoped
      ? prisma.appointment.count({
          where: {
            clinicId,
            doctorId: opts.userId,
            date: { gte: dayStart, lte: dayEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: now, lte: in2h },
        status: { in: ['CONFIRMED', 'PENDING'] },
        ...(doctorScoped ? { doctorId: opts.userId } : {}),
      },
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: dayStart, lte: dayEnd },
        status: 'PENDING',
      },
    }),
    prisma.invoice.findMany({
      where: { clinicId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      select: { amount: true, status: true },
      take: 200,
    }),
    prisma.invoice.findMany({
      where: {
        clinicId,
        status: 'PAID',
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
      select: { amount: true },
    }),
    prisma.inventoryItem
      .count({ where: { clinicId, quantity: { lte: 5 } } })
      .catch(() => 0),
    prisma.notification.count({ where: { userId: opts.userId, read: false } }),
    prisma.schoolEnrollment.count({
      where: { userId: opts.userId, completed: false, progress: { lt: 100 } },
    }),
    prisma.wallet
      .findUnique({
        where: {
          ownerType_ownerId_currency: {
            ownerType: 'USER',
            ownerId: opts.userId,
            currency: 'KZT',
          },
        },
      })
      .catch(() => null),
    doctorScoped
      ? prisma.appointment.findFirst({
          where: {
            clinicId,
            doctorId: opts.userId,
            date: { gte: now, lte: dayEnd },
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          orderBy: { date: 'asc' },
          include: { patient: { select: { firstName: true, lastName: true } } },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const inChair = 0;

  const debtTotal = unpaidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const overdueCount = unpaidInvoices.filter((i) => i.status === 'OVERDUE').length;
  const revenueYesterday = paidYesterday.reduce((s, i) => s + Number(i.amount || 0), 0);
  const money = await resolveClinicCurrency(clinicId);
  const fmt = (n: number) => formatClinicMoney(n, money);
  const dentCash = dentCashWallet?.balance != null ? Number(dentCashWallet.balance) / 100 : 0;

  const clinicLine = opts.clinicName ? ` · ${opts.clinicName}` : '';
  const header = [
    `${greet}, ${name}. Системы на связи.`,
    `**${dateLabel}**${clinicLine}`,
    '',
  ];

  const lines: string[] = [];
  const suggestions: string[] = [];

  if (role === 'owner' || role === 'director') {
    lines.push(`• Расписание сегодня: **${apptsToday}** записей`);
    if (upcomingSoon > 0) lines.push(`• В ближайшие 2 часа: **${upcomingSoon}**`);
    if (pendingConfirm > 0) lines.push(`• Ждут подтверждения: **${pendingConfirm}**`);
    lines.push(`• Выручка вчера: **${fmt(revenueYesterday)}**`);
    lines.push(
      unpaidInvoices.length
        ? `• Дебиторка: **${unpaidInvoices.length}** счетов · **${fmt(debtTotal)}**${overdueCount ? ` (просрочено ${overdueCount})` : ''}`
        : '• Дебиторка: чисто — должников нет',
    );
    if (lowStock > 0) lines.push(`• Склад: **${lowStock}** позиций с низким остатком`);
    if (dentCash >= 1000) {
      lines.push(`• DentCash: **${Math.round(dentCash).toLocaleString('ru-KZ')} ₸** к списанию`);
    }
    suggestions.push(
      unpaidInvoices.length ? 'Проверить долги' : 'Показать выручку',
      'Показать расписание',
      lowStock > 0 ? 'Что на складе' : 'Что важно сегодня?',
    );
  } else if (role === 'admin' || role === 'reception') {
    lines.push(`• Записей сегодня: **${apptsToday}**`);
    if (pendingConfirm > 0) {
      lines.push(`• ⚠ Неподтверждённых: **${pendingConfirm}** — лучше закрыть до обеда`);
    } else {
      lines.push('• Все записи подтверждены — порядок');
    }
    if (upcomingSoon > 0) lines.push(`• Через ≤2 часа: **${upcomingSoon}** приёмов`);
    if (unpaidInvoices.length > 0) {
      lines.push(`• Касса: **${unpaidInvoices.length}** неоплаченных · **${fmt(debtTotal)}**`);
    }
    if (unreadNotifs > 0) lines.push(`• Уведомлений: **${unreadNotifs}**`);
    suggestions.push(
      pendingConfirm > 0 ? 'Показать расписание' : 'Записать пациента',
      'Открыть кассу',
      'Показать расписание',
    );
  } else if (role === 'doctor' || role === 'assistant') {
    lines.push(`• Ваших приёмов сегодня: **${myApptsToday || apptsToday}**`);
    if (inChair > 0) lines.push(`• Сейчас в кресле: **${inChair}**`);
    if (upcomingSoon > 0) lines.push(`• Ближайшие 2 часа: **${upcomingSoon}**`);
    if (nextAppt?.patient) {
      const t = nextAppt.date
        ? new Date(nextAppt.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : '';
      const pn = `${nextAppt.patient.firstName || ''} ${nextAppt.patient.lastName || ''}`.trim();
      lines.push(`• Следующий: **${pn}**${t ? ` в ${t}` : ''}`);
    }
    if (courses > 0) lines.push(`• Academy: **${courses}** курс(ов) в процессе`);
    if (!lines.length) lines.push('• На сегодня свободный день — можно закрыть планы лечения или курс');
    suggestions.push('Показать расписание', 'Открыть зубную карту', 'Создать план лечения');
  } else if (role === 'buyer') {
    lines.push(lowStock > 0
      ? `• Склад требует внимания: **${lowStock}** позиций ≤5 ед.`
      : '• Склад в норме — критичных остатков нет');
    if (dentCash >= 1000) {
      lines.push(`• DentCash: **${Math.round(dentCash).toLocaleString('ru-KZ')} ₸** — можно списать в маркете`);
    }
    if (unpaidInvoices.length > 0) {
      lines.push(`• По клинике висят оплаты: **${unpaidInvoices.length}** (для сверки с закупками)`);
    }
    suggestions.push('Что на складе', 'Открыть маркетплейс', 'Показать заказы');
  } else {
    lines.push(`• Записей сегодня: **${apptsToday}**`);
    if (upcomingSoon > 0) lines.push(`• Ближайшие 2 часа: **${upcomingSoon}**`);
    if (unpaidInvoices.length > 0) lines.push(`• Неоплаченных счетов: **${unpaidInvoices.length}**`);
    if (lowStock > 0) lines.push(`• Низкий остаток: **${lowStock}**`);
    suggestions.push('Показать расписание', 'Что важно сегодня?', 'Проверить долги');
  }

  if (unreadNotifs > 0 && role !== 'admin' && role !== 'reception') {
    lines.push(`• Непрочитанных уведомлений: **${unreadNotifs}**`);
  }

  const closing =
    role === 'owner' || role === 'director'
      ? 'Я на пульсе клиники. Скажите, с чего начать — или выберите действие ниже.'
      : role === 'doctor'
        ? 'Готов вести приём с вами: карта, план, расписание — одной фразой.'
        : 'Готов выполнить команду. Что делаем первым?';

  return {
    role,
    message: [...header, ...lines, '', closing].join('\n'),
    suggestions: suggestions.slice(0, 3),
    payload: {
      timeZone,
      apptsToday,
      myApptsToday,
      upcomingSoon,
      pendingConfirm,
      inChair,
      debtors: unpaidInvoices.length,
      debtTotal,
      revenueYesterday,
      lowStock,
      unreadNotifs,
      courses,
      dentCash,
    },
  };
}
