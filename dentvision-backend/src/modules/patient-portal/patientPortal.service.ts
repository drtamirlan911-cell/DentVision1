// @ts-nocheck
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
import { parseMeta } from '../crm/appointmentMeta.js';

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
 */
export async function getTreatments(patientId: string) {
  const patient = await (prisma as any).patient.findUnique({
    where: { id: patientId },
    select: { clinic: { select: { id: true, name: true } } },
  });
  const plans = await (prisma as any).treatmentPlan.findMany({
    where: { patientId },
    select: { id: true, items: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const treatments: any[] = [];
  for (const plan of plans) {
    const items = plan.items || {};
    const diagnosis = items.diagnosis ?? null;
    const stages = Array.isArray(items.stages) ? items.stages : [];
    for (const stage of stages) {
      const stageItems = Array.isArray(stage.items) ? stage.items : [];
      for (const item of stageItems) {
        const teeth = Array.isArray(item.teeth) ? item.teeth : [];
        const units = teeth.length > 0 ? teeth.length : (Number(item.qty) || 1);
        treatments.push({
          id: item.id || `${plan.id}-${treatments.length}`,
          toothNumber: teeth.join(', '),
          procedureType: item.serviceName || '',
          cost: Math.round((Number(item.price) || 0) * units),
          diagnosis,
          notes: stage.notes || null,
          clinic: patient?.clinic || null,
          createdAt: plan.createdAt,
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
 */
export async function getTreatmentPlans(patientId: string) {
  const plans = await (prisma as any).treatmentPlan.findMany({
    where: { patientId },
    select: {
      id: true, title: true, status: true, items: true, price: true, notes: true,
      createdAt: true,
      patient: { select: { clinic: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return plans.map((p: any) => {
    const items = p.items || {};
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      diagnosis: items.diagnosis ?? p.notes ?? null,
      teeth: items.teeth || [],
      stages: items.stages || [],
      totalBudget: p.price ?? items.totalBudget ?? null,
      createdAt: p.createdAt,
      clinic: p.patient?.clinic || null,
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
