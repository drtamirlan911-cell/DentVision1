/**
 * Что клиника уже знает о себе — фактура для контента.
 *
 * Собирается детерминированно, без обращения к модели: услуги, которые в
 * клинике действительно делают, её собственные цены, живые акции, месяцы
 * загрузки и простоя, частые диагнозы, состав врачей.
 *
 * Смысл в том, чтобы модель не выдумывала клинику. Пост «приходите на
 * профгигиену» одинаково подходит кому угодно; пост «в феврале у вас
 * проседает запись, а профгигиена — вторая по частоте услуга» опирается на
 * то, что в базе уже лежит. Поэтому сбор идёт первым и отдельно: его
 * результат проверяем глазами, он воспроизводим и ничего не стоит.
 */

import prisma from '../../lib/prisma.js';
import { parseMeta } from '../crm/appointmentMeta.js';

/** Сколько дней назад смотрим на приёмы. Полгода — сезон плюс запас. */
const LOOKBACK_DAYS = 180;
const SEASON_MONTHS = 12;

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

/**
 * Русское склонение числительного: 1 приём, 2 приёма, 5 приёмов.
 *
 * Нужно потому, что этот текст идёт прямо в пост клиники. «1 приёмов» в
 * подписи читается как небрежность и обесценивает всё остальное.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

export interface ServiceFact {
  name: string;
  /** Сколько раз услугу делали за период. */
  count: number;
  /** Средний чек по этой услуге, ₸. */
  averagePrice: number;
}

export interface PromotionFact {
  title: string;
  description: string | null;
  discountPercent: number;
  endsAt: string | null;
}

export interface SeasonFact {
  month: string;
  appointments: number;
}

export interface MarketingContext {
  clinicName: string;
  city: string | null;
  /** Услуги, которые в клинике действительно делают, по убыванию частоты. */
  topServices: ServiceFact[];
  /** Услуги прайса, которых за период не было ни разу — кандидаты на продвижение. */
  neglectedServices: string[];
  activePromotions: PromotionFact[];
  /** Месяцы по загрузке: самый занятой и самый пустой. */
  busiestMonth: SeasonFact | null;
  quietestMonth: SeasonFact | null;
  /** Частые диагнозы: код МКБ-10 и сколько раз встретился. */
  frequentDiagnoses: Array<{ code: string; count: number }>;
  doctorCount: number;
  /** Приёмов за период — чтобы понимать, на чём вообще построена статистика. */
  appointmentsAnalysed: number;
}

/** Код МКБ-10 из свободного текста диагноза («K02.1 — Кариес дентина»). */
function icdCode(raw: unknown): string | null {
  const m = String(raw || '').match(/(?:^|[^A-Za-z0-9.])([A-Z]\d{2}(?:\.\d{1,2})?)/);
  return m ? m[1].toUpperCase() : null;
}

export async function buildMarketingContext(clinicId: string): Promise<MarketingContext> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const seasonSince = new Date(Date.now() - SEASON_MONTHS * 30 * 86_400_000);

  const [clinic, closed, seasonRows, promotions, priceList, doctorCount] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true, city: true } }),
    prisma.appointment.findMany({
      where: { clinicId, status: 'completed', date: { gte: since } },
      select: { meta: true },
      take: 2000,
    }),
    prisma.appointment.findMany({
      where: { clinicId, date: { gte: seasonSince } },
      select: { date: true },
      take: 5000,
    }),
    prisma.promotion.findMany({
      where: {
        clinicId,
        active: true,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      select: { title: true, description: true, discountPercent: true, endDate: true },
      take: 10,
    }),
    prisma.priceListItem.findMany({
      where: { clinicId, active: true },
      select: { name: true, serviceCode: true },
      take: 200,
    }),
    // Состав клиники живёт в ClinicMember: у User поля clinicId нет —
    // один врач может работать в нескольких клиниках.
    prisma.clinicMember.count({ where: { clinicId, role: 'DOCTOR' } }),
  ]);

  // --- услуги: частота и средний чек ---
  const byService = new Map<string, { count: number; total: number }>();
  const diagnoses = new Map<string, number>();

  for (const row of closed) {
    const meta = parseMeta(row.meta);
    for (const line of meta.services || []) {
      const name = String((line as { name?: string }).name || '').trim();
      if (!name || name === 'Услуга') continue;
      const price = Number((line as { price?: number }).price) || 0;
      const acc = byService.get(name) || { count: 0, total: 0 };
      acc.count += 1;
      acc.total += price;
      byService.set(name, acc);
    }
    const code = icdCode(meta.diagnosis);
    if (code) diagnoses.set(code, (diagnoses.get(code) || 0) + 1);
  }

  const topServices: ServiceFact[] = [...byService.entries()]
    .map(([name, a]) => ({ name, count: a.count, averagePrice: Math.round(a.total / a.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const performed = new Set(topServices.map((s) => s.name.toLowerCase()));
  const neglectedServices = priceList
    .map((p) => String(p.name || p.serviceCode))
    .filter((n) => n && !performed.has(n.toLowerCase()))
    .slice(0, 10);

  // --- сезонность: приёмы по месяцам ---
  const byMonth = new Map<number, number>();
  for (const row of seasonRows) {
    const m = new Date(row.date).getMonth();
    byMonth.set(m, (byMonth.get(m) || 0) + 1);
  }
  const season: SeasonFact[] = [...byMonth.entries()]
    .map(([m, appointments]) => ({ month: MONTHS_RU[m], appointments }))
    .sort((a, b) => b.appointments - a.appointments);

  return {
    clinicName: clinic?.name || 'Клиника',
    city: clinic?.city || null,
    topServices,
    neglectedServices,
    activePromotions: promotions.map((p) => ({
      title: p.title,
      description: p.description,
      discountPercent: Number(p.discountPercent) || 0,
      endsAt: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
    })),
    busiestMonth: season[0] || null,
    // Самый пустой месяц берём только когда данных хватает на сравнение:
    // на двух месяцах «просадка» — это не сезонность, а отсутствие истории.
    quietestMonth: season.length >= 3 ? season[season.length - 1] : null,
    frequentDiagnoses: [...diagnoses.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    doctorCount,
    appointmentsAnalysed: closed.length,
  };
}

/** Компактное человекочитаемое изложение фактов — оно же уходит в промпт. */
export function describeContext(ctx: MarketingContext): string {
  const lines: string[] = [`Клиника «${ctx.clinicName}»${ctx.city ? `, ${ctx.city}` : ''}.`];

  if (ctx.topServices.length) {
    lines.push('Чаще всего делают: ' + ctx.topServices
      .map((s) => `${s.name} (${s.count} ${plural(s.count, 'раз', 'раза', 'раз')}, средний чек ${s.averagePrice} ₸)`)
      .join('; ') + '.');
  } else {
    lines.push('Закрытых приёмов за полгода нет — статистики по услугам пока не набралось.');
  }

  if (ctx.neglectedServices.length) {
    lines.push('Есть в прайсе, но за полгода ни разу не делали: ' + ctx.neglectedServices.join(', ') + '.');
  }
  if (ctx.activePromotions.length) {
    lines.push('Действующие акции: ' + ctx.activePromotions
      .map((p) => `${p.title}${p.discountPercent ? ` (−${p.discountPercent}%)` : ''}${p.endsAt ? `, до ${p.endsAt}` : ''}`)
      .join('; ') + '.');
  }
  if (ctx.busiestMonth && ctx.quietestMonth) {
    lines.push(`Загрузка по месяцам: пик — ${ctx.busiestMonth.month} (${ctx.busiestMonth.appointments} приёмов), спад — ${ctx.quietestMonth.month} (${ctx.quietestMonth.appointments}).`);
  }
  if (ctx.frequentDiagnoses.length) {
    lines.push('Частые диагнозы: ' + ctx.frequentDiagnoses.map((d) => `${d.code} (${d.count})`).join(', ') + '.');
  }
  lines.push(`Врачей в клинике: ${ctx.doctorCount}. Проанализировано приёмов: ${ctx.appointmentsAnalysed}.`);
  return lines.join('\n');
}
