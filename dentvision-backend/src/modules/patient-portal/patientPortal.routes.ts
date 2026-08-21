import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import { requireConsent } from '../../middleware/consentGate.js';
import { decryptPatientFields, encryptField } from '../../lib/phi.js';
import { resolvePatientForUser } from './patientLink.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl, storageConfigured } from '../../lib/storage.js';
import * as crossClinicSvc from '../cross-clinic/cross-clinic.service.js';
import * as portalSvc from './patientPortal.service.js';
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
    return res.json({ ok: true, data: await portalSvc.getAppointments(resolvePatientId(req)) });
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
    return res.json({ ok: true, data: await portalSvc.getTreatments(resolvePatientId(req)) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Treatment plans — `stages`/`teeth` are not columns, they live inside the
// `items` JSON blob (see crm.routes.ts::serializePlan for the same unpacking).
// TreatmentPlan also has no direct `clinic` relation; it comes via `patient`.
patientPortalRouter.get('/treatment-plans', ensurePatient, async (req: AuthRequest, res) => {
  try {
    return res.json({ ok: true, data: await portalSvc.getTreatmentPlans(resolvePatientId(req)) });
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
    return res.json({ ok: true, data: await portalSvc.getVisits(resolvePatientId(req)) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Invoices
patientPortalRouter.get('/invoices', ensurePatient, async (req: AuthRequest, res) => {
  try {
    return res.json({ ok: true, data: await portalSvc.getInvoices(resolvePatientId(req)) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Documents — the columns are `type`/`name`, not `docType`/`title`; aliased
// in the response so the existing frontend field names keep working.
patientPortalRouter.get('/documents', ensurePatient, async (req: AuthRequest, res) => {
  try {
    return res.json({ ok: true, data: await portalSvc.getDocuments(resolvePatientId(req)) });
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
    return res.json({ ok: true, data: await portalSvc.getDiagnostics(resolvePatientId(req)) });
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
        phone: phoneHint || null,
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
    const result = await portalSvc.cancelAppointment(resolvePatientId(req), String(req.params.id));
    return res.json({ ok: true, data: result });
  } catch (e: any) {
    if (e instanceof portalSvc.PortalActionError) {
      return res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ ok: false, error: e.message });
    }
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────── Booking: free times, and filing a request ───────────────
//
// Thin wrappers over `portalSvc.getAvailableSlots` / `requestAppointment`,
// which already existed and were already tested but had no HTTP surface — only
// the AI assistant could reach them. The treatment presentation's closing step
// needs the same two calls, and it must use the same service rather than a
// second booking path.
//
// **The clinic is resolved from the patient's own record, never from the body.**
// Taking it from the request would let a signed-in patient file a booking into a
// clinic they have no card at.

async function resolvePatientClinicId(patientId: string): Promise<string | null> {
  const patient = await (prisma as any).patient.findUnique({
    where: { id: patientId },
    select: { clinicId: true },
  });
  return patient?.clinicId ?? null;
}

patientPortalRouter.get('/available-slots', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const clinicId = await resolvePatientClinicId(resolvePatientId(req)!);
    if (!clinicId) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });

    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: 'Ожидается дата в формате YYYY-MM-DD' });
    }
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : null;
    return res.json({ ok: true, data: await portalSvc.getAvailableSlots(clinicId, date, doctorId) });
  } catch (e: any) {
    if (e instanceof portalSvc.PortalActionError) {
      return res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ ok: false, error: e.message });
    }
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Files a **request**, not an appointment.
 *
 * It lands as `Booking(status: 'pending')` — the same thing the public booking
 * widget produces — so a human at the clinic confirms it before it becomes a
 * commitment on the calendar. Nothing here is consent to treatment, and the
 * interface says so in words, not only in code.
 */
patientPortalRouter.post('/appointments/request', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const patientId = resolvePatientId(req)!;
    const clinicId = await resolvePatientClinicId(patientId);
    if (!clinicId) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });

    const body = (req.body || {}) as Record<string, unknown>;
    const date = String(body.date || '');
    const time = String(body.time || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: 'Ожидается дата в формате YYYY-MM-DD' });
    }
    if (!time) return res.status(400).json({ ok: false, error: 'Не выбрано время' });

    const result = await portalSvc.requestAppointment({
      patientId,
      clinicId,
      date,
      time,
      doctorId: body.doctorId ? String(body.doctorId) : null,
      serviceName: body.serviceName ? String(body.serviceName).slice(0, 200) : null,
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      releaseId: body.releaseId ? String(body.releaseId) : null,
    });
    return res.json({ ok: true, data: result });
  } catch (e: any) {
    if (e instanceof portalSvc.PortalActionError) {
      return res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ ok: false, error: e.message });
    }
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
    const ok = await crossClinicSvc.approveRequest(String(req.params.grantId), req.user!.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Запрос не найден' });
    return res.json({ ok: true, data: { approved: true } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.post('/access-requests/:grantId/decline', async (req: AuthRequest, res) => {
  try {
    const ok = await crossClinicSvc.declineRequest(String(req.params.grantId), req.user!.id);
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
    const ok = await crossClinicSvc.revokeGrant(String(req.params.grantId), req.user!.id);
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
