/**
 * Zero-LLM shortcuts — navigate / simple KPI queries answered without OpenAI.
 * Keeps Jarvis economical while feeling instant and free across the platform.
 */

import prisma from '../../../lib/prisma.js';
import {
  normalizeNavSection,
  NAV_PATHS,
  resolveSection,
  stageAwareSuggestions,
  availableSectionsData,
} from './platformMap.js';

export type ShortcutResult = {
  message: string;
  intent: string;
  action?: { type: string; payload: unknown };
  suggestions: string[];
  toolsUsed: string[];
};

function openActionForPath(path: string): string {
  const section = Object.entries(NAV_PATHS).find(([, p]) => p === path)?.[0];
  if (!section) return 'NAVIGATE';
  const map: Record<string, string> = {
    schedule: 'OpenSchedule',
    patients: 'OpenPatients',
    finance: 'OpenFinance',
    inventory: 'OpenInventory',
    documents: 'OpenDocuments',
    lab: 'OpenLab',
    reminders: 'OpenReminders',
    'dental-chart': 'OpenDentalChart',
    'treatment-plans': 'OpenTreatmentPlans',
    visits: 'OpenVisits',
    staff: 'OpenStaff',
    shop: 'OpenShop',
    school: 'OpenSchool',
    analytics: 'OpenAnalytics',
    settings: 'OpenSettings',
    profile: 'OpenProfile',
    demo: 'OpenDemo',
    pricing: 'OpenPricing',
    jobs: 'OpenJobs',
    community: 'OpenCommunity',
    'medical-card': 'OpenMedicalCard',
    pricelist: 'OpenPriceList',
    promotions: 'OpenPromotions',
    icd10: 'OpenICD10',
    'clinic-settings': 'OpenClinicSettings',
    billing: 'OpenBilling',
    supplier: 'OpenSupplier',
    'school-workspace': 'OpenSchoolWorkspace',
    'my-clinics': 'OpenMyClinics',
    admin: 'OpenAdmin',
    audit: 'OpenAudit',
    backup: 'OpenBackup',
  };
  return map[section] || 'NAVIGATE';
}

/** «Открой склад / покажи расписание / перейди в маркет» — no LLM. */
export function tryDeterministicNavigate(
  text: string,
  opts: { role: string; isGuest?: boolean },
): ShortcutResult | null {
  const t = String(text || '').trim();
  if (!t || t.length > 120) return null;

  const openMatch = t.match(
    /^(?:открой|открыть|перейди|перейти|покажи раздел|зайди в|зайди|go to|open)\s+(.+?)\s*$/i,
  );
  // Also: «покажи X» when X is a known section (not KPIs)
  const showMatch = !openMatch
    ? t.match(/^(?:покажи)\s+(.+?)\s*$/i)
    : null;
  const rawTarget = (openMatch || showMatch)?.[1];
  if (!rawTarget) return null;

  let target = rawTarget.replace(/[?.!]+$/g, '').trim();
  target = target.replace(/^(пожалуйста|мне|раздел)\s+/i, '').trim();

  // Don't steal KPI phrases
  if (/^(выручк|долг|дебитор|кто сегодня|что на складе|загрузк)/i.test(target)) return null;

  const section = resolveSection(target) || resolveSection(normalizeNavSection(target));
  if (!section) {
    if (/карт[аеу].*сервис|все разделы|что умеешь|что можешь|справк/i.test(target)) {
      const list = availableSectionsData(opts.role, opts.isGuest)
        .map((s) => `• ${s.label}`)
        .join('\n');
      return {
        message: `Вот карта сервисов, доступных вам:\n${list}\n\nСкажите «открой …» — перейду сразу.`,
        intent: 'PLATFORM_MAP',
        suggestions: stageAwareSuggestions({ role: opts.role, isGuest: opts.isGuest, stage: 'workspace' }),
        toolsUsed: ['platform_map'],
      };
    }
    return null;
  }

  const actionType = openActionForPath(section.path);
  return {
    message: `Открываю **${section.label}** — ${section.blurb}.`,
    intent: 'NAVIGATE',
    action: { type: actionType, payload: { path: section.path, section: section.key } },
    suggestions: stageAwareSuggestions({
      role: opts.role,
      isGuest: opts.isGuest,
      stage: section.key,
    }),
    toolsUsed: ['navigate_fast'],
  };
}

/** Simple KPI phrases answered with one DB round-trip — no LLM. */
export async function tryDeterministicStats(
  text: string,
  opts: { userId: string; clinicId: string | null; role: string; isGuest?: boolean },
): Promise<ShortcutResult | null> {
  if (opts.isGuest || !opts.clinicId) return null;
  const t = String(text || '').trim().toLowerCase();
  if (!t || t.length > 100) return null;

  const wantsRevenue = /^(покажи|какая|сколько)?\s*(выручк|доход|оборот)/i.test(t)
    || /выручк[аиуе]\s*(сегодня|за\s+день|за\s+месяц)?\s*[?.!]*$/i.test(t);
  const wantsDebt = /^(проверь|покажи|сколько)?\s*(долг|дебитор)/i.test(t)
    || /должник/i.test(t);
  const wantsSchedule = /^(покажи|кто)\s*(расписан|сегодня|на\s+при[её]ме)/i.test(t)
    || /^расписание(\s+сегодня)?\s*[?.!]*$/i.test(t)
    || /^покажи\s+расписание\s*[?.!]*$/i.test(t);
  const wantsStock = /^(что\s+на\s+складе|склад|что\s+заканчивается|низкий\s+остаток)/i.test(t);

  if (!wantsRevenue && !wantsDebt && !wantsSchedule && !wantsStock) return null;

  const clinicId = opts.clinicId;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (wantsSchedule) {
    const appts = await prisma.appointment.findMany({
      where: { clinicId, date: { gte: start, lt: end }, status: { notIn: ['cancelled', 'no_show'] } },
      take: 40,
      orderBy: { time: 'asc' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    const lines = appts.slice(0, 12).map((a) => {
      const name = a.patient
        ? `${a.patient.firstName || ''} ${a.patient.lastName || ''}`.trim()
        : 'Пациент';
      return `• ${a.time || '—'} — ${name} (${a.status})`;
    });
    const message = appts.length
      ? `Сегодня в расписании **${appts.length}** записей:\n${lines.join('\n')}${appts.length > 12 ? '\n…' : ''}`
      : 'На сегодня записей нет — можно заполнить слоты или лист ожидания.';
    return {
      message,
      intent: 'SHOW_SCHEDULE',
      action: { type: 'OpenSchedule', payload: { path: '/crm/schedule' } },
      suggestions: ['Записать пациента', 'Лист ожидания', 'Что важно сегодня?'],
      toolsUsed: ['stats_schedule'],
    };
  }

  if (wantsDebt) {
    const unpaid = await prisma.invoice.findMany({
      where: { clinicId, status: { in: ['unpaid', 'partial', 'overdue'] } },
      take: 50,
      select: { amount: true, status: true },
    });
    const total = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0);
    const message = unpaid.length
      ? `Должников/неоплаченных: **${unpaid.length}**, сумма ≈ **${Math.round(total).toLocaleString('ru-KZ')}**. Откройте кассу, чтобы закрыть.`
      : 'Дебиторка чистая — неоплаченных счетов нет.';
    return {
      message,
      intent: 'SHOW_DEBTORS',
      action: { type: 'OpenFinance', payload: { path: '/crm/finance' } },
      suggestions: ['Открыть кассу', 'Показать выручку', 'Что важно сегодня?'],
      toolsUsed: ['stats_debtors'],
    };
  }

  if (wantsRevenue) {
    const paid = await prisma.invoice.findMany({
      where: {
        clinicId,
        status: 'paid',
        OR: [
          { paidAt: { gte: start, lt: end } },
          { paidAt: null, updatedAt: { gte: start, lt: end } },
        ],
      },
      select: { amount: true },
    });
    const total = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
    return {
      message: `Выручка за сегодня (оплаченные счета): **${Math.round(total).toLocaleString('ru-KZ')}** · чеков: **${paid.length}**.`,
      intent: 'SHOW_REVENUE',
      action: { type: 'OpenAnalytics', payload: { path: '/analytics' } },
      suggestions: ['Проверить долги', 'Загрузка врачей', 'Что важно сегодня?'],
      toolsUsed: ['stats_revenue'],
    };
  }

  if (wantsStock) {
    const items = await prisma.inventoryItem.findMany({
      where: { clinicId },
      take: 200,
      select: { name: true, quantity: true, minimum: true },
    });
    const low = items.filter((i) => {
      const q = Number(i.quantity ?? 0);
      const min = Number(i.minimum ?? 0);
      return min > 0 ? q <= min : q <= 0;
    });
    const names = low.slice(0, 8).map((i) => i.name).filter(Boolean);
    const message = low.length
      ? `На складе клиники **${low.length}** позиций ниже минимума${names.length ? `: ${names.join(', ')}` : ''}. Могу подобрать аналоги в маркетплейсе.`
      : 'Склад в норме — критичных остатков нет.';
    return {
      message,
      intent: 'SHOW_INVENTORY',
      action: { type: 'OpenInventory', payload: { path: '/crm/inventory' } },
      suggestions: ['Открыть маркетплейс', 'Открыть склад', 'Что важно сегодня?'],
      toolsUsed: ['stats_inventory'],
    };
  }

  return null;
}

/** «Карта сервисов / что умеешь» without open prefix. */
export function tryPlatformMapQuery(
  text: string,
  opts: { role: string; isGuest?: boolean },
): ShortcutResult | null {
  const t = String(text || '').trim().toLowerCase();
  if (!/(карт[аеу]\s+сервис|все\s+разделы|что\s+(ты\s+)?умеешь|что\s+можешь|справка\s+по\s+платформ|гид\s+по\s+dentvision)/i.test(t)) {
    return null;
  }
  const list = availableSectionsData(opts.role, opts.isGuest)
    .map((s) => `• **${s.label}** — скажите «открой ${s.label.toLowerCase()}»`)
    .join('\n');
  return {
    message: `Я веду по всей платформе DentVision. Доступно вам:\n${list}`,
    intent: 'PLATFORM_MAP',
    suggestions: stageAwareSuggestions({ role: opts.role, isGuest: opts.isGuest, stage: 'workspace' }),
    toolsUsed: ['platform_map'],
  };
}
