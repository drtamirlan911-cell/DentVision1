// @ts-nocheck
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import { requireConsent } from '../../middleware/consentGate.js';
import { decryptPatientFields, encryptField } from '../../lib/phi.js';
import { resolvePatientForUser } from './patientLink.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl, storageConfigured } from '../../lib/storage.js';
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
        id: true, date: true, time: true, status: true,
        toothNumber: true, procedureType: true, reason: true, notes: true,
        doctor: { select: { firstName: true, lastName: true } },
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
    return res.json({ ok: true, data: appointments });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Treatments
patientPortalRouter.get('/treatments', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const treatments = await (prisma as any).treatment.findMany({
      where: { patientId: pid },
      select: {
        id: true, toothNumber: true, procedureType: true, cost: true,
        diagnosis: true, notes: true, createdAt: true,
        doctor: { select: { firstName: true, lastName: true } },
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json({ ok: true, data: treatments });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Treatment plans
patientPortalRouter.get('/treatment-plans', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const plans = await (prisma as any).treatmentPlan.findMany({
      where: { patientId: pid },
      select: {
        id: true, title: true, status: true, stages: true, teeth: true,
        createdAt: true,
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ ok: true, data: plans });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Visits
patientPortalRouter.get('/visits', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const visits = await (prisma as any).visit.findMany({
      where: { patientId: pid },
      select: {
        id: true, date: true, diagnosis: true, treatmentPlan: true,
        procedures: true, prescription: true, notes: true,
        doctor: { select: { firstName: true, lastName: true } },
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
    return res.json({ ok: true, data: visits });
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

// Documents
patientPortalRouter.get('/documents', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const docs = await (prisma as any).document.findMany({
      where: { patientId: pid },
      select: {
        id: true, docType: true, title: true, url: true,
        signed: true, signedAt: true, signatureData: true,
        createdAt: true,
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return res.json({ ok: true, data: docs });
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
      select: { url: true, type: true, title: true },
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
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.title || 'document')}.txt"`);
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
