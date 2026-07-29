/**
 * Clinic load ops — concrete recall / open plans / schedule gaps from live data.
 * Used by getClinicLoadPlan tool and deterministic orchestrator answers.
 */
import prisma from '../../../lib/prisma.js';

const OPEN_PLAN_STATUSES = [
  'proposed',
  'accepted',
  'in_progress',
  'active',
] as const;

/** Typical chair hours; lunch 13:00 skipped. */
const WORK_HOURS = [9, 10, 11, 12, 14, 15, 16, 17];

/** Day is "weak" if underbooked relative to capacity. */
const WEAK_BOOKED_MAX = 3;
const WEAK_EMPTY_MIN = 4;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar YYYY-MM-DD (avoid UTC drift from toISOString). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function weekdayRu(d: Date): string {
  return d.toLocaleDateString('ru-RU', { weekday: 'short' });
}

function parseHour(time?: string | null): number | null {
  if (!time) return null;
  const m = String(time).match(/^(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isWeakDay(booked: number, emptyHours: number): boolean {
  return booked <= WEAK_BOOKED_MAX || emptyHours >= WEAK_EMPTY_MIN;
}

export interface ClinicLoadPlanResult {
  message: string;
  suggestions: string[];
  payload: Record<string, unknown>;
}

export async function buildClinicLoadPlan(
  clinicId: string,
  options: { days?: number; inactiveDays?: number } = {},
): Promise<ClinicLoadPlanResult> {
  const days = Math.min(Math.max(Number(options.days) || 7, 3), 14);
  const inactiveDays = Math.min(Math.max(Number(options.inactiveDays) || 90, 30), 365);

  const now = new Date();
  const startToday = startOfLocalDay(now);
  const currentHour = now.getHours();
  const endHorizon = new Date(startToday);
  endHorizon.setDate(endHorizon.getDate() + days);

  const [patients, lastVisitRows, horizonAppointments, plans, members] = await Promise.all([
    prisma.patient.findMany({
      where: { clinicId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take: 800,
      orderBy: { updatedAt: 'desc' },
    }),
    // True last PAST visit — future bookings must not hide inactive patients from recall.
    prisma.appointment.groupBy({
      by: ['patientId'],
      where: {
        clinicId,
        date: { lt: startToday },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      _max: { date: true },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: startToday, lt: endHorizon },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        date: true,
        time: true,
        status: true,
        type: true,
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 2000,
    }),
    prisma.treatmentPlan.findMany({
      where: {
        patient: { clinicId },
        status: { in: [...OPEN_PLAN_STATUSES] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    }),
    prisma.clinicMember.findMany({
      where: { clinicId, role: { in: ['DOCTOR', 'OWNER', 'ADMIN', 'MANAGER'] } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      take: 30,
    }),
  ]);

  const lastByPatient = new Map<string, Date>();
  for (const row of lastVisitRows) {
    const d = row._max.date;
    if (d) lastByPatient.set(row.patientId, d);
  }

  const openPlanPatientIds = new Set(plans.map((p) => p.patientId));
  // Patients already booked in the horizon — deprioritize / skip soft recall noise.
  const bookedSoon = new Set(horizonAppointments.map((a) => a.patientId));

  const recall = patients
    .map((p) => {
      if (bookedSoon.has(p.id) && !openPlanPatientIds.has(p.id)) return null;
      const last = lastByPatient.get(p.id);
      const daysSince = last
        ? Math.floor((startToday.getTime() - last.getTime()) / 86400000)
        : 9999;
      if (daysSince < inactiveDays && !openPlanPatientIds.has(p.id)) return null;
      // Active visitors with open plans still deserve a nudge only if inactive-ish
      // or never visited; otherwise open-plans section covers them.
      if (daysSince < inactiveDays && openPlanPatientIds.has(p.id)) return null;

      const hasOpenPlan = openPlanPatientIds.has(p.id);
      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
        phone: p.phone || null,
        daysSince: daysSince === 9999 ? null : daysSince,
        lastVisit: last ? dayKey(last) : null,
        reason: hasOpenPlan ? 'open_plan' : last ? 'inactive' : 'never_visited',
        priority: hasOpenPlan ? 0 : daysSince === 9999 ? 2 : 1,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.priority - b.priority || (b.daysSince || 0) - (a.daysSince || 0))
    .slice(0, 12);

  const openPlans = plans.slice(0, 12).map((p) => {
    const items = (p.items && typeof p.items === 'object' ? p.items : {}) as Record<string, any>;
    const stages = Array.isArray(items.stages) ? items.stages : [];
    const next = stages.find(
      (s: any) => !['done', 'completed', 'DONE', 'completed'].includes(String(s.status || '')),
    );
    return {
      planId: p.id,
      title: p.title,
      status: p.status,
      budget: p.price ?? items.totalBudget ?? null,
      patientId: p.patient.id,
      patient: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
      phone: p.patient.phone || null,
      nextStep: next?.title || 'Назначить следующий этап / запись',
    };
  });

  const apptsByDay = new Map<string, typeof horizonAppointments>();
  for (const a of horizonAppointments) {
    const key = dayKey(a.date);
    const list = apptsByDay.get(key) || [];
    list.push(a);
    apptsByDay.set(key, list);
  }

  const weakDays: Array<{
    date: string;
    weekday: string;
    booked: number;
    emptyHours: string[];
  }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startToday);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue; // skip Sunday
    const key = dayKey(d);
    const dayAppts = apptsByDay.get(key) || [];
    const takenHours = new Set(
      dayAppts.map((a) => parseHour(a.time)).filter((h): h is number => h != null),
    );
    // Today: only remaining hours count as empty capacity.
    const hours = WORK_HOURS.filter((h) => (i === 0 ? h > currentHour : true));
    const emptyHours = hours
      .filter((h) => !takenHours.has(h))
      .map((h) => `${pad2(h)}:00`);
    if (!isWeakDay(dayAppts.length, emptyHours.length)) continue;
    weakDays.push({
      date: key,
      weekday: weekdayRu(d),
      booked: dayAppts.length,
      emptyHours,
    });
  }

  const weakest = [...weakDays]
    .sort((a, b) => a.booked - b.booked || b.emptyHours.length - a.emptyHours.length)
    .slice(0, 5);

  const doctorName = new Map(
    members.map((m) => [m.user.id, `${m.user.firstName} ${m.user.lastName}`.trim()]),
  );
  const doctorCounts = new Map<string, number>();
  for (const a of horizonAppointments) {
    if (!a.doctorId) continue;
    doctorCounts.set(a.doctorId, (doctorCounts.get(a.doctorId) || 0) + 1);
  }
  const doctorLoad = members
    .map((m) => ({
      doctor: doctorName.get(m.user.id) || m.user.id,
      appointments: doctorCounts.get(m.user.id) || 0,
    }))
    .sort((a, b) => a.appointments - b.appointments);

  const lines: string[] = [];
  lines.push(`Загрузка клиники на ${days} дн. — по живым данным:`);
  lines.push('');

  lines.push('1) Кого возвращать в первую очередь');
  if (!recall.length) {
    lines.push(`• База активна: пациентов с паузой ≥${inactiveDays} дн. нет.`);
  } else {
    for (const r of recall.slice(0, 8)) {
      const why =
        r.reason === 'open_plan'
          ? 'незавершённый план'
          : r.reason === 'never_visited'
            ? 'ещё не был на приёме'
            : `не был ${r.daysSince} дн.`;
      const phone = r.phone ? ` · ${r.phone}` : '';
      lines.push(`• ${r.name}${phone} — ${why}${r.lastVisit ? ` (посл. ${r.lastVisit})` : ''}`);
    }
  }
  lines.push('');

  lines.push('2) Незавершённые планы лечения');
  if (!openPlans.length) {
    lines.push('• Открытых планов нет.');
  } else {
    for (const p of openPlans.slice(0, 8)) {
      const phone = p.phone ? ` · ${p.phone}` : '';
      const budget =
        p.budget != null ? ` · ~${Math.round(Number(p.budget)).toLocaleString('ru-RU')} ₸` : '';
      lines.push(`• ${p.patient}${phone}: «${p.title}» → ${p.nextStep}${budget}`);
    }
  }
  lines.push('');

  lines.push('3) Слабые окна в расписании');
  if (!weakest.length) {
    lines.push('• Провалов не видно — горизонт заполнен равномерно.');
  } else {
    for (const d of weakest) {
      const slots = d.emptyHours.slice(0, 4).join(', ') || '—';
      lines.push(
        `• ${d.date} (${d.weekday}): записей ${d.booked}, свободны ${slots}${d.emptyHours.length > 4 ? '…' : ''}`,
      );
    }
  }
  lines.push('');

  if (doctorLoad.length) {
    lines.push('4) Загрузка врачей (горизонт)');
    for (const d of doctorLoad.slice(0, 6)) {
      lines.push(`• ${d.doctor}: ${d.appointments} приём(ов)`);
    }
    lines.push('');
  }

  lines.push(
    'Быстрые поводы на свободные слоты: осмотр, консультация, профгигиена, контроль, продолжение этапа.',
  );

  const suggestions = [
    recall[0] ? `Записать ${recall[0].name.split(' ')[0]}` : 'Показать расписание',
    openPlans[0] ? 'Открыть планы лечения' : 'Показать пациентов',
    weakest[0] ? `Слоты на ${weakest[0].date}` : 'Что важно сегодня?',
  ];

  return {
    message: lines.join('\n'),
    suggestions,
    payload: {
      days,
      inactiveDays,
      recall,
      openPlans,
      weakDays: weakest,
      doctorLoad,
      totals: {
        patients: patients.length,
        recall: recall.length,
        openPlans: openPlans.length,
        appointmentsInHorizon: horizonAppointments.length,
        weakDays: weakest.length,
      },
    },
  };
}

/** Compact signals for proactive twin alerts + Jarvis briefing lines. */
export async function buildClinicLoadSignals(clinicId: string): Promise<{
  alerts: Array<{
    type: string;
    category: string;
    text: string;
    message: string;
    priority: number;
    action?: { type: string; path?: string };
  }>;
  briefingLines: string[];
  suggestions: string[];
  payload: Record<string, unknown>;
}> {
  const plan = await buildClinicLoadPlan(clinicId);
  const totals = (plan.payload.totals || {}) as {
    recall?: number;
    openPlans?: number;
    weakDays?: number;
  };
  const recall = Number(totals.recall || 0);
  const openPlans = Number(totals.openPlans || 0);
  const weakDays = Number(totals.weakDays || 0);

  const briefingLines: string[] = [];
  if (recall > 0) {
    briefingLines.push(`• Recall: **${recall}** пациентов без визита давно — можно обзвонить`);
  }
  if (openPlans > 0) {
    briefingLines.push(`• Незакрытых планов лечения: **${openPlans}**`);
  }
  if (weakDays > 0) {
    briefingLines.push(`• Слабые окна в расписании: **${weakDays}** дн. с дырами`);
  }

  const alerts: Array<{
    type: string;
    category: string;
    text: string;
    message: string;
    priority: number;
    action?: { type: string; path?: string };
  }> = [];

  if (recall > 0) {
    alerts.push({
      type: 'clinic_load_recall',
      category: 'ops',
      text: `${recall} пациентов для recall / повторной записи`,
      message: `${recall} пациентов для recall / повторной записи`,
      priority: 7,
      action: { type: 'OpenPatients', path: '/crm/patients' },
    });
  }
  if (openPlans > 0) {
    alerts.push({
      type: 'clinic_load_plans',
      category: 'ops',
      text: `${openPlans} незакрытых планов лечения`,
      message: `${openPlans} незакрытых планов лечения`,
      priority: 6,
      action: { type: 'OpenTreatmentPlans', path: '/crm/treatment-plans' },
    });
  }
  if (weakDays > 0) {
    alerts.push({
      type: 'clinic_load_slots',
      category: 'ops',
      text: `${weakDays} слабых дня в расписании — можно заполнить базу`,
      message: `${weakDays} слабых дня в расписании — можно заполнить базу`,
      priority: 5,
      action: { type: 'OpenSchedule', path: '/crm/schedule' },
    });
  }

  return {
    alerts,
    briefingLines,
    suggestions: plan.suggestions.slice(0, 3),
    payload: plan.payload,
  };
}

export function isClinicLoadQuery(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return false;
  return (
    /загрузк(а|у|е|и)?\s+(клиник|расписан)/i.test(t)
    || /как\s+(заполнить|поднять|загрузить)\s+(клиник|расписан|базу)/i.test(t)
    || /вернуть\s+пациент/i.test(t)
    || /заполнить\s+(слот|окна|расписан)/i.test(t)
    || /пустые?\s+слот/i.test(t)
    || /недозагруж/i.test(t)
    || /незаверш[её]нн\S*\s+лечен/i.test(t)
    || /план\s+загрузк/i.test(t)
    || /обзвон/i.test(t)
    || /профгигиен/i.test(t)
    || /повторн\S*\s+(визит|продаж|баз)/i.test(t)
    || /кого\s+(звонить|возвращать|приглас)/i.test(t)
    || /слабые?\s+(окна|дни|слот)/i.test(t)
    || /поднять\s+(свою\s+)?базу/i.test(t)
  );
}
