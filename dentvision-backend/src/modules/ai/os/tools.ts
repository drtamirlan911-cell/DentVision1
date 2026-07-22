/**
 * Tool layer — DentVision AI OS.
 *
 * Every tool the orchestrator can plan with. Executors are:
 *  - clinic-scoped: every query is filtered by the caller's clinicId;
 *  - RBAC-aware: the orchestrator only exposes tools permitted for the
 *    caller's role (see registry.toolsForRole);
 *  - confirmation-gated: mutating tools never execute without
 *    `confirmed: true` — instead they return a proposal the UI renders
 *    as a confirm card (Spec §4.6 action model).
 */

import prisma from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';

export interface ToolContext {
  userId: string;
  clinicId: string | null;
  role: string;
}

export interface ToolResult {
  ok: boolean;
  /** Compact JSON the model reads to compose its answer. */
  data?: unknown;
  error?: string;
  /** Set for mutating tools awaiting user confirmation. */
  needsConfirmation?: { action: string; params: Record<string, unknown>; summary: string };
  /** Client-side navigation the UI should perform. */
  navigate?: string;
}

interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mutating?: boolean;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

function requireClinic(ctx: ToolContext): string {
  if (!ctx.clinicId) throw new Error('NO_CLINIC');
  return ctx.clinicId;
}

/** Canonical section → path. Keys stay English for the tool API. */
const NAV_PATHS: Record<string, string> = {
  schedule: '/crm/schedule',
  patients: '/crm/patients',
  finance: '/crm/finance',
  inventory: '/crm/inventory',
  documents: '/crm/documents',
  lab: '/crm/lab',
  reminders: '/crm/reminders',
  'dental-chart': '/crm/dental-chart',
  'treatment-plans': '/crm/treatment-plans',
  visits: '/crm/visits',
  staff: '/crm/staff',
  shop: '/shop',
  school: '/school',
  analytics: '/analytics',
  settings: '/settings',
  profile: '/profile',
  demo: '/crm/schedule?demo=1',
  pricing: '/pricing',
  jobs: '/jobs',
  community: '/community',
};

/** User-facing Russian names — never dump English keys into chat. */
export const NAV_SECTION_LABELS: Record<string, string> = {
  schedule: 'Расписание',
  patients: 'Пациенты',
  finance: 'Финансы',
  inventory: 'Склад',
  documents: 'Документы',
  lab: 'Лаборатория',
  reminders: 'Напоминания',
  'dental-chart': 'Зубная карта',
  'treatment-plans': 'Планы лечения',
  visits: 'Визиты',
  staff: 'Сотрудники',
  shop: 'Маркетплейс',
  school: 'Academy OS',
  analytics: 'Аналитика',
  settings: 'Настройки',
  profile: 'Профиль',
  demo: 'Демо-клиника',
  pricing: 'Тарифы',
  jobs: 'Вакансии',
  community: 'Сообщество',
};

/** Accept Russian / alias inputs from the model and normalize to NAV_PATHS keys. */
const NAV_ALIASES: Record<string, string> = {
  расписание: 'schedule',
  пациенты: 'patients',
  финансы: 'finance',
  касса: 'finance',
  склад: 'inventory',
  документы: 'documents',
  лаборатория: 'lab',
  напоминания: 'reminders',
  'зубная карта': 'dental-chart',
  зубнаякарта: 'dental-chart',
  'планы лечения': 'treatment-plans',
  планылечения: 'treatment-plans',
  визиты: 'visits',
  сотрудники: 'staff',
  персонал: 'staff',
  магазин: 'shop',
  маркетплейс: 'shop',
  marketplace: 'shop',
  школа: 'school',
  академия: 'school',
  'academy os': 'school',
  academy: 'school',
  аналитика: 'analytics',
  настройки: 'settings',
  профиль: 'profile',
  демо: 'demo',
  'демо клиника': 'demo',
  'демо-клиника': 'demo',
  тарифы: 'pricing',
  цены: 'pricing',
  вакансии: 'jobs',
  сообщество: 'community',
};

function normalizeNavSection(raw: unknown): string {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/^crm\//, '');
  if (!key) return '';
  if (NAV_PATHS[key]) return key;
  if (NAV_ALIASES[key]) return NAV_ALIASES[key];
  // path-style: /crm/schedule → schedule
  const last = key.split('/').filter(Boolean).pop() || '';
  if (NAV_PATHS[last]) return last;
  if (NAV_ALIASES[last]) return NAV_ALIASES[last];
  return key;
}

function availableSectionKeys(guestFriendly = false): string[] {
  return guestFriendly
    ? ['demo', 'shop', 'school', 'pricing', 'jobs', 'community']
    : Object.keys(NAV_SECTION_LABELS);
}

function availableSectionsRu(guestFriendly = false): string {
  return availableSectionKeys(guestFriendly)
    .map((k) => `• ${NAV_SECTION_LABELS[k]}`)
    .join('\n');
}

function availableSectionsData(guestFriendly = false): Array<{ key: string; label: string; path: string }> {
  return availableSectionKeys(guestFriendly).map((key) => ({
    key,
    label: NAV_SECTION_LABELS[key],
    path: NAV_PATHS[key],
  }));
}

/** Replace English nav keys in model text so users never see schedule/patients dumps. */
export function localizeNavKeysInMessage(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(
    /\b(schedule|patients|finance|inventory|documents|lab|reminders|dental-chart|treatment-plans|visits|staff|shop|school|analytics|settings|profile|demo|pricing|jobs|community)(\s*,\s*(schedule|patients|finance|inventory|documents|lab|reminders|dental-chart|treatment-plans|visits|staff|shop|school|analytics|settings|profile|demo|pricing|jobs|community))+/gi,
    (match) =>
      match
        .split(/\s*,\s*/)
        .map((k) => NAV_SECTION_LABELS[k.trim().toLowerCase()] || k.trim())
        .join(', '),
  );
  out = out.replace(
    /(раздел(?:ы)?\s*:\s*)([a-z0-9_,\-\s]+)/gi,
    (_m, _prefix: string, list: string) =>
      'разделы: ' +
      list
        .split(/[,\n]/)
        .map((part) => {
          const k = part.trim().toLowerCase();
          return NAV_SECTION_LABELS[k] || part.trim();
        })
        .filter(Boolean)
        .join(', '),
  );
  return out;
}

export const TOOLS: Record<string, ToolSpec> = {
  searchPatients: {
    name: 'searchPatients',
    description: 'Поиск пациентов клиники по имени, фамилии или телефону. Возвращает до 10 совпадений.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Имя, фамилия или телефон (частичное совпадение)' },
      },
      required: ['query'],
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const query = String(args.query || '').trim();
      const patients = await prisma.patient.findMany({
        where: {
          clinicId,
          ...(query && {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          }),
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, phone: true, birthDate: true, gender: true },
      });
      return { ok: true, data: patients };
    },
  },

  getPatientCard: {
    name: 'getPatientCard',
    description:
      'Полная карта пациента: визиты, зубная карта (одонтограмма FDI: статус + поверхности M/O/D/B/L), планы лечения, анамнез. ' +
      'Для плана лечения по полости рта сначала вызови этот инструмент и прочитай odontogramSummary / teeth.',
    parameters: {
      type: 'object',
      properties: { patientId: { type: 'string', description: 'ID пациента (uuid из searchPatients)' } },
      required: ['patientId'],
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        include: {
          visits: { orderBy: { date: 'desc' }, take: 5 },
          teeth: { orderBy: { number: 'asc' } },
          treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      const history = (patient.medicalHistory && typeof patient.medicalHistory === 'object'
        ? patient.medicalHistory
        : {}) as Record<string, any>;
      const teethMap: Record<string, any> = {};
      if (history.teeth && typeof history.teeth === 'object') Object.assign(teethMap, history.teeth);
      for (const t of patient.teeth || []) {
        const key = String(t.number);
        let surfaces: Record<string, string> | undefined;
        if (t.notes) {
          try {
            const parsed = JSON.parse(t.notes);
            if (parsed?.surfaces) surfaces = parsed.surfaces;
          } catch { /* ignore */ }
        }
        if (!teethMap[key]) {
          teethMap[key] = { status: t.condition || 'healthy', surfaces: surfaces || {} };
        } else if (typeof teethMap[key] === 'object' && surfaces && !teethMap[key].surfaces) {
          teethMap[key].surfaces = surfaces;
        }
      }

      const STATUS_RU: Record<string, string> = {
        healthy: 'здоров', caries: 'кариес', filled: 'пломба', crown: 'коронка',
        missing: 'отсутствует', root: 'корень', implant: 'имплант', veneer: 'винир',
        endo_ok: 'эндо успех', endo_fail: 'эндо неуспех',
      };
      const lines: string[] = [];
      for (const [num, raw] of Object.entries(teethMap).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const t = typeof raw === 'string' ? { status: raw } : (raw || {});
        const status = t.status || 'healthy';
        const hasSurf = t.surfaces && Object.keys(t.surfaces).length > 0;
        if (status === 'healthy' && !hasSurf) continue;
        const surf = hasSurf
          ? Object.entries(t.surfaces).map(([s, v]) => `${s}=${STATUS_RU[String(v)] || v}`).join(', ')
          : '';
        lines.push(`${num}: ${STATUS_RU[status] || status}${surf ? ` [${surf}]` : ''}`);
      }

      return {
        ok: true,
        data: {
          ...patient,
          teethMap,
          odontogramSummary: lines.length
            ? lines.join('\n')
            : 'Все зубы без отметок (здоровы / не заполнены).',
        },
      };
    },
  },

  getVisits: {
    name: 'getVisits',
    description: 'Последние визиты клиники или конкретного пациента (диагнозы, жалобы, лечение).',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'Опционально — ID пациента' },
        limit: { type: 'number', description: 'Максимум записей (по умолчанию 10)' },
      },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const visits = await prisma.visit.findMany({
        where: args.patientId
          ? { patientId: String(args.patientId), patient: { clinicId } }
          : { patient: { clinicId } },
        orderBy: { date: 'desc' },
        take: Math.min(Number(args.limit) || 10, 50),
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      return { ok: true, data: visits };
    },
  },

  getSchedule: {
    name: 'getSchedule',
    description: 'Расписание записей на дату (по умолчанию сегодня): время, пациент, врач, статус.',
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Дата YYYY-MM-DD (по умолчанию сегодня)' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const date = args.date ? new Date(String(args.date)) : new Date();
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const appointments = await prisma.appointment.findMany({
        where: { clinicId, date: { gte: start, lte: end } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      });
      return { ok: true, data: appointments };
    },
  },

  createAppointment: {
    name: 'createAppointment',
    description:
      'Создать запись пациента на приём. ТРЕБУЕТ подтверждения пользователем: без confirmed=true возвращает черновик.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        doctorId: { type: 'string', description: 'ID врача (по умолчанию — текущий пользователь)' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM' },
        type: { type: 'string', description: 'Тип приёма (Терапия, Консультация, ...)' },
        duration: { type: 'number', description: 'Минуты, по умолчанию 60' },
        chairId: { type: 'string', description: 'ID кресла (опционально)' },
        confirmed: { type: 'boolean', description: 'true только после явного подтверждения пользователем' },
      },
      required: ['patientId', 'date', 'time'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const { findScheduleConflicts, buildMeta } = await import('../../crm/appointmentMeta.js');
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      const doctorId = String(args.doctorId || ctx.userId);
      const time = String(args.time);
      const duration = Number(args.duration) || 60;
      const date = String(args.date);
      const chairId = args.chairId ? String(args.chairId) : undefined;

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createAppointment',
            params: { ...args, doctorId, confirmed: true },
            summary: `Записать ${patient.firstName} ${patient.lastName} на ${date} в ${time}${args.type ? ` (${args.type})` : ''}`,
          },
        };
      }

      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const candidates = await prisma.appointment.findMany({
        where: {
          clinicId,
          date: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      });
      const conflicts = findScheduleConflicts({
        candidates,
        doctorId,
        patientId: patient.id,
        chairId,
        time,
        duration,
      });
      if (conflicts.length > 0) {
        return { ok: false, error: 'Конфликт: врач, пациент или кресло уже заняты в это время' };
      }

      const meta = buildMeta({
        chairId,
        serviceName: args.type ? String(args.type) : undefined,
      });

      const appointment = await prisma.appointment.create({
        data: {
          id: uid(),
          clinicId,
          patientId: patient.id,
          doctorId,
          date: new Date(date),
          time,
          duration,
          status: 'PENDING',
          type: args.type ? String(args.type) : null,
          meta: meta as any,
        },
      });
      return { ok: true, data: appointment, navigate: '/crm/schedule' };
    },
  },

  updateAppointmentStatus: {
    name: 'updateAppointmentStatus',
    description:
      'Сменить статус записи (scheduled/confirmed/arrived/in_chair/done/cancelled/noShow). Требует подтверждения.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        status: {
          type: 'string',
          description: 'scheduled | confirmed | arrived | in_chair | done | cancelled | noShow',
        },
        confirmed: { type: 'boolean' },
      },
      required: ['appointmentId', 'status'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const { buildMeta, parseMeta, serializeAppointment, toDbStatus } = await import('../../crm/appointmentMeta.js');
      const existing = await prisma.appointment.findFirst({
        where: { id: String(args.appointmentId), clinicId },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      if (!existing) return { ok: false, error: 'Запись не найдена' };

      const status = String(args.status);
      const name = existing.patient
        ? `${existing.patient.firstName} ${existing.patient.lastName}`.trim()
        : 'пациента';

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'updateAppointmentStatus',
            params: { ...args, confirmed: true },
            summary: `Сменить статус записи ${name} (${existing.date.toISOString().slice(0, 10)} ${existing.time || ''}) → ${status}`,
          },
        };
      }

      const meta = buildMeta({ status }, parseMeta(existing.meta));
      const appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: { status: toDbStatus(status), meta: meta as any },
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      });
      return { ok: true, data: serializeAppointment(appointment), navigate: '/crm/schedule' };
    },
  },

  cancelAppointment: {
    name: 'cancelAppointment',
    description: 'Отменить запись на приём. Требует подтверждения.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        reason: { type: 'string' },
        confirmed: { type: 'boolean' },
      },
      required: ['appointmentId'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const { serializeAppointment } = await import('../../crm/appointmentMeta.js');
      const existing = await prisma.appointment.findFirst({
        where: { id: String(args.appointmentId), clinicId },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      if (!existing) return { ok: false, error: 'Запись не найдена' };

      const name = existing.patient
        ? `${existing.patient.firstName} ${existing.patient.lastName}`.trim()
        : 'пациента';

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'cancelAppointment',
            params: { ...args, confirmed: true },
            summary: `Отменить запись ${name} на ${existing.date.toISOString().slice(0, 10)} ${existing.time || ''}${args.reason ? ` (${args.reason})` : ''}`,
          },
        };
      }

      const appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          notes: args.reason
            ? `${existing.notes || ''}\n[Отмена] ${String(args.reason)}`.trim()
            : existing.notes,
        },
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      });
      return { ok: true, data: serializeAppointment(appointment), navigate: '/crm/schedule' };
    },
  },

  rescheduleAppointment: {
    name: 'rescheduleAppointment',
    description: 'Перенести запись на другую дату/время (с проверкой конфликтов). Требует подтверждения.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM' },
        doctorId: { type: 'string' },
        confirmed: { type: 'boolean' },
      },
      required: ['appointmentId', 'date', 'time'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const { findScheduleConflicts, parseMeta, serializeAppointment } = await import('../../crm/appointmentMeta.js');
      const existing = await prisma.appointment.findFirst({
        where: { id: String(args.appointmentId), clinicId },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      if (!existing) return { ok: false, error: 'Запись не найдена' };

      const date = String(args.date);
      const time = String(args.time);
      const doctorId = String(args.doctorId || existing.doctorId);
      const name = existing.patient
        ? `${existing.patient.firstName} ${existing.patient.lastName}`.trim()
        : 'пациента';

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'rescheduleAppointment',
            params: { ...args, doctorId, confirmed: true },
            summary: `Перенести запись ${name} на ${date} в ${time}`,
          },
        };
      }

      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const meta = parseMeta(existing.meta);
      const candidates = await prisma.appointment.findMany({
        where: {
          clinicId,
          date: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          id: { not: existing.id },
        },
      });
      const conflicts = findScheduleConflicts({
        candidates,
        doctorId,
        patientId: existing.patientId,
        chairId: meta.chairId,
        time,
        duration: existing.duration || 30,
        excludeId: existing.id,
      });
      if (conflicts.length > 0) {
        return { ok: false, error: 'Конфликт при переносе: слот занят' };
      }

      const appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: { date: new Date(date), time, doctorId },
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      });
      return { ok: true, data: serializeAppointment(appointment), navigate: '/crm/schedule' };
    },
  },

  getTreatmentPlans: {
    name: 'getTreatmentPlans',
    description: 'Планы лечения клиники или пациента: статус, диагноз, бюджет, этапы.',
    parameters: {
      type: 'object',
      properties: { patientId: { type: 'string', description: 'Опционально — ID пациента' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const plans = await prisma.treatmentPlan.findMany({
        where: {
          patient: { clinicId },
          ...(args.patientId ? { patientId: String(args.patientId) } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      return { ok: true, data: plans };
    },
  },

  createTreatmentPlan: {
    name: 'createTreatmentPlan',
    description:
      'Создать черновик плана лечения по одонтограмме или вручную (title, diagnosis, teeth FDI, stages, budget). ' +
      'Перед этим желательно getPatientCard → odontogramSummary. ' +
      'ТРЕБУЕТ подтверждения: без confirmed=true возвращает черновик. Статус always proposed — утверждает врач. ' +
      'Этапы: срочное (эндо fail, глубокий кариес) → терапия поверхностей → ортопедия/импланты.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        title: { type: 'string' },
        diagnosis: { type: 'string' },
        teeth: { type: 'array', items: { type: 'number' }, description: 'Номера зубов FDI' },
        totalBudget: { type: 'number' },
        stages: {
          type: 'array',
          items: { type: 'object', properties: { title: { type: 'string' }, cost: { type: 'number' } } },
        },
        confirmed: { type: 'boolean' },
      },
      required: ['patientId', 'title'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createTreatmentPlan',
            params: { ...args, confirmed: true },
            summary: `Создать план «${args.title}» для ${patient.firstName} ${patient.lastName}${args.totalBudget ? ` (бюджет ${args.totalBudget})` : ''}`,
          },
        };
      }

      const stages = Array.isArray(args.stages)
        ? (args.stages as Array<{ title?: string; cost?: number }>).map((s, i) => ({
            id: uid(), title: s.title || `Этап ${i + 1}`, status: 'pending', sortOrder: i + 1, cost: s.cost ?? null,
          }))
        : [];

      const plan = await prisma.treatmentPlan.create({
        data: {
          id: uid(),
          patientId: patient.id,
          title: String(args.title),
          status: 'proposed',
          items: {
            diagnosis: args.diagnosis ?? null,
            totalBudget: args.totalBudget ?? null,
            teeth: (args.teeth as number[]) || [],
            stages,
            doctorId: ctx.userId,
          },
          price: (args.totalBudget as number) ?? null,
          notes: (args.diagnosis as string) ?? null,
        },
      });
      return { ok: true, data: plan, navigate: '/crm/treatment-plans' };
    },
  },

  getRevenue: {
    name: 'getRevenue',
    description: 'Выручка клиники: оплаченные счета за период (по умолчанию текущий месяц) с разбивкой по месяцам.',
    parameters: {
      type: 'object',
      properties: { months: { type: 'number', description: 'Сколько последних месяцев (по умолчанию 1, максимум 12)' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const months = Math.min(Math.max(Number(args.months) || 1, 1), 12);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const invoices = await prisma.invoice.findMany({
        where: { clinicId, status: 'PAID', createdAt: { gte: from } },
        select: { amount: true, createdAt: true },
      });
      const byMonth = new Map<string, number>();
      for (const inv of invoices) {
        const key = inv.createdAt.toISOString().slice(0, 7);
        byMonth.set(key, (byMonth.get(key) || 0) + inv.amount);
      }
      const total = invoices.reduce((s, i) => s + i.amount, 0);
      return { ok: true, data: { total, count: invoices.length, byMonth: Object.fromEntries(byMonth) } };
    },
  },

  getDebtors: {
    name: 'getDebtors',
    description: 'Должники: неоплаченные и частично оплаченные счета с пациентами и телефонами.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const invoices = await prisma.invoice.findMany({
        where: { clinicId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      const patientIds = [...new Set(invoices.map((i) => i.patientId).filter(Boolean))] as string[];
      const patients = await prisma.patient.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      });
      const byId = new Map(patients.map((p) => [p.id, p]));
      const total = invoices.reduce((s, i) => s + i.amount, 0);
      return {
        ok: true,
        data: {
          total,
          count: invoices.length,
          debtors: invoices.map((i) => {
            const p = i.patientId ? byId.get(i.patientId) : undefined;
            return {
              invoiceId: i.id,
              amount: i.amount,
              status: i.status,
              patient: p ? `${p.firstName} ${p.lastName}` : 'Неизвестно',
              phone: p?.phone || null,
            };
          }),
        },
      };
    },
  },

  createInvoice: {
    name: 'createInvoice',
    description: 'Выставить счёт пациенту. ТРЕБУЕТ подтверждения: без confirmed=true возвращает черновик.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        amount: { type: 'number' },
        notes: { type: 'string' },
        confirmed: { type: 'boolean' },
      },
      required: ['patientId', 'amount'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Некорректная сумма' };

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createInvoice',
            params: { ...args, confirmed: true },
            summary: `Выставить счёт ${patient.firstName} ${patient.lastName} на ${amount.toLocaleString('ru-RU')}`,
          },
        };
      }

      const invoice = await prisma.invoice.create({
        data: {
          id: uid(),
          clinicId,
          patientId: patient.id,
          amount,
          status: 'UNPAID',
          items: [],
          notes: args.notes ? String(args.notes) : null,
        },
      });
      return { ok: true, data: invoice, navigate: '/crm/finance' };
    },
  },

  getDashboardStats: {
    name: 'getDashboardStats',
    description: 'KPI клиники: всего пациентов, записей сегодня, выручка за месяц, активные лаб. заказы.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [totalPatients, appointmentsToday, revenue, activeLabOrders] = await Promise.all([
        prisma.patient.count({ where: { clinicId } }),
        prisma.appointment.count({
          where: { clinicId, date: { gte: startOfToday, lt: endOfToday }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        }),
        prisma.invoice.aggregate({
          where: { clinicId, status: 'PAID', createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        prisma.labOrder.count({ where: { clinicId, status: { notIn: ['completed', 'delivered'] } } }),
      ]);
      return {
        ok: true,
        data: { totalPatients, appointmentsToday, revenueThisMonth: revenue._sum.amount ?? 0, activeLabOrders },
      };
    },
  },

  getDoctorUtilization: {
    name: 'getDoctorUtilization',
    description: 'Загрузка врачей: число приёмов за текущий месяц по каждому врачу клиники.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const members = await prisma.clinicMember.findMany({
        where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });
      const counts = await prisma.appointment.groupBy({
        by: ['doctorId'],
        where: {
          clinicId,
          doctorId: { in: members.map((m) => m.user.id) },
          date: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        _count: { id: true },
      });
      const byDoctor = new Map(counts.map((c) => [c.doctorId, c._count.id]));
      return {
        ok: true,
        data: members.map((m) => ({
          doctor: `${m.user.firstName} ${m.user.lastName}`,
          appointmentsThisMonth: byDoctor.get(m.user.id) || 0,
        })),
      };
    },
  },

  getInventory: {
    name: 'getInventory',
    description: 'Склад клиники: остатки материалов. lowStockOnly=true — только позиции ниже минимума.',
    parameters: {
      type: 'object',
      properties: { lowStockOnly: { type: 'boolean', description: 'Только заканчивающиеся позиции' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const items = await prisma.inventoryItem.findMany({ where: { clinicId }, orderBy: { name: 'asc' }, take: 100 });
      const filtered = args.lowStockOnly ? items.filter((i) => i.quantity <= i.minimum) : items;
      return { ok: true, data: filtered };
    },
  },

  getLabOrders: {
    name: 'getLabOrders',
    description: 'Лабораторные заказы клиники: тип работы, статус, срок готовности.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const orders = await prisma.labOrder.findMany({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      return { ok: true, data: orders };
    },
  },

  searchProducts: {
    name: 'searchProducts',
    description: 'Поиск товаров в маркетплейсе DentVision по названию, бренду или категории.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
      },
    },
    async execute(args) {
      const query = args.query ? String(args.query) : '';
      const products = await prisma.product.findMany({
        where: {
          ...(args.category ? { category: String(args.category) } : {}),
          ...(query && {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          }),
        },
        take: 10,
        orderBy: { rating: 'desc' },
        select: { id: true, name: true, brand: true, price: true, rating: true, category: true, stock: true },
      });
      return { ok: true, data: products };
    },
  },

  searchCourses: {
    name: 'searchCourses',
    description: 'Поиск курсов в Академии DentVision по теме, категории или автору.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
      },
    },
    async execute(args) {
      const query = args.query ? String(args.query) : '';
      const courses = await prisma.course.findMany({
        where: {
          ...(args.category ? { category: String(args.category) } : {}),
          ...(query && {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { author: { contains: query, mode: 'insensitive' } },
            ],
          }),
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, category: true, author: true, duration: true, price: true },
      });
      return { ok: true, data: courses };
    },
  },

  navigate: {
    name: 'navigate',
    description:
      'Открыть раздел приложения. Передавай section на русском или ключом: Расписание(schedule), Пациенты(patients), Финансы(finance), Склад(inventory), Документы(documents), Лаборатория(lab), Напоминания(reminders), Зубная карта(dental-chart), Планы лечения(treatment-plans), Визиты(visits), Сотрудники(staff), Маркетплейс(shop), Academy OS(school), Аналитика(analytics), Настройки(settings), Профиль(profile), Демо-клиника(demo), Тарифы(pricing), Вакансии(jobs), Сообщество(community). В ответе пользователю ВСЕГДА пиши русские названия, никогда не перечисляй английские ключи.',
    parameters: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Русское название или ключ раздела (например «Расписание» или schedule)',
        },
      },
      required: ['section'],
    },
    async execute(args, ctx) {
      const section = normalizeNavSection(args.section);
      const path = NAV_PATHS[section];
      const isGuest = String(ctx.role || '').toUpperCase() === 'GUEST';
      if (!path) {
        return {
          ok: false,
          error: `Неизвестный раздел. Доступные разделы:\n${availableSectionsRu(isGuest)}`,
          data: { availableSections: availableSectionsData(isGuest) },
        };
      }
      const label = NAV_SECTION_LABELS[section] || section;
      return {
        ok: true,
        data: { opened: path, section, label },
        navigate: path,
      };
    },
  },
};

export function toolSchemasFor(toolNames: Set<string>): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return Object.values(TOOLS)
    .filter((t) => toolNames.has(t.name))
    .map((t) => ({ type: 'function' as const, name: t.name, description: t.description, parameters: t.parameters }));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  allowed: Set<string>,
): Promise<ToolResult> {
  const tool = TOOLS[name];
  if (!tool) return { ok: false, error: `Инструмент ${name} не существует` };
  if (!allowed.has(name)) return { ok: false, error: `Инструмент ${name} недоступен для вашей роли` };
  try {
    return await tool.execute(args, ctx);
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_CLINIC') {
      return { ok: false, error: 'Нет активной клиники — выберите рабочее пространство' };
    }
    console.error(`[AI OS] tool ${name} failed:`, error);
    return { ok: false, error: 'Ошибка выполнения инструмента' };
  }
}
