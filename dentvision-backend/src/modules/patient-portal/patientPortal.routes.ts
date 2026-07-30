// @ts-nocheck
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { env } from '../../config.js';
import type { ApiResponse } from '../../types/index.js';

export const patientPortalRouter = Router();

function generatePatientToken(patientId: string, clinicId: string) {
  return jwt.sign({ patientId, clinicId }, env.JWT_SECRET, { expiresIn: '24h' });
}

// Login by email/phone + IIN (find matching patients across clinics)
patientPortalRouter.post('/login', async (req, res) => {
  try {
    const { email, phone, iin } = req.body;
    if (!email && !phone && !iin) {
      return res.status(400).json({ ok: false, error: 'Email, phone or IIN required' });
    }

    const patients = await (prisma as any).patient.findMany({
      where: {
        ...(iin ? { patientIin: iin } : {}),
        ...(email ? { patientEmail: email } : {}),
        ...(phone ? { patientPhone: phone } : {}),
      },
      select: { id: true, patientName: true, clinicId: true },
      take: 20,
    });

    if (patients.length === 0) {
      return res.status(404).json({ ok: false, error: 'Patient not found' });
    }

    const primary = patients[0];
    const token = generatePatientToken(primary.id, primary.clinicId);

    return res.json({
      ok: true,
      data: {
        token,
        patientId: primary.id,
        patientName: primary.patientName,
        clinicIds: patients.map((p: any) => p.clinicId),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Verify patient token middleware
function patientAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ ok: false, error: 'Token required' });
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    req.patientId = decoded.patientId;
    req.clinicId = decoded.clinicId;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}
patientPortalRouter.use(patientAuth);

// Get patient data
patientPortalRouter.get('/me', async (req: any, res) => {
  try {
    const patient = await (prisma as any).patient.findUnique({
      where: { id: req.patientId },
    });
    if (!patient) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, data: patient });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Appointments
patientPortalRouter.get('/appointments', async (req: any, res) => {
  try {
    const appointments = await (prisma as any).appointment.findMany({
      where: { patientId: req.patientId },
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

// Treatment history
patientPortalRouter.get('/treatments', async (req: any, res) => {
  try {
    const treatments = await (prisma as any).treatment.findMany({
      where: { patientId: req.patientId },
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
patientPortalRouter.get('/treatment-plans', async (req: any, res) => {
  try {
    const plans = await (prisma as any).treatmentPlan.findMany({
      where: { patientId: req.patientId },
      select: {
        id: true, title: true, status: true, stages: true, teeth: true,
        createdAt: true, updatedAt: true,
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

// Medical visits
patientPortalRouter.get('/visits', async (req: any, res) => {
  try {
    const visits = await (prisma as any).visit.findMany({
      where: { patientId: req.patientId },
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

// Invoices / payments
patientPortalRouter.get('/invoices', async (req: any, res) => {
  try {
    const invoices = await (prisma as any).invoice.findMany({
      where: { patientId: req.patientId },
      select: {
        id: true, amount: true, status: true, items: true,
        createdAt: true,
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
patientPortalRouter.get('/documents', async (req: any, res) => {
  try {
    const documents = await (prisma as any).document.findMany({
      where: { patientId: req.patientId },
      select: {
        id: true, docType: true, title: true, signedAt: true, createdAt: true,
        clinic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return res.json({ ok: true, data: documents });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Dental chart (odontogram)
patientPortalRouter.get('/chart', async (req: any, res) => {
  try {
    const teeth = await (prisma as any).tooth.findMany({
      where: { patientId: req.patientId },
      select: { id: true, toothNumber: true, status: true, surfaces: true, notes: true },
    });
    return res.json({ ok: true, data: teeth });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Diagnostics referrals sent for this patient
patientPortalRouter.get('/diagnostics', async (req: any, res) => {
  try {
    const referrals = await (prisma as any).referral.findMany({
      where: { patientId: req.patientId },
      select: {
        id: true, studyType: true, category: true, status: true,
        cost: true, platformFee: true, paid: true,
        createdAt: true,
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

// Chat messages with clinic
patientPortalRouter.get('/chat/:clinicId', async (req: any, res) => {
  try {
    const messages = await (prisma as any).dmMessage.findMany({
      where: {
        OR: [
          { senderId: req.patientId },
          { recipientId: req.patientId },
        ],
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return res.json({ ok: true, data: messages });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

patientPortalRouter.post('/chat/:clinicId', async (req: any, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ ok: false, error: 'Text required' });
    const msg = await (prisma as any).dmMessage.create({
      data: {
        senderId: req.patientId,
        recipientId: req.params.clinicId,
        content: text,
        channel: 'patient_portal',
      },
    });
    return res.json({ ok: true, data: msg });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});
