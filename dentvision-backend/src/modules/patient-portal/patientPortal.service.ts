import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { parseMeta } from '../crm/appointmentMeta.js';
import { getPublishedRelease, listPublishedReleases } from '../patient-presentation/planRelease.service.js';
import { collectPlanTeeth, enrichStages, lineItemTotal, normalizePlanItems } from '../../lib/treatmentPlanShape.js';
import { mergeClinicSettings } from '../clinics/clinicSettings.js';
import { buildTimeSlots, isWorkingDay, filterAvailableSlots } from '../public/bookingSlots.js';

export class PortalActionError extends Error { constructor(message: string, readonly code: 'NOT_FOUND' | 'BAD_STATUS') { super(message); } }

export async function getAppointments(patientId: string) {
  const rows = await (prisma as any).appointment.findMany({ where: { patientId }, select: { id: true, date: true, time: true, status: true, type: true, notes: true, meta: true, doctor: { select: { firstName: true, lastName: true } }, clinic: { select: { id: true, name: true } } }, orderBy: { date: 'desc' }, take: 50 });
  return rows.map((a: any) => { const meta = parseMeta(a.meta); return { id: a.id, date: a.date, time: a.time, status: a.status, notes: a.notes, doctor: a.doctor, clinic: a.clinic, procedureType: meta.serviceName || a.type || '', toothNumber: meta.toothNumber ?? '', reason: meta.reason || meta.serviceName || a.type || '' }; });
}

export async function getTreatments(patientId: string) {
  const releases = await listPublishedReleases(patientId); const treatments: any[] = [];
  for (const release of releases) { const items = normalizePlanItems(release.snapshot); const diagnosis = items.diagnosis ?? null; for (const stage of items.stages!) for (const item of stage.items || []) { const teeth = Array.isArray(item.teeth) ? item.teeth : []; treatments.push({ id: item.id || `${release.id}-${treatments.length}`, toothNumber: teeth.join(', '), procedureType: item.serviceName || item.name || '', cost: lineItemTotal(item), diagnosis, notes: stage.notes || null, clinic: (release as any).clinic ?? null, createdAt: release.approvedAt }); } }
  treatments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); return treatments.slice(0, 100);
}

export async function getTreatmentPlans(patientId: string) {
  const releases = await listPublishedReleases(patientId); return releases.map((r: any) => { const items = normalizePlanItems(r.snapshot); const stages = enrichStages(items.stages); const teeth = collectPlanTeeth(stages); return { id: r.id, planId: r.planId, version: r.version, title: (items as any).title ?? null, diagnosis: items.diagnosis ?? null, teeth: teeth.length ? teeth : (items.teeth || []), stages, totalBudget: r.totalAmount, approvedAt: r.approvedAt, publishedAt: r.publishedAt, expiresAt: r.expiresAt, createdAt: r.approvedAt, clinic: r.clinic ?? null }; });
}

export async function getVisits(patientId: string) {
  const patient = await (prisma as any).patient.findUnique({ where: { id: patientId }, select: { clinic: { select: { id: true, name: true } } } });
  const visits = await (prisma as any).visit.findMany({ where: { patientId }, select: { id: true, date: true, diagnosis: true, complaints: true, anamnesis: true, treatment: true, notes: true, doctorId: true }, orderBy: { date: 'desc' }, take: 50 });
  const ids = [...new Set(visits.map((v: any) => v.doctorId).filter(Boolean))]; const doctors = ids.length ? await (prisma as any).user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : []; const map = new Map(doctors.map((d: any) => [d.id, d]));
  return visits.map((v: any) => ({ id: v.id, date: v.date, diagnosis: v.diagnosis, complaints: v.complaints, anamnesis: v.anamnesis, treatment: v.treatment, notes: v.notes, doctor: map.get(v.doctorId) || null, clinic: patient?.clinic || null }));
}

export async function getInvoices(patientId: string) {
  const invoices = await (prisma as any).invoice.findMany({ where: { patientId }, select: { id: true, amount: true, status: true, items: true, createdAt: true, clinic: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
  return { invoices, summary: { total: invoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0), unpaid: invoices.filter((i: any) => ['pending', 'unpaid'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.amount || 0), 0), paid: invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount || 0), 0) } };
}

export async function getDocuments(patientId: string) {
  const docs = await (prisma as any).document.findMany({ where: { patientId }, select: { id: true, type: true, name: true, url: true, signed: true, signedAt: true, signatureData: true, signedByName: true, createdAt: true, clinic: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 30 });
  return docs.map((d: any) => ({ id: d.id, docType: d.type, title: d.name || d.type, url: d.url, signed: d.signed, signedAt: d.signedAt, signatureData: d.signatureData, signedByName: d.signedByName, createdAt: d.createdAt, clinic: d.clinic }));
}

export async function getDiagnostics(patientId: string) {
  const referrals = await (prisma as any).referral.findMany({ where: { patientId }, select: { id: true, studyType: true, category: true, status: true, cost: true, paid: true, createdAt: true, center: { select: { id: true, name: true } }, lab: { select: { id: true, name: true } }, result: { select: { doctorConfirmed: true, reportText: true, conclusion: true, createdAt: true } } }, orderBy: { createdAt: 'desc' }, take: 30 });
  return referrals.map((r: any) => ({ ...r, result: r.result?.doctorConfirmed ? { reportText: r.result.reportText, conclusion: r.result.conclusion, createdAt: r.result.createdAt } : null, resultPendingConfirmation: Boolean(r.result && !r.result.doctorConfirmed) }));
}

export async function cancelAppointment(patientId: string, appointmentId: string) {
  const appt = await (prisma as any).appointment.findFirst({ where: { id: appointmentId, patientId }, select: { id: true, status: true, notes: true, date: true, time: true } });
  if (!appt) throw new PortalActionError('Запись не найдена', 'NOT_FOUND');
  if (['cancelled', 'completed', 'no_show'].includes(appt.status)) throw new PortalActionError('Нельзя отменить запись в этом статусе', 'BAD_STATUS');
  await (prisma as any).appointment.update({ where: { id: appointmentId }, data: { status: 'cancelled', notes: `${appt.notes || ''}\n[Отмена пациентом через портал]`.trim() } }); return { cancelled: true, date: appt.date, time: appt.time };
}

export interface AvailableSlotsResult { date: string; workingDay: boolean; slots: string[]; }
export async function getAvailableSlots(clinicId: string, date: string, doctorId?: string | null): Promise<AvailableSlotsResult> {
  const clinic = await (prisma as any).clinic.findUnique({ where: { id: clinicId }, select: { settings: true } }); if (!clinic) throw new PortalActionError('Клиника не найдена', 'NOT_FOUND'); const settings = mergeClinicSettings(clinic.settings); const day = new Date(`${date}T12:00:00.000Z`); if (!isWorkingDay(day, settings)) return { date, workingDay: false, slots: [] };
  const dayStart = new Date(`${date}T00:00:00.000Z`); const dayEnd = new Date(`${date}T23:59:59.999Z`); const doctorCount = doctorId ? 1 : (await (prisma as any).clinicMember.count({ where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } } })) || 1;
  const [appointments, bookings] = await Promise.all([(prisma as any).appointment.findMany({ where: { clinicId, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['cancelled', 'no_show'] }, ...(doctorId ? { doctorId } : {}) }, select: { time: true, doctorId: true } }), (prisma as any).booking.findMany({ where: { clinicId, date: dayStart, status: { in: ['pending', 'confirmed'] }, ...(doctorId ? { doctorId } : {}) }, select: { time: true, doctorId: true } })]); const occupied = [...appointments.filter((a: any) => a.time).map((a: any) => ({ time: a.time, doctorId: a.doctorId })), ...bookings.map((b: any) => ({ time: b.time, doctorId: b.doctorId }))]; return { date, workingDay: true, slots: filterAvailableSlots(buildTimeSlots(settings), occupied, doctorId ?? null, doctorCount) };
}

export interface RequestAppointmentInput { patientId: string; clinicId: string; date: string; time: string; doctorId?: string | null; serviceName?: string | null; notes?: string | null; releaseId?: string | null; }
export async function requestAppointment(input: RequestAppointmentInput) {
  const [patient, clinic] = await Promise.all([(prisma as any).patient.findUnique({ where: { id: input.patientId }, select: { firstName: true, lastName: true, phone: true, email: true, clinicId: true } }), (prisma as any).clinic.findUnique({ where: { id: input.clinicId }, select: { settings: true } })]);
  if (!patient) throw new PortalActionError('Карта пациента не найдена', 'NOT_FOUND'); if (!clinic) throw new PortalActionError('Клиника не найдена', 'NOT_FOUND'); if (patient.clinicId && patient.clinicId !== input.clinicId) throw new PortalActionError('Пациент не относится к выбранной клинике', 'NOT_FOUND');
  const settings = mergeClinicSettings(clinic.settings); if (settings.onlineBookingEnabled === false) throw new PortalActionError('Онлайн-запись в этой клинике сейчас недоступна', 'BAD_STATUS'); const day = new Date(`${input.date}T12:00:00.000Z`); if (!isWorkingDay(day, settings)) throw new PortalActionError('Клиника не работает в выбранный день', 'BAD_STATUS'); if (!buildTimeSlots(settings).includes(input.time)) throw new PortalActionError('Такого времени нет в расписании клиники', 'BAD_STATUS');
  const dayStart = new Date(`${input.date}T00:00:00.000Z`); const dayEnd = new Date(`${input.date}T23:59:59.999Z`); const [conflictAppt, conflictBooking] = await Promise.all([(prisma as any).appointment.findFirst({ where: { clinicId: input.clinicId, date: { gte: dayStart, lte: dayEnd }, time: input.time, status: { notIn: ['cancelled', 'no_show'] }, ...(input.doctorId ? { doctorId: input.doctorId } : {}) } }), (prisma as any).booking.findFirst({ where: { clinicId: input.clinicId, date: dayStart, time: input.time, status: { in: ['pending', 'confirmed'] }, ...(input.doctorId ? { doctorId: input.doctorId } : {}) } })]); if (conflictAppt || conflictBooking) throw new PortalActionError('Это время уже занято. Выберите другое.', 'BAD_STATUS');
  let doctorName: string | null = null; if (input.doctorId) { const member = await (prisma as any).clinicMember.findFirst({ where: { clinicId: input.clinicId, userId: input.doctorId }, include: { user: { select: { firstName: true, lastName: true } } } }); if (!member) throw new PortalActionError('Врач не найден', 'NOT_FOUND'); doctorName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim(); }
  let releaseId: string | null = null; if (input.releaseId) { const release = await getPublishedRelease(input.patientId, input.releaseId); releaseId = release?.id ?? null; }
  const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Пациент'; const row = await (prisma as any).booking.create({ data: { id: uid(), clinicId: input.clinicId, patientName, phone: patient.phone || '', email: patient.email || null, doctorId: input.doctorId || null, doctorName, serviceName: input.serviceName || null, date: dayStart, time: input.time, notes: input.notes || null, status: 'pending', releaseId, source: 'ai-assistant' } }); return { id: row.id, date: input.date, time: row.time, doctorName, status: row.status };
}
