/**
 * AI CEO brief — Spec §16 P1.
 * Synthesizes Analyst + Finance + Marketing/load signals into an executive brief.
 * Does NOT bypass RBAC: only uses the same clinic-scoped reads as Jarvis briefing.
 */

import prisma from '../../../lib/prisma.js';
import { buildJarvisBriefing } from './jarvisBriefing.js';
import { buildClinicLoadSignals } from './clinicLoadPlan.js';

export interface CeoBriefResult {
  message: string;
  suggestions: string[];
  payload: Record<string, unknown>;
}

function money(n: number): string {
  return Math.round(n).toLocaleString('ru-RU');
}

async function monthRevenue(clinicId: string): Promise<{ total: number; count: number }> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const invoices = await prisma.invoice.findMany({
    where: { clinicId, status: 'PAID', createdAt: { gte: from } },
    select: { amount: true },
  });
  return {
    total: invoices.reduce((s, i) => s + i.amount, 0),
    count: invoices.length,
  };
}

async function debtSnapshot(clinicId: string): Promise<{ total: number; count: number }> {
  const invoices = await prisma.invoice.findMany({
    where: { clinicId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
    select: { amount: true },
    take: 200,
  });
  return {
    total: invoices.reduce((s, i) => s + i.amount, 0),
    count: invoices.length,
  };
}

async function promotionsSnapshot(clinicId: string): Promise<{ active: number; titles: string[] }> {
  const rows = await prisma.promotion.findMany({
    where: { clinicId, active: true },
    select: { title: true },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  return { active: rows.length, titles: rows.map((r) => r.title) };
}

export async function composeCeoBrief(opts: {
  userId: string;
  clinicId: string | null;
  role: string;
  firstName?: string | null;
  clinicName?: string | null;
  timeZone?: string | null;
}): Promise<CeoBriefResult> {
  const name = (opts.firstName || 'Коллега').split(' ')[0];
  const clinicLabel = opts.clinicName || 'клиника';

  if (!opts.clinicId) {
    return {
      message: `${name}, для CEO-брифа нужна активная клиника. Выберите workspace.`,
      suggestions: ['Открыть мои клиники', 'Что умеет DentVision?'],
      payload: { persona: 'ceo', empty: true },
    };
  }

  const [briefing, revenue, debts, promos, loadSignals] = await Promise.all([
    buildJarvisBriefing({
      userId: opts.userId,
      clinicId: opts.clinicId,
      role: opts.role,
      firstName: opts.firstName || undefined,
      clinicName: opts.clinicName || undefined,
      isGuest: false,
      timeZone: opts.timeZone,
    }).catch(() => null),
    monthRevenue(opts.clinicId).catch(() => ({ total: 0, count: 0 })),
    debtSnapshot(opts.clinicId).catch(() => ({ total: 0, count: 0 })),
    promotionsSnapshot(opts.clinicId).catch(() => ({ active: 0, titles: [] as string[] })),
    buildClinicLoadSignals(opts.clinicId).catch(() => null),
  ]);

  const loadTotals = (loadSignals?.payload?.totals || {}) as {
    recall?: number;
    weakDays?: number;
    openPlans?: number;
  };

  const priorities: string[] = [];
  if (debts.count > 0) {
    priorities.push(
      `**Финансы:** дебиторка **${money(debts.total)}** (${debts.count} счетов) — закрыть топ должников.`,
    );
  }
  if (loadTotals.recall && loadTotals.recall > 0) {
    priorities.push(
      `**Маркетинг / Reception:** **${loadTotals.recall}** пациентов на recall — реактивация базы.`,
    );
  }
  if (loadTotals.weakDays && loadTotals.weakDays > 0) {
    priorities.push(
      `**Reception:** **${loadTotals.weakDays}** слабых дня в расписании — заполнить окна.`,
    );
  }
  if (promos.active === 0) {
    priorities.push('**Маркетинг:** нет активных акций — черновик промо под recall.');
  } else {
    priorities.push(
      `**Маркетинг:** активных акций **${promos.active}**${promos.titles[0] ? ` («${promos.titles[0]}»)` : ''}.`,
    );
  }
  priorities.push(
    `**Аналитика:** выручка месяца **${money(revenue.total)}** (${revenue.count} оплат).`,
  );

  const lines = [
    `### CEO-бриф · ${clinicLabel}`,
    `${name}, вот что важно сейчас (синтез Analyst + Finance + Marketing):`,
    '',
    ...priorities.map((p, i) => `${i + 1}. ${p}`),
  ];

  if (briefing?.message) {
    lines.push('', '---', '_Контекст Jarvis:_', briefing.message.split('\n').slice(0, 8).join('\n'));
  }

  lines.push('', 'Дальше: долги · recall-список · акции · расписание.');

  return {
    message: lines.join('\n'),
    suggestions: ['Кого бить по долгам', 'Список recall', 'Активные акции', 'План загрузки'],
    payload: {
      persona: 'ceo',
      revenue,
      debts,
      promotions: promos,
      load: loadTotals,
      fromBriefing: Boolean(briefing),
    },
  };
}
