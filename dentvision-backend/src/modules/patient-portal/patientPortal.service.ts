/**
 * The portal's reads, keyed by a patient id the caller has already proven.
 *
 * These bodies came out of `patientPortal.routes.ts` unchanged. They live here
 * so the AI assistant answers from *exactly* the query the tab renders rather
 * than a second, parallel one written later: when the two drift, the one that
 * drifts is the one nobody is looking at, and here that would mean an
 * assistant quietly showing a patient something the portal would not.
 *
 * Every function takes `patientId` and filters on it. None of them resolves
 * identity — that is the caller's job, from the session, before calling in.
 */

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { parseMeta } from '../crm/appointmentMeta.js';
import {
  collectPlanTeeth,
  enrichStages,
  lineItemTotal,
  normalizePlanItems,
} from '../../lib/treatmentPlanShape.js';
// The patient side reads releases, never `TreatmentPlan` — see
// modules/patient-presentation/planRelease.service.ts. A structural test
// (planReleaseBoundary.test.ts) fails if that ever stops being true.
import { listPublishedReleases } from '../patient-presentation/planRelease.service.js';

export async function getAppointments(patientId: string) {
  const appointments = await (prisma as any).appointment.findMany({
    where: { patientId },
    select: {
      id: true, date: true, time: true, status: true, type: true, notes: true, meta: true,
      doctor: { select: { firstName: true, lastName: true } },
      clinic: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  });
  // toothNumber/procedureType/reason are not columns — they live in the
  // freeform `meta` JSON (see appointmentMeta.ts, shared with the CRM schedule).
  return appointments.map((a: any) => {
    const meta = parseMeta(a.meta);
    return {
      id: a.id, date: a.date, time: a.time, status: a.status, notes: a.notes,
      doctor: a.doctor, clinic: a.clinic,
      procedureType: meta.serviceName || a.type || '',
      toothNumber: meta.toothNumber ?? '',
      reason: meta.reason || meta.serviceName || a.type || '',
    };
  });
}

/**
 * There is no dedicated `Treatment` model — individual procedures live nested
 * inside `TreatmentPlan.items.stages[].items[]` (see crm.routes.ts, where a
 * plan is built and serialized). Flatten every stage line item across all of
 * the patient's plans into the flat list the portal displays.
 *
 * Scoped to `PATIENT_VISIBLE_PLAN_STATUSES`. Before that filter existed this
 * query had no status condition at all, so a patient was shown line items and
 * prices out of drafts — including the plan `odontogram-plan-sync.ts` generates
 * automatically on every dental-chart save, whose prices are machine estimates
 * no clinician had reviewed.
 */
export async function getTreatments(patientId: string) {
  const releases = await listPublishedReleases(patientId);
  const treatments: any[] = [];
  for (const release of releases) {
    const items = normalizePlanItems(release.snapshot);
    const diagnosis = items.diagnosis ?? null;
    const clinic = (release as any).clinic ?? null;
    for (const stage of items.stages!) {
      for (const item of stage.items || []) {
        const teeth = Array.isArray(item.teeth) ? item.teeth : [];
        treatments.push({
          id: item.id || `${release.id}-${treatments.length}`,
          toothNumber: teeth.join(', '),
          procedureType: item.serviceName || item.name || '',
          cost: lineItemTotal(item),
          diagnosis,
          notes: stage.notes || null,
          clinic,
          createdAt: release.approvedAt,
        });
      }
    }
  }
  treatments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return treatments.slice(0, 100);
}

/**
 * `stages`/`teeth` are not columns, they live inside the `items` JSON blob
 * (see crm.routes.ts::serializePlan for the same unpacking). TreatmentPlan
 * also has no direct `clinic` relation; it comes via `patient`.
 *
 * Totals are **recomputed** from the stages rather than read off the stored
 * `price` column. The CRM read has always recomputed (crm.routes.ts), so
 * trusting the stored value here meant the clinic and the patient could be
 * looking at two different numbers for the same plan whenever `items` was last
 * written by a path that does not keep `price` in step — which both
 * medical.routes.ts and doctor.agent.ts are.
 */
export async function getTreatmentPlans(patientId: string) {
  const releases = await listPublishedReleases(patientId);
  return releases.map((r: any) => {
    const items = normalizePlanItems(r.snapshot);
    const stages = enrichStages(items.stages);
    return {
      // The release is the thing on screen, so it is the identity here. The
      // plan id is carried alongside because the clinic side still keys on it.
      id: r.id,
      planId: r.planId,
      version: r.version,
      title: (items as any).title ?? null,
      diagnosis: items.diagnosis ?? null,
      teeth: collectPlanTeeth(stages).length ? collectPlanTeeth(stages) : (items.teeth || []),
      stages,
      // Frozen at approval, not recomputed: this is the number the patient was
      // quoted, and it must not drift if the price list changes afterwards.
      totalBudget: r.totalAmount,
      approvedAt: r.approvedAt,
      publishedAt: r.publishedAt,
      expiresAt: r.expiresAt,
      createdAt: r.approvedAt,
      clinic: r.clinic ?? null,
    };
  });
}

/**
 * `Visit` has no `doctor`/`clinic` relations (only a raw `doctorId` and
 * `patientId`) and no `treatmentPlan`/`procedures`/`prescription` columns —
 * freeform notes live in `treatment`, a Json blob nothing currently writes a
 * fixed shape into. Resolve the doctor's name separately and take the clinic
 * from the patient, which is fixed for the whole call.
 */
export async function getVisits(patientId: string) {
  const patient = await (prisma as any).patient.findUnique({
    where: { id: patientId },
    select: { clinic: { select: { id: true, name: true } } },
  });
  const visits = await (prisma as any).visit.findMany({
    where: { patientId },
    select: {
      id: true, date: true, diagnosis: true, complaints: true, anamnesis: true,
      treatment: true, notes: true, doctorId: true,
    },
    orderBy: { date: 'desc' },
    take: 50,
  });
  const doctorIds = [...new Set(visits.map((v: any) => v.doctorId).filter(Boolean))];
  const doctors = doctorIds.length
    ? await (prisma as any).user.findMany({ where: { id: { in: doctorIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const doctorMap = new Map(doctors.map((d: any) => [d.id, d]));
  return visits.map((v: any) => ({
    id: v.id, date: v.date, diagnosis: v.diagnosis, complaints: v.complaints,
    anamnesis: v.anamnesis, treatment: v.treatment, notes: v.notes,
    doctor: doctorMap.get(v.doctorId) || null,
    clinic: patient?.clinic || null,
  }));
}

export async function getInvoices(patientId: string) {
  const invoices = await (prisma as any).invoice.findMany({
    where: { patientId },
    select: {
      id: true, amount: true, status: true, items: true, createdAt: true,
      clinic: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const summary = {
    total: invoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
    unpaid: invoices
      .filter((i: any) => i.status === 'pending' || i.status === 'unpaid')
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
    paid: invoices
      .filter((i: any) => i.status === 'paid')
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
  };
  return { invoices, summary };
}

/**
 * The columns are `type`/`name`, not `docType`/`title`; aliased in the response
 * so the existing frontend field names keep working.
 */
export async function getDocuments(patientId: string) {
  const docs = await (prisma as any).document.findMany({
    where: { patientId },
    select: {
      id: true, type: true, name: true, url: true,
      signed: true, signedAt: true, signatureData: true, signedByName: true,
      createdAt: true,
      clinic: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return docs.map((d: any) => ({
    id: d.id,
    docType: d.type,
    title: d.name || d.type,
    url: d.url,
    signed: d.signed,
    signedAt: d.signedAt,
    signatureData: d.signatureData,
    signedByName: d.signedByName,
    createdAt: d.createdAt,
    clinic: d.clinic,
  }));
}

export async function getDiagnostics(patientId: string) {
  return (prisma as any).referral.findMany({
    where: { patientId },
    select: {
      id: true, studyType: true, category: true, status: true,
      cost: true, platformFee: true, paid: true, createdAt: true,
      center: { select: { id: true, name: true } },
      lab: { select: { id: true, name: true } },
      result: { select: { reportText: true, conclusion: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
}

/** Statuses a patient can no longer act on — already closed, one way or another. */
const UNCANCELLABLE = ['cancelled', 'completed', 'no_show'];

export class PortalActionError extends Error {
  constructor(message: string, readonly code: 'NOT_FOUND' | 'BAD_STATUS') {
    super(message);
  }
}

/**
 * Cancel one of this patient's appointments.
 *
 * The `patientId` filter is the whole security boundary: an appointment id
 * belonging to someone else simply does not match, so the caller — a route or
 * the assistant — cannot reach another patient's schedule by passing a
 * different id. It is a filter rather than a fetch-then-compare on purpose;
 * the comparison is the step people forget.
 */
export async function cancelAppointment(patientId: string, appointmentId: string) {
  const appt = await (prisma as any).appointment.findFirst({
    where: { id: appointmentId, patientId },
    select: { id: true, status: true, notes: true, date: true, time: true },
  });
  if (!appt) throw new PortalActionError('Запись не найдена', 'NOT_FOUND');
  if (UNCANCELLABLE.includes(appt.status)) {
    throw new PortalActionError('Нельзя отменить запись в этом статусе', 'BAD_STATUS');
  }

  // A confirmed slot the clinic was holding is worth marking as the patient's
  // doing, so reception can tell it apart from their own cancellations.
  const data =
    appt.status === 'confirmed'
      ? { status: 'cancelled', notes: `${appt.notes || ''}\n[Отмена пациентом через портал]`.trim() }
      : { status: 'cancelled' };

  await (prisma as any).appointment.update({ where: { id: appointmentId }, data });
  return { cancelled: true, date: appt.date, time: appt.time };
}

// ─────────────── Booking ───────────────
//
// A request, not an instant appointment — the same shape the public booking
// widget already uses (`Booking`, `status: 'pending'`). Staff confirm it into
// an `Appointment`. Reusing that model rather than writing straight to
// `Appointment` means the assistant cannot place a patient on the calendar
// without a human ever looking at it, and it means slot listing, conflict
// checking and clinic hours all come from the one place already exercised by
// real traffic (`public.routes.ts`) instead of a second implementation that
// could drift from it.

import { mergeClinicSettings } from '../clinics/clinicSettings.js';
import { buildTimeSlots, isWorkingDay, filterAvailableSlots } from '../public/bookingSlots.js';

export interface AvailableSlotsResult {
  date: string;
  workingDay: boolean;
  slots: string[];
}

export async function getAvailableSlots(
  clinicId: string,
  date: string,
  doctorId?: string | null,
): Promise<AvailableSlotsResult> {
  const clinic = await (prisma as any).clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
  if (!clinic) throw new PortalActionError('Клиника не найдена', 'NOT_FOUND');

  const settings = mergeClinicSettings(clinic.settings);
  const day = new Date(`${date}T12:00:00.000Z`);
  if (!isWorkingDay(day, settings)) {
    return { date, workingDay: false, slots: [] };
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const doctorCount = doctorId
    ? 1
    : (await (prisma as any).clinicMember.count({ where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } } })) || 1;

  const [appointments, bookings] = await Promise.all([
    (prisma as any).appointment.findMany({
      where: { clinicId, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['cancelled', 'no_show'] }, ...(doctorId ? { doctorId } : {}) },
      select: { time: true, doctorId: true },
    }),
    (prisma as any).booking.findMany({
      where: { clinicId, date: dayStart, status: { in: ['pending', 'confirmed'] }, ...(doctorId ? { doctorId } : {}) },
      select: { time: true, doctorId: true },
    }),
  ]);

  const occupied = [
    ...appointments.filter((a: any) => a.time).map((a: any) => ({ time: a.time, doctorId: a.doctorId })),
    ...bookings.map((b: any) => ({ time: b.time, doctorId: b.doctorId })),
  ];

  const allSlots = buildTimeSlots(settings);
  return { date, workingDay: true, slots: filterAvailableSlots(allSlots, occupied, doctorId ?? null, doctorCount) };
}

export interface RequestAppointmentInput {
  patientId: string;
  clinicId: string;
  date: string;
  time: string;
  doctorId?: string | null;
  serviceName?: string | null;
  notes?: string | null;
}

/**
 * Files a booking request, re-checking the slot at write time.
 *
 * The list the caller saw came from `getAvailableSlots` moments earlier;
 * between that read and this write somebody else could have taken it. The
 * conflict queries here are the write-side check, same as the public form —
 * a slot is only ever trusted at the instant it is claimed.
 */
export async function requestAppointment(input: RequestAppointmentInput) {
  const [patient, clinic] = await Promise.all([
    (prisma as any).patient.findUnique({
      where: { id: input.patientId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    }),
    (prisma as any).clinic.findUnique({ where: { id: input.clinicId }, select: { settings: true } }),
  ]);
  if (!patient) throw new PortalActionError('Карта пациента не найдена', 'NOT_FOUND');
  if (!clinic) throw new PortalActionError('Клиника не найдена', 'NOT_FOUND');

  const settings = mergeClinicSettings(clinic.settings);
  if (settings.onlineBookingEnabled === false) {
    throw new PortalActionError('Онлайн-запись в этой клинике сейчас недоступна', 'BAD_STATUS');
  }

  const day = new Date(`${input.date}T12:00:00.000Z`);
  if (!isWorkingDay(day, settings)) {
    throw new PortalActionError('Клиника не работает в выбранный день', 'BAD_STATUS');
  }
  if (!buildTimeSlots(settings).includes(input.time)) {
    throw new PortalActionError('Такого времени нет в расписании клиники', 'BAD_STATUS');
  }

  const dayStart = new Date(`${input.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${input.date}T23:59:59.999Z`);

  const [conflictAppt, conflictBooking] = await Promise.all([
    (prisma as any).appointment.findFirst({
      where: {
        clinicId: input.clinicId, date: { gte: dayStart, lte: dayEnd }, time: input.time,
        status: { notIn: ['cancelled', 'no_show'] }, ...(input.doctorId ? { doctorId: input.doctorId } : {}),
      },
    }),
    (prisma as any).booking.findFirst({
      where: {
        clinicId: input.clinicId, date: dayStart, time: input.time,
        status: { in: ['pending', 'confirmed'] }, ...(input.doctorId ? { doctorId: input.doctorId } : {}),
      },
    }),
  ]);
  if (conflictAppt || conflictBooking) {
    throw new PortalActionError('Это время уже занято. Выберите другое.', 'BAD_STATUS');
  }

  let doctorName: string | null = null;
  if (input.doctorId) {
    const member = await (prisma as any).clinicMember.findFirst({
      where: { clinicId: input.clinicId, userId: input.doctorId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!member) throw new PortalActionError('Врач не найден', 'NOT_FOUND');
    doctorName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim();
  }

  const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Пациент';
  const row = await (prisma as any).booking.create({
    data: {
      id: uid(),
      clinicId: input.clinicId,
      patientName,
      phone: patient.phone || '',
      email: patient.email || null,
      doctorId: input.doctorId || null,
      doctorName,
      serviceName: input.serviceName || null,
      date: dayStart,
      time: input.time,
      notes: input.notes || null,
      status: 'pending',
      // Distinguishes a request the assistant filed from one a patient typed
      // into the public widget themselves — staff-facing, not shown to the patient.
      source: 'ai-assistant',
    },
  });

  return { id: row.id, date: input.date, time: row.time, doctorName, status: row.status };
}
