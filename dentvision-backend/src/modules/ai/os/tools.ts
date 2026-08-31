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

import type { Prisma, DiagnosticCategory, ReferralPriority } from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { simpleChat } from '../llm/client.js';
import { resolveImageUrl } from '../../../lib/imageUrl.js';
import { checkImageAnalysisConsent, isImageConsentDenied, IMAGE_CONSENT_MESSAGE } from './imageConsent.js';
import { applyToothFindings as applyToothFindingsToChart, isValidFdi } from '../../patients/teethStore.js';
import { searchClinicalNotes } from '../lib/clinicalSearch.js';
import { uid } from '../../../lib/helpers.js';
import { publish } from '../../../lib/events.js';
import { isClinicMember } from '../../../lib/orgContext.js';
import { buildClinicLoadPlan } from '../core/clinicLoadPlan.js';
import { scrubToolOutput } from '../lib/piiScrubber.js';
import { createReferral } from '../../diagnostics/diagnostics.service.js';
import { prepareLabOrderWrite, VALID_STATUSES as VALID_LAB_STATUSES } from '../../lab/lab.routes.js';
import {
  NAV_PATHS,
  NAV_SECTION_LABELS,
  NAV_ALIASES,
  normalizeNavSection,
  availableSectionKeys as mapAvailableSectionKeys,
  availableSectionsRu as mapAvailableSectionsRu,
  availableSectionsData as mapAvailableSectionsData,
  platformMapPromptBlock,
} from '../lib/platformMap.js';

export { NAV_PATHS, NAV_SECTION_LABELS, NAV_ALIASES, normalizeNavSection, platformMapPromptBlock };
export interface ToolContext {
  userId: string;
  clinicId: string | null;
  role: string;
  /** What's open in the caller's workspace (os/context.ts) — the kernel may use it to fill a missing patientId, never a tool directly. */
  entity?: { type: string; id: string } | null;
}

export interface ToolResult {
  ok: boolean;
  /** Compact JSON the model reads to compose its answer. */
  data?: unknown;
  error?: string;
  /** Set for mutating tools awaiting user confirmation. */
  needsConfirmation?: { action: string; params: Record<string, unknown>; summary: string; approvalId?: string };
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

/** Chart status vocabulary — must match `src/lib/odontogram.ts::STATUS_META`. */
const CHART_STATUSES = new Set([
  'healthy', 'caries', 'filled', 'crown', 'implant', 'missing',
  'extracted', 'fracture', 'inflammation', 'root', 'veneer', 'endo_ok', 'endo_fail',
]);

/** Formats a vision model can look at. A DICOM or STL is not one. */
function isViewableImage(url: string | null, name: string | null): boolean {
  const u = String(url || '');
  if (/^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(u)) return true;
  return /\.(jpe?g|png|gif|webp)$/i.test(String(name || '')) || /\.(jpe?g|png|gif|webp)$/i.test(u.split('?')[0]);
}

/** Findings come back as fields, never parsed out of prose. */
const RADIOGRAPH_FINDINGS_SCHEMA = {
  name: 'radiograph_findings',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['findings'],
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['tooth', 'status', 'surfaces', 'note'],
          properties: {
            tooth: { type: 'integer' },
            status: { type: 'string' },
            surfaces: { type: 'array', items: { type: 'string' } },
            note: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
} as const;

function requireClinic(ctx: ToolContext): string {
  if (!ctx.clinicId) throw new Error('NO_CLINIC');
  return ctx.clinicId;
}

/**
 * `{ id, clinicId }` for a single-record by-id lookup scoped to the caller's
 * clinic. Every tool that fetches "the patient/appointment/order with this
 * id" needs exactly this shape — composing it inline as `{ id: ..., clinicId }`
 * at each call site means a future tool can drop `clinicId` and silently
 * reach across tenants (the row still resolves, just for the wrong clinic).
 * Routing every by-id lookup through one function makes that omission a
 * one-line diff to notice instead of a buried object literal; the regression
 * guard in `tools.test.ts` checks the file never reverts to the inline form.
 */
function scopedId(clinicId: string, id: string): { id: string; clinicId: string } {
  return { id, clinicId };
}

function availableSectionKeys(guestFriendly = false): string[] {
  return mapAvailableSectionKeys(guestFriendly ? 'GUEST' : 'OWNER', guestFriendly);
}

function availableSectionsRu(guestFriendly = false): string {
  return mapAvailableSectionsRu(guestFriendly ? 'GUEST' : 'OWNER', guestFriendly);
}

function availableSectionsData(guestFriendly = false): Array<{ key: string; label: string; path: string }> {
  return mapAvailableSectionsData(guestFriendly ? 'GUEST' : 'OWNER', guestFriendly).map(({ key, label, path }) => ({
    key,
    label,
    path,
  }));
}

/** Replace English nav keys in model text so users never see schedule/patients dumps. */
export function localizeNavKeysInMessage(text: string): string {
  if (!text) return text;
  let out = text;
  const keyList = Object.keys(NAV_SECTION_LABELS).join('|');
  const multi = new RegExp(`\\b(${keyList})(\\s*,\\s*(${keyList}))+`, 'gi');
  out = out.replace(multi, (match) =>
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
      return { ok: true, data: scrubToolOutput(patients) };
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
        where: scopedId(clinicId, String(args.patientId)),
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

      const scrubbed = scrubToolOutput({
        ...patient,
        teethMap,
        odontogramSummary: lines.length
          ? lines.join('\n')
          : 'Все зубы без отметок (здоровы / не заполнены).',
      });
      return { ok: true, data: scrubbed };
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
      return { ok: true, data: scrubToolOutput(visits) };
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
      return { ok: true, data: scrubToolOutput(appointments) };
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
        where: scopedId(clinicId, String(args.patientId)),
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      const doctorId = String(args.doctorId || ctx.userId);
      // `doctorId` comes from the model's tool-call arguments when explicitly
      // given (the caller may ask to book "with Dr. X"). Unlike patientId
      // above, nothing here confirms it belongs to this clinic — write it
      // unchecked and the appointment ends up assigned to a user with no
      // relationship to the clinic at all. Skipped when it defaulted to
      // ctx.userId, which the orchestrator already verified.
      if (args.doctorId && doctorId !== ctx.userId && !(await isClinicMember(doctorId, clinicId))) {
        return { ok: false, error: 'Указанный врач не найден в этой клинике' };
      }
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
          status: { notIn: ['cancelled', 'no_show'] },
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
          status: 'pending',
          type: args.type ? String(args.type) : null,
          meta: meta as any,
        },
      });
      // Same event the schedule screen publishes — an appointment the AI books
      // is an appointment, and audit / workflows / webhooks were blind to it.
      publish('appointment.created', {
        clinicId,
        appointmentId: appointment.id,
        patientId: patient.id,
        doctorId,
        userId: ctx.userId,
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
        where: scopedId(clinicId, String(args.appointmentId)),
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
        where: scopedId(clinicId, String(args.appointmentId)),
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
          status: 'cancelled',
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
        where: scopedId(clinicId, String(args.appointmentId)),
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      if (!existing) return { ok: false, error: 'Запись не найдена' };

      const date = String(args.date);
      const time = String(args.time);
      const doctorId = String(args.doctorId || existing.doctorId);
      if (args.doctorId && doctorId !== existing.doctorId && !(await isClinicMember(doctorId, clinicId))) {
        return { ok: false, error: 'Указанный врач не найден в этой клинике' };
      }
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
          status: { notIn: ['cancelled', 'no_show'] },
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
      return { ok: true, data: scrubToolOutput(plans) };
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
        where: scopedId(clinicId, String(args.patientId)),
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
          clinicId,
          title: String(args.title),
          status: 'proposed',
          items: {
            diagnosis: args.diagnosis ?? null,
            totalBudget: args.totalBudget ?? null,
            teeth: (args.teeth as number[]) || [],
            stages,
            doctorId: ctx.userId,
          } as Prisma.InputJsonValue,
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
        where: { clinicId, status: 'paid', createdAt: { gte: from } },
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
        where: { clinicId, status: { in: ['unpaid', 'partial', 'overdue'] } },
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
        where: scopedId(clinicId, String(args.patientId)),
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
          status: 'unpaid',
          items: [],
          notes: args.notes ? String(args.notes) : null,
        },
      });
      return { ok: true, data: invoice, navigate: '/crm/finance' };
    },
  },

  getClinicLoadPlan: {
    name: 'getClinicLoadPlan',
    description:
      'Живой план загрузки клиники: кого возвращать (давно не были / незавершённые планы + телефоны), ' +
      'слабые окна расписания на N дней, загрузка врачей. Вызывай СРАЗУ при вопросах про загрузку, обзвон, пустые слоты, возврат базы — не давай общую теорию.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Горизонт дней (по умолчанию 7)' },
        inactiveDays: { type: 'number', description: 'Сколько дней без визита считать «давно» (по умолчанию 90)' },
      },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const plan = await buildClinicLoadPlan(clinicId, {
        days: args.days as number | undefined,
        inactiveDays: args.inactiveDays as number | undefined,
      });
      return {
        ok: true,
        data: { ...plan.payload, answer: plan.message, suggestions: plan.suggestions },
        navigate: '/crm/schedule',
      };
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
          where: { clinicId, date: { gte: startOfToday, lt: endOfToday }, status: { notIn: ['cancelled', 'no_show'] } },
        }),
        prisma.invoice.aggregate({
          where: { clinicId, status: 'paid', createdAt: { gte: startOfMonth } },
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
          status: { notIn: ['cancelled', 'no_show'] },
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

  createDiagnosticReferral: {
    name: 'createDiagnosticReferral',
    description:
      'Создать направление на диагностику (КТ, ОПТГ, гистология и т.д.) в диагностический центр или лабораторию. ТРЕБУЕТ подтверждения пользователем: без confirmed=true возвращает черновик.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'ID зарегистрированного пациента (опционально)' },
        patientName: { type: 'string', description: 'ФИО пациента' },
        category: {
          type: 'string',
          description: 'CBCT, OPG, TRG, TMJ, STL, FACE_SCAN, DICOM, ALLERGY, HISTOLOGY, PCR, MICROBIOLOGY, BLOOD, GENETICS, BIOPSY, SALIVA',
        },
        studyType: { type: 'string', description: 'Конкретное исследование, например «КТ верхней челюсти»' },
        centerId: { type: 'string', description: 'ID диагностического центра (опционально)' },
        labId: { type: 'string', description: 'ID лаборатории (опционально)' },
        complaints: { type: 'string' },
        preliminaryDx: { type: 'string', description: 'Предварительный диагноз' },
        priority: { type: 'string', description: 'NORMAL | URGENT | EMERGENCY' },
        confirmed: { type: 'boolean', description: 'true только после явного подтверждения пользователем' },
      },
      required: ['patientName', 'category', 'studyType'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patientName = String(args.patientName || '').trim();
      const category = String(args.category || '').trim() as DiagnosticCategory;
      const studyType = String(args.studyType || '').trim();
      if (!patientName || !category || !studyType) {
        return { ok: false, error: 'patientName, category и studyType обязательны' };
      }

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createDiagnosticReferral',
            params: { ...args, confirmed: true },
            summary: `Направить ${patientName} на ${studyType} (${category})`,
          },
        };
      }

      try {
        const referral = await createReferral(
          {
            patientName,
            patientId: args.patientId ? String(args.patientId) : undefined,
            clinicId,
            doctorId: ctx.userId,
            category,
            studyType,
            centerId: args.centerId ? String(args.centerId) : undefined,
            labId: args.labId ? String(args.labId) : undefined,
            complaints: args.complaints ? String(args.complaints) : undefined,
            preliminaryDx: args.preliminaryDx ? String(args.preliminaryDx) : undefined,
            priority: args.priority ? (String(args.priority) as ReferralPriority) : undefined,
          },
          ctx.userId,
        );
        return { ok: true, data: referral, navigate: '/diagnostics/referrals' };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Не удалось создать направление' };
      }
    },
  },

  createLabOrder: {
    name: 'createLabOrder',
    description:
      'Создать заказ-наряд в зуботехническую лабораторию. ТРЕБУЕТ подтверждения пользователем: без confirmed=true возвращает черновик.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'ID пациента (опционально)' },
        patientName: { type: 'string', description: 'ФИО пациента, если пациент не зарегистрирован в системе' },
        labType: { type: 'string', description: 'Тип работы, например «Коронка E-max»' },
        material: { type: 'string' },
        toothNumber: { type: 'string', description: 'Номер зуба по FDI' },
        shade: { type: 'string', description: 'Оттенок' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD, срок готовности' },
        notes: { type: 'string' },
        price: { type: 'number' },
        confirmed: { type: 'boolean', description: 'true только после явного подтверждения пользователем' },
      },
      required: ['labType'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const labType = String(args.labType || '').trim();
      if (!labType) return { ok: false, error: 'labType обязателен' };

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createLabOrder',
            params: { ...args, confirmed: true },
            summary: `Заказ в лабораторию: ${labType}${args.patientName ? ` для ${args.patientName}` : ''}`,
          },
        };
      }

      const prepared = await prepareLabOrderWrite(clinicId, { ...args, labType, doctorId: ctx.userId });
      if (prepared.error) return { ok: false, error: prepared.error };

      const order = await prisma.labOrder.create({
        data: { id: uid(), clinicId, ...(prepared.data as object) },
      });
      return { ok: true, data: order, navigate: '/crm/lab' };
    },
  },

  updateLabOrderStatus: {
    name: 'updateLabOrderStatus',
    description: `Изменить статус заказа лаборатории. Допустимые статусы: ${VALID_LAB_STATUSES.join(', ')}.`,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['id', 'status'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const id = String(args.id || '');
      const status = String(args.status || '');
      if (!id || !(VALID_LAB_STATUSES as readonly string[]).includes(status)) {
        return { ok: false, error: `Недопустимый статус. Допустимые: ${VALID_LAB_STATUSES.join(', ')}` };
      }

      const owned = await prisma.labOrder.findFirst({ where: scopedId(clinicId, id), select: { id: true } });
      if (!owned) return { ok: false, error: 'Заказ лаборатории не найден' };

      const order = await prisma.labOrder.update({
        where: { id },
        data: { status: status as any },
      });
      return { ok: true, data: order, navigate: '/crm/lab' };
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

  getPromotions: {
    name: 'getPromotions',
    description: 'Акции клиники: активные и недавние промо со скидками и сроками.',
    parameters: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'Только активные (по умолчанию true)' },
      },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const activeOnly = args.activeOnly !== false;
      const rows = await prisma.promotion.findMany({
        where: { clinicId, ...(activeOnly ? { active: true } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          promotions: rows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            discountPercent: r.discountPercent ?? 0,
            startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
            endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
            active: r.active,
          })),
        },
        navigate: '/crm/promotions',
      };
    },
  },

  getRecallList: {
    name: 'getRecallList',
    description:
      'Пациенты для реактивации (давно не были): имена, телефоны, дни без визита. Для Marketing / Reception.',
    parameters: {
      type: 'object',
      properties: {
        inactiveDays: { type: 'number', description: 'Сколько дней без визита (по умолчанию 90)' },
        limit: { type: 'number', description: 'Сколько пациентов вернуть (макс 20)' },
      },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const inactiveDays = Math.min(Math.max(Number(args.inactiveDays) || 90, 30), 365);
      const limit = Math.min(Math.max(Number(args.limit) || 12, 3), 20);
      const plan = await buildClinicLoadPlan(clinicId, { inactiveDays });
      const recall = Array.isArray(plan.payload.recall) ? plan.payload.recall : [];
      const list = recall.slice(0, limit);
      return {
        ok: true,
        data: scrubToolOutput({
          inactiveDays,
          count: list.length,
          totalRecall: recall.length,
          patients: list,
        }),
        navigate: '/crm/patients',
      };
    },
  },

  draftPromoCopy: {
    name: 'draftPromoCopy',
    description:
      'Черновик текста акции / WhatsApp-шаблона (не отправляет). theme — тема (гигиена, имплант, recall…).',
    parameters: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'Тема акции' },
        channel: {
          type: 'string',
          description: 'whatsapp | sms | poster (по умолчанию whatsapp)',
        },
        discountPercent: { type: 'number', description: 'Скидка %, если известна' },
      },
      required: ['theme'],
    },
    async execute(args, ctx) {
      requireClinic(ctx);
      const theme = String(args.theme || 'акция').trim();
      const channel = String(args.channel || 'whatsapp').toLowerCase();
      const discount =
        args.discountPercent != null && Number.isFinite(Number(args.discountPercent))
          ? Math.round(Number(args.discountPercent))
          : null;
      const discountLine = discount != null ? ` со скидкой ${discount}%` : '';
      const body =
        channel === 'sms'
          ? `Здравствуйте! В нашей клинике — «${theme}»${discountLine}. Запись: ответьте на это сообщение или позвоните.`
          : channel === 'poster'
            ? `«${theme}»${discountLine}\nЗапишитесь сегодня — места ограничены.`
            : `Здравствуйте! 👋\n\nПриглашаем на «${theme}»${discountLine}.\nУдобно записать вас на ближайший свободный слот?\n\nС уважением, клиника`;
      return {
        ok: true,
        data: {
          channel,
          theme,
          discountPercent: discount,
          draft: body,
          note: 'Черновик — отправку делает сотрудник после подтверждения политики клиники.',
        },
        navigate: '/crm/promotions',
      };
    },
  },

  composeCeoBrief: {
    name: 'composeCeoBrief',
    description:
      'Executive brief для владельца/директора: синтез выручки, долгов, загрузки и акций. Вызывай при «что важно», приоритетах недели, режиме CEO.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const { composeCeoBrief } = await import('../core/ceoBrief.js');
      const clinic = ctx.clinicId
        ? await prisma.clinic.findUnique({ where: { id: ctx.clinicId }, select: { name: true } }).catch(() => null)
        : null;
      const brief = await composeCeoBrief({
        userId: ctx.userId,
        clinicId: ctx.clinicId,
        role: ctx.role,
        clinicName: clinic?.name,
      });
      return { ok: true, data: brief };
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
      'Открыть любой раздел DentVision. section — русское название или ключ. CRM: Расписание, Пациенты, Медкарта, Визиты, Зубная карта, Планы лечения, Касса, Лаборатория, Склад, Документы, Сотрудники, Напоминания, Прайс, Акции, МКБ-10, Настройки клиники, Тариф клиники. Экосистема: Маркетплейс, Academy OS, Аналитика, Вакансии, Сообщество, Кабинет продавца, Кабинет лектора. Платформа: Профиль, Настройки, Мои клиники, Платформа, Аудит, Бэкапы, Демо-клиника, Тарифы. В ответе пользователю — только русские названия.',
    parameters: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Русское название или ключ раздела (например «Расписание», «Прайс», «Кабинет продавца»)',
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
          error: `Неизвестный раздел. Доступные разделы:\n${mapAvailableSectionsRu(ctx.role, isGuest)}`,
          data: { availableSections: mapAvailableSectionsData(ctx.role, isGuest) },
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

  searchClinicalNotes: {
    name: 'searchClinicalNotes',
    description:
      'Смысловой поиск по записям приёмов клиники (жалобы, анамнез, диагноз, примечания). ' +
      'Находит по смыслу, а не по совпадению слов: «воспаление у верхушки корня» найдёт запись про периодонтит. ' +
      'Можно ограничить одним пациентом через patientId.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Что ищем, обычными словами' },
        patientId: { type: 'string', description: 'Ограничить поиск одним пациентом' },
        limit: { type: 'number', description: 'Сколько записей вернуть (1-25, по умолчанию 8)' },
      },
      required: ['query'],
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const query = String(args.query || '').trim();
      if (!query) return { ok: false, error: 'Нужен текст запроса' };

      const result = await searchClinicalNotes({
        clinicId,
        query,
        patientId: args.patientId ? String(args.patientId) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      });

      return {
        ok: true,
        data: {
          ...result,
          // Say how the list was ordered. A lexical fallback returns rough
          // matches, and presenting those as semantic hits would overstate
          // what the answer is worth.
          note: result.ranking === 'semantic'
            ? 'Отсортировано по смысловой близости.'
            : 'Смысловой поиск недоступен — показаны совпадения по словам, начиная с недавних.',
        },
      };
    },
  },

  analyzeRadiograph: {
    name: 'analyzeRadiograph',
    description:
      'Прочитать рентген/ОПТГ/фото пациента и вернуть находки по зубам FDI. ' +
      'Только читает: ничего в карту не пишет — для записи есть applyToothFindings. ' +
      'Требует включённого клиникой анализа снимков и согласия пациента, если он зарегистрирован.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        imageId: { type: 'string', description: 'Конкретный снимок; по умолчанию — последний читаемый' },
      },
      required: ['patientId'],
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patientId = String(args.patientId || '');

      const consent = await checkImageAnalysisConsent(clinicId, patientId);
      if (isImageConsentDenied(consent)) {
        return { ok: false, error: IMAGE_CONSENT_MESSAGE[consent.reason] };
      }

      const images = await prisma.patientImage.findMany({
        where: { patientId, deletedAt: null, ...(args.imageId ? { id: String(args.imageId) } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, url: true, name: true, type: true, createdAt: true },
      });
      const viewable = images.find((i) => isViewableImage(i.url, i.name));
      if (!viewable) {
        return { ok: false, error: 'Нет снимка в читаемом формате (JPG, PNG, GIF, WEBP)' };
      }

      const imageUrl = await resolveImageUrl(viewable.url);
      const raw = await simpleChat(
        'Ты — стоматолог-рентгенолог. Перед тобой снимок пациента. Опиши находки по зубам в нотации FDI. ' +
          'Указывай ТОЛЬКО то, что видно; если зуб не просматривается — не включай его. ' +
          'status выбирай из: caries, filled, crown, implant, missing, extracted, fracture, inflammation, root, veneer, endo_ok, endo_fail. ' +
          'surfaces — только когда поверхность действительно различима: M, O, D, B, L.',
        `Снимок: ${viewable.type}. Верни находки по зубам.`,
        { maxTokens: 1200, imageUrl, jsonSchema: RADIOGRAPH_FINDINGS_SCHEMA },
      );

      let parsed: { findings?: unknown };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, error: 'Модель вернула ответ в неожиданном формате' };
      }
      const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
      const clean = findings
        .map((f: any) => ({
          tooth: Number(f?.tooth),
          status: String(f?.status || ''),
          surfaces: Array.isArray(f?.surfaces) ? f.surfaces.map(String) : [],
          note: typeof f?.note === 'string' ? f.note : null,
        }))
        .filter((f) => isValidFdi(f.tooth) && CHART_STATUSES.has(f.status));

      return {
        ok: true,
        data: {
          imageId: viewable.id,
          imageType: viewable.type,
          findings: clean,
          // Nothing is written here. Saying so keeps the model from reporting
          // to the doctor that the chart has been updated.
          note: 'Находки не внесены в карту. Для внесения вызови applyToothFindings.',
        },
      };
    },
  },

  applyToothFindings: {
    name: 'applyToothFindings',
    description:
      'Внести находки по зубам (FDI) в одонтограмму пациента. Меняет медицинскую карту. ' +
      'ТРЕБУЕТ подтверждения: без confirmed=true возвращает черновик с диффом «было → станет».',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tooth: { type: 'number' },
              status: { type: 'string' },
              surfaces: { type: 'array', items: { type: 'string' } },
              note: { type: 'string' },
            },
          },
        },
        sourceImageId: { type: 'string', description: 'Снимок, из которого получены находки' },
        confirmed: { type: 'boolean' },
      },
      required: ['patientId', 'findings'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patientId = String(args.patientId || '');
      const patient = await prisma.patient.findFirst({
        where: scopedId(clinicId, patientId),
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      const raw = Array.isArray(args.findings) ? args.findings : [];
      const findings = raw
        .map((f: any) => ({
          tooth: Number(f?.tooth),
          status: String(f?.status || ''),
          surfaces: Array.isArray(f?.surfaces) ? f.surfaces.map(String) : [],
          note: typeof f?.note === 'string' ? f.note : null,
        }))
        .filter((f) => isValidFdi(f.tooth) && CHART_STATUSES.has(f.status));

      if (findings.length === 0) {
        return { ok: false, error: 'Нет пригодных находок: проверьте номера FDI и названия статусов' };
      }

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'applyToothFindings',
            params: { ...args, findings, confirmed: true },
            summary:
              `Внести в карту ${patient.firstName} ${patient.lastName}: ` +
              findings.map((f) => `${f.tooth} → ${f.status}`).join(', '),
          },
        };
      }

      const changes = await applyToothFindingsToChart(patientId, clinicId, findings);
      return {
        ok: true,
        data: { patientId, applied: changes.length, changes, sourceImageId: args.sourceImageId || null },
      };
    },
  },
};

/** Every registered tool name — the permission map is asserted complete against it. */
export function listToolNames(): string[] {
  return Object.values(TOOLS).map((t) => t.name);
}

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

/**
 * Thin wrapper over the governance kernel (`os/kernel.ts::runAiAction`).
 * Signature is unchanged on purpose: both call sites (`orchestrator.ts` and
 * `POST /api/ai/confirm`) already resolve `ctx`/`allowed` for their own
 * purposes and must keep working without edits — the kernel re-resolves
 * identity from the DB itself rather than trusting them, and additionally
 * records an `AgentActivity` (+ `ActionEvidence`) row for every call,
 * including denials, which this function never did before.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  _allowed: Set<string>,
): Promise<ToolResult> {
  const { runAiAction } = await import('./kernel.js');
  const result = await runAiAction(
    { surface: 'staff', userId: ctx.userId, requestedClinicId: ctx.clinicId, entity: ctx.entity },
    { tool: name, args },
  );
  if (result.status === 'ok') return result.data as ToolResult;
  if (result.status === 'denied') return { ok: false, error: result.error };
  return {
    ok: false,
    needsConfirmation: {
      action: result.action,
      params: result.params,
      summary: result.summary,
      approvalId: result.approvalId,
    },
  };
}
