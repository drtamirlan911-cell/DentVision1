// @ts-nocheck
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';

export const patientPortalRouter = Router();
patientPortalRouter.use(authenticate);

async function getPatientRecord(userId: string) {
  const patient = await (prisma as any).patient.findFirst({
    where: { userId },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      email: true, iin: true, clinicId: true,
      clinic: { select: { id: true, name: true } },
    },
  });
  return patient;
}

// Patient profile
patientPortalRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    const patient = await getPatientRecord(req.user!.id);
    if (!patient) {
      // Fallback: find by email
      const byEmail = await (prisma as any).patient.findFirst({
        where: { email: req.user!.email },
        select: {
          id: true, firstName: true, lastName: true, phone: true,
          email: true, iin: true, clinicId: true,
          clinic: { select: { id: true, name: true } },
        },
      });
      if (!byEmail) return res.json({ ok: true, data: { noPatientRecord: true } });
      return res.json({ ok: true, data: byEmail });
    }
    return res.json({ ok: true, data: patient });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

function resolvePatientId(req: AuthRequest): string | null {
  return (req as any)._patientId || req.user?.id || null;
}

async function ensurePatient(req: AuthRequest, res: any, next: any) {
  const patient = await getPatientRecord(req.user!.id);
  if (!patient) {
    const byEmail = await (prisma as any).patient.findFirst({ where: { email: req.user!.email } });
    if (!byEmail) return res.status(403).json({ ok: false, error: 'Patient record not found. Ask your clinic to link your account.' });
    (req as any)._patientId = byEmail.id;
    return next();
  }
  (req as any)._patientId = patient.id;
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
        id: true, docType: true, title: true, signedAt: true, createdAt: true,
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
