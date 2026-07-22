/**
 * Clinic load ops — concrete recall / open plans / schedule gaps from live data.
 * Used by getClinicLoadPlan tool and deterministic orchestrator answers.
 */
import prisma from '../../../lib/prisma.js';

const OPEN_PLAN_STATUSES = new Set([
  'draft',
  'proposed',
  'accepted',
  'in_progress',
  'in-progress',
  'active',
  'DRAFT',
  'PROPOSED',
  'ACCEPTED',
  'ACTIVE',
]);

const WORK_HOURS = [9, 10, 11, 12, 14, 15, 16, 17]; // skip typical lunch 13

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekdayRu(d: Date): string {
  return d.toLocaleDateString('ru-RU', { weekday: 'short' });
}

function parseHour(time?: string | null): number | null {
  if (!time) return null;
  const m = String(time).match(/^(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) ? h : null;
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
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endHorizon = new Date(startToday);
  endHorizon.setDate(endHorizon.getDate() + days);

  const inactiveBefore = new Date(startToday);
  inactiveBefore.setDate(inactiveBefore.getDate() - inactiveDays);

  const [patients, appointments, plans, members] = await Promise.all([
    prisma.patient.findMany({
      where: { clinicId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: new Date(startToday.getTime() - inactiveDays * 86400000), lt: endHorizon },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
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
      where: { clinicId, role: { in: ['DOCTOR', 'OWNER', 'ADMIN'] } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      take: 30,
    }),
  ]);

  // Last activity per patient (appointments in window; older = inactive)
  const lastByPatient = new Map<string, Date>();
  for (const a of appointments) {
    const prev = lastByPatient.get(a.patientId);
    if (!prev || a.date > prev) lastByPatient.set(a.patientId, a.date);
  }

  const openPlanPatientIds = new Set(plans.map((p) => p.patientId));

  const recall = patients
    .map((p) => {
      const last = lastByPatient.get(p.id);
      const daysSince = last
        ? Math.floor((startToday.getTime() - last.getTime()) / 86400000)
        : 9999;
      if (daysSince < inactiveDays) return null;
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
    const next = stages.find((s: any) => !['done', 'completed'].includes(String(s.status || '').toLowerCase()));
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

  // Schedule gaps for horizon
  const apptsByDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    if (a.date < startToday) continue;
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
    const emptyHours = WORK_HOURS.filter((h) => !takenHours.has(h)).map(
      (h) => `${String(h).padStart(2, '0')}:00`,
    );
    weakDays.push({
      date: key,
      weekday: weekdayRu(d),
      booked: dayAppts.length,
      emptyHours,
    });
  }

  const weakest = [...weakDays].sort((a, b) => a.booked - b.booked || b.emptyHours.length - a.emptyHours.length).slice(0, 5);

  const doctorName = new Map(members.map((m) => [m.user.id, `${m.user.firstName} ${m.user.lastName}`.trim()]));
  const doctorCounts = new Map<string, number>();
  for (const a of appointments) {
    if (a.date < startToday) continue;
    doctorCounts.set(a.doctorId, (doctorCounts.get(a.doctorId) || 0) + 1);
  }
  const doctorLoad = members
    .map((m) => ({
      doctor: doctorName.get(m.user.id) || m.user.id,
      appointments: doctorCounts.get(m.user.id) || 0,
    }))
    .sort((a, b) => a.appointments - b.appointments);

  // Build answer — concrete, no playbook
  const lines: string[] = [];
  lines.push(`Загрузка клиники на ${days} дн. — по живым данным:`);
  lines.push('');

  lines.push('1) Кого возвращать в первую очередь');
  if (!recall.length) {
    lines.push('• База активна: пациентов с паузой ≥' + inactiveDays + ' дн. нет.');
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
      const budget = p.budget != null ? ` · ~${Math.round(Number(p.budget)).toLocaleString('ru-RU')} ₸` : '';
      lines.push(`• ${p.patient}${phone}: «${p.title}» → ${p.nextStep}${budget}`);
    }
  }
  lines.push('');

  lines.push('3) Слабые окна в расписании');
  if (!weakest.length) {
    lines.push('• Провалов не видно.');
  } else {
    for (const d of weakest) {
      const slots = d.emptyHours.slice(0, 4).join(', ') || '—';
      lines.push(`• ${d.date} (${d.weekday}): записей ${d.booked}, свободны ${slots}${d.emptyHours.length > 4 ? '…' : ''}`);
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

  lines.push('Быстрые поводы на свободные слоты: осмотр, консультация, профгигиена, контроль, продолжение этапа.');

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
        appointmentsInHorizon: appointments.filter((a) => a.date >= startToday).length,
      },
    },
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

export type ClinicLoadAlert = {
  type: string;
  category: string;
  text: string;
  message: string;
  priority: number;
  action?: { type: string };
};

/** Compact signals for proactive alerts + Jarvis login briefing (no user query needed). */
export async function buildClinicLoadSignals(clinicId: string): Promise<{
  alerts: ClinicLoadAlert[];
  briefingLines: string[];
  suggestions: string[];
  payload: Record<string, unknown>;
}> {
  const plan = await buildClinicLoadPlan(clinicId, { days: 3, inactiveDays: 90 });
  const p = plan.payload as {
    recall?: Array<{ name: string; phone?: string | null; daysSince?: number | null; reason?: string }>;
    openPlans?: Array<{ patient: string; phone?: string | null; title: string; nextStep: string }>;
    weakDays?: Array<{ date: string; weekday: string; booked: number; emptyHours: string[] }>;
    totals?: { recall?: number; openPlans?: number };
  };

  const recall = p.recall || [];
  const openPlans = p.openPlans || [];
  const weakDays = p.weakDays || [];
  const today = weakDays[0];
  const alerts: ClinicLoadAlert[] = [];
  const briefingLines: string[] = [];

  if (openPlans.length > 0) {
    const top = openPlans[0];
    const phone = top.phone ? ` · ${top.phone}` : '';
    alerts.push({
      type: 'load',
      category: 'load',
      text: `Незавершённых планов: ${openPlans.length} — начните с ${top.patient}`,
      message: `Незавершённых планов: ${openPlans.length}. ${top.patient}${phone}: «${top.title}» → ${top.nextStep}`,
      priority: 8,
      action: { type: 'OpenTreatmentPlans' },
    });
    briefingLines.push(
      `• Загрузка: **${openPlans.length}** незакрытых планов — напр. **${top.patient}**${phone}: ${top.nextStep}`,
    );
  }

  if (recall.length > 0) {
    const top = recall[0];
    const phone = top.phone ? ` · ${top.phone}` : '';
    const why =
      top.reason === 'open_plan'
        ? 'есть открытый план'
        : top.daysSince != null
          ? `${top.daysSince} дн. без визита`
          : 'давно не был';
    alerts.push({
      type: 'load',
      category: 'load',
      text: `Вернуть в базу: ${recall.length} пациентов — ${top.name}`,
      message: `Вернуть в базу: ${recall.length}. Первый: ${top.name}${phone} (${why})`,
      priority: 7,
      action: { type: 'OpenPatients' },
    });
    briefingLines.push(`• Вернуть: **${top.name}**${phone} — ${why}${recall.length > 1 ? ` (+ ещё ${recall.length - 1})` : ''}`);
  }

  if (today && today.emptyHours.length >= 3 && today.booked < 6) {
    const slots = today.emptyHours.slice(0, 4).join(', ');
    alerts.push({
      type: 'load',
      category: 'load',
      text: `${today.date}: свободно ${slots} — заполните осмотрами/гигиеной`,
      message: `${today.weekday} ${today.date}: записей ${today.booked}, свободны ${slots}. Поводы: осмотр, профгигиена, контроль, продолжение этапа.`,
      priority: 7,
      action: { type: 'OpenSchedule' },
    });
    briefingLines.push(`• Свободные слоты **${today.date}**: ${slots} — заполнить обзвоном`);
  }

  const suggestions = [
    ...(openPlans[0] ? ['Открыть планы лечения'] : []),
    ...(recall[0] ? [`Записать ${recall[0].name.split(/\s+/)[0]}`] : []),
    'Показать расписание',
  ].slice(0, 3);

  return {
    alerts,
    briefingLines,
    suggestions,
    payload: {
      recallCount: recall.length,
      openPlansCount: openPlans.length,
      todayEmptyHours: today?.emptyHours || [],
      topRecall: recall[0] || null,
      topOpenPlan: openPlans[0] || null,
    },
  };
}
