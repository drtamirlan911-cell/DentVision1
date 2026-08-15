// @ts-nocheck
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import { requireConsent } from '../../middleware/consentGate.js';
import { decryptPatientFields, encryptField } from '../../lib/phi.js';
import { resolvePatientForUser } from './patientLink.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl, storageConfigured } from '../../lib/storage.js';
import * as crossClinicSvc from '../cross-clinic/cross-clinic.service.js';
import { parseMeta } from '../crm/appointmentMeta.js';
import type { AuthRequest } from '../../types/index.js';

export const patientPortalRouter = Router();
patientPortalRouter.use(authenticate);
patientPortalRouter.use(requireConsent());

/**
 * This user's patient card, linking it by email or phone on first sight.
 *
 * The three call sites below each used to do their own `findFirst({ userId })`
 * with an email fallback that never wrote the link down — so the fallback ran
 * again on every request, and a patient entered by phone alone matched nothing.
 * See patientLink.ts.
 */
async function getPatientRecord(user: { id: string; email?: string | null; phone?: string | null }) {
  const match = await resolvePatientForUser(user);
  if (!match) return null;
  const patient = await (prisma as any).patient.findUnique({
    where: { id: match.id },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      email: true, iin: true, medicalHistory: true, clinicId: true,
      clinic: { select: { id: true, name: true } },
    },
  });
  return decryptPatientFields(patient);
}

// Patient profile
patientPortalRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    const patient = await getPatientRecord(req.user!);
    if (!patient) return res.json({ ok: true, data: { noPatientRecord: true } });
    return res.json({ ok: true, data: patient });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

function resolvePatientId(req: AuthRequest): string | null {
  return (req as any)._patientId || req.user?.id || null;
}

async function ensurePatient(req: AuthRequest, res: any, next: any) {
  const match = await resolvePatientForUser(req.user!);
  if (!match) {
    return res.status(403).json({ ok: false, error: 'Patient record not found. Ask your clinic to link your account.' });
  }
  (req as any)._patientId = match.id;
  return next();
}

// Appointments
patientPortalRouter.get('/appointments', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const appointments = await (prisma as any).appointment.findMany({
      where: { patientId: pid },
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
    const mapped = appointments.map((a: any) => {
      const meta = parseMeta(a.meta);
      return {
        id: a.id, date: a.date, time: a.time, status: a.status, notes: a.notes,
        doctor: a.doctor, clinic: a.clinic,
        procedureType: meta.serviceName || a.type || '',
        toothNumber: meta.toothNumber ?? '',
        reason: meta.reason || meta.serviceName || a.type || '',
      };
    });
    return res.json({ ok: true, data: mapped });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Treatments — there is no dedicated `Treatment` model; individual procedures
// live nested inside `TreatmentPlan.items.stages[].items[]` (see crm.routes.ts,
// where a plan is built and serialized). Flatten every stage line item across
// all of the patient's plans into the flat list the portal displays.
patientPortalRouter.get('/treatments', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const patient = await (prisma as any).patient.findUnique({
      where: { id: pid },
      select: { clinic: { select: { id: true, name: true } } },
    });
    const plans = await (prisma as any).treatmentPlan.findMany({
      where: { patientId: pid },
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
    return res.json({ ok: true, data: treatments.slice(0, 100) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Treatment plans — `stages`/`teeth` are not columns, they live inside the
// `items` JSON blob (see crm.routes.ts::serializePlan for the same unpacking).
// TreatmentPlan also has no direct `clinic` relation; it comes via `patient`.
patientPortalRouter.get('/treatment-plans', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const plans = await (prisma as any).treatmentPlan.findMany({
      where: { patientId: pid },
      select: {
        id: true, title: true, status: true, items: true, price: true, notes: true,
        createdAt: true,
        patient: { select: { clinic: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const mapped = plans.map((p: any) => {
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
    return res.json({ ok: true, data: mapped });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Visits — `Visit` has no `doctor`/`clinic` relations (only a raw `doctorId`
// and `patientId`) and no `treatmentPlan`/`procedures`/`prescription` columns
// (freeform notes live in `treatment`, a Json blob nothing currently writes a
// fixed shape into). Resolve the doctor's name separately and take the clinic
// from the patient, which is fixed for this whole request.
patientPortalRouter.get('/visits', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const patient = await (prisma as any).patient.findUnique({
      where: { id: pid },
      select: { clinic: { select: { id: true, name: true } } },
    });
    const visits = await (prisma as any).visit.findMany({
      where: { patientId: pid },
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
    const mapped = visits.map((v: any) => ({
      id: v.id, date: v.date, diagnosis: v.diagnosis, complaints: v.complaints,
      anamnesis: v.anamnesis, treatment: v.treatment, notes: v.notes,
      doctor: doctorMap.get(v.doctorId) || null,
      clinic: patient?.clinic || null,
    }));
    return res.json({ ok: true, data: mapped });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Invoices
patientPortalRouter.get('/invoices', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const invoices = await (prisma as any).invoice.findMany({
      where: { patientId: pid },
      select: {
        id: true, amount: true, status: true, items: true, createdAt: true,
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const summary = {
      total: invoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      unpaid: invoices.filter((i: any) => i.status === 'pending' || i.status === 'unpaid').reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      paid: invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
    };
    return res.json({ ok: true, data: { invoices, summary } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Documents — the columns are `type`/`name`, not `docType`/`title`; aliased
// in the response so the existing frontend field names keep working.
patientPortalRouter.get('/documents', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const docs = await (prisma as any).document.findMany({
      where: { patientId: pid },
      select: {
        id: true, type: true, name: true, url: true,
        signed: true, signedAt: true, signatureData: true, signedByName: true,
        createdAt: true,
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const mapped = docs.map((d: any) => ({
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
    return res.json({ ok: true, data: mapped });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Document content (decodes data:text/plain;... URLs for viewing/download)
patientPortalRouter.get('/documents/:id/content', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const doc = await (prisma as any).document.findFirst({
      where: { id: req.params.id, patientId: pid },
      select: { url: true, type: true, name: true },
    });
    if (!doc) return res.status(404).json({ ok: false, error: 'Документ не найден' });

    const url = String(doc.url || '');
    // data:text/plain;charset=utf-8;base64,... or data:text/plain;charset=utf-8,...
    if (url.startsWith('data:text/plain')) {
      const base64Match = url.match(/;base64,(.+)$/);
      const content = base64Match
        ? Buffer.from(base64Match[1], 'base64').toString('utf-8')
        : decodeURIComponent(url.replace(/^data:text\/plain;charset=utf-8,/, ''));
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name || 'document')}.txt"`);
      return res.send(content);
    }
    // External URL — redirect
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return res.redirect(url);
    }
    // S3-backed upload — patient identity was already resolved above.
    if (isStorageKey(url)) {
      if (!storageConfigured()) {
        return res.status(503).json({ ok: false, error: 'Файловое хранилище не настроено' });
      }
      const signed = await signedDownloadUrl(keyFromStorageUrl(url));
      return res.redirect(signed);
    }
    return res.status(410).json({ ok: false, error: 'Документ недоступен для скачивания' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Diagnostics referrals
patientPortalRouter.get('/diagnostics', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const referrals = await (prisma as any).referral.findMany({
      where: { patientId: pid },
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
    return res.json({ ok: true, data: referrals });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────── Profile update ───────────────
patientPortalRouter.put('/me/profile', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    if (body.phone !== undefined) data.phone = String(body.phone);
    if (body.email !== undefined) data.email = String(body.email);
    if (body.address !== undefined) data.address = String(body.address);
    if (body.medicalHistory !== undefined) data.medicalHistory = encryptField(String(body.medicalHistory));
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: 'Нет полей для обновления' });
    }
    await (prisma as any).patient.update({ where: { id: pid }, data });
    return res.json({ ok: true, data: { updated: Object.keys(data) } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────── Clinic search for linking ───────────────
patientPortalRouter.get('/clinics', async (req: AuthRequest, res) => {
  try {
    const search = String(req.query.search || '').trim();
    if (!search || search.length < 2) {
      return res.json({ ok: true, data: [] });
    }
    const clinics = await (prisma as any).clinic.findMany({
      where: { name: { contains: search, mode: 'insensitive' } },
      select: { id: true, name: true, city: true },
      take: 10,
    });
    return res.json({ ok: true, data: clinics });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────── Clinic linking ───────────────
patientPortalRouter.post('/link', async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const clinicId = body.clinicId as string;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
    }

    const clinic = await (prisma as any).clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true },
    });
    if (!clinic) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });

    const user = req.user!;
    // The phone the patient used when booking. It is the identifier reception
    // records most reliably — email is optional on the public booking form —
    // so it is the one that finds an existing card.
    const phoneHint = typeof body.phone === 'string' ? body.phone : null;

    // Existing card first: already linked, or held by this person's email or
    // phone and not yet claimed. Creating a second card in the same clinic
    // hides the patient's own visits, invoices and images from them.
    const match = await resolvePatientForUser(user, { clinicId: clinic.id, phoneHint });
    if (match) {
      return res.json({
        ok: true,
        data: {
          patientId: match.id,
          clinicName: clinic.name,
          alreadyLinked: match.via === 'userId',
          linkedExisting: match.via !== 'userId',
          matchedBy: match.via,
        },
      });
    }

    // Nothing to adopt — a genuinely new patient of this clinic.
    const patient = await (prisma as any).patient.create({
      data: {
        id: uid(),
        clinicId: clinic.id,
        userId: user.id,
        firstName: user.firstName || user.email?.split('@')[0] || 'Пациент',
        lastName: user.lastName || '',
        email: user.email || null,
        phone: phoneHint || user.phone || null,
      },
      select: { id: true },
    });

    return res.json({ ok: true, data: { patientId: patient.id, clinicName: clinic.name, created: true } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────── Cancel appointment ───────────────
patientPortalRouter.post('/appointments/:id/cancel', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const appointmentId = req.params.id;
    const appt = await (prisma as any).appointment.findFirst({
      where: { id: appointmentId, patientId: pid },
    });
    if (!appt) return res.status(404).json({ ok: false, error: 'Запись не найдена' });
    if (appt.status === 'cancelled' || appt.status === 'completed' || appt.status === 'no_show') {
      return res.status(400).json({ ok: false, error: 'Нельзя отменить запись в этом статусе' });
    }
    if (appt.status === 'confirmed') {
      // Allow cancellation but mark as patient-requested
      await (prisma as any).appointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled', notes: `${appt.notes || ''}\n[Отмена пациентом через портал]`.trim() },
      });
    } else {
      await (prisma as any).appointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled' },
      });
    }
    return res.json({ ok: true, data: { cancelled: true } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────── Cross-clinic access requests (patient consent) ───────────────
// These operate on req.user!.id directly — the portal *account*, not the
// per-clinic `_patientId` resolved by `ensurePatient` — because a grant is
// consent from the person, and one person can be `patientUserId` on grants
// naming several different source clinics at once.

patientPortalRouter.get('/access-requests', async (req: AuthRequest, res) => {
  try {
    const requests = await crossClinicSvc.listAccessRequests(req.user!.id);
    return res.json({ ok: true, data: requests });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.post('/access-requests/:grantId/approve', async (req: AuthRequest, res) => {
  try {
    const ok = await crossClinicSvc.approveRequest(req.params.grantId, req.user!.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Запрос не найден' });
    return res.json({ ok: true, data: { approved: true } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.post('/access-requests/:grantId/decline', async (req: AuthRequest, res) => {
  try {
    const ok = await crossClinicSvc.declineRequest(req.params.grantId, req.user!.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Запрос не найден' });
    return res.json({ ok: true, data: { declined: true } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.get('/access-grants', async (req: AuthRequest, res) => {
  try {
    const grants = await crossClinicSvc.listAccessGrants(req.user!.id);
    return res.json({ ok: true, data: grants });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.post('/access-grants/:grantId/revoke', async (req: AuthRequest, res) => {
  try {
    // Fail-closed by design: requireCrossClinicAccess() re-queries this exact
    // grant (status='APPROVED', revokedAt=null) on every read, so the very
    // next request the receiving clinic makes after this succeeds gets 403 —
    // there is no cache to invalidate.
    const ok = await crossClinicSvc.revokeGrant(req.params.grantId, req.user!.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Доступ не найден' });
    return res.json({ ok: true, data: { revoked: true } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.get('/access-log', async (req: AuthRequest, res) => {
  try {
    const log = await crossClinicSvc.getAccessLog(req.user!.id);
    return res.json({ ok: true, data: log });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});
