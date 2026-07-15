// ═══════════════════════════════════════════════════════════════
// Public Routes — booking, document signing, clinic info (no auth)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';

export default function publicRoutes(publicBookingLimiter) {
  const router = Router();

  // ─── Get public clinic info ───
  router.get('/clinic/:clinicId', async (req, res) => {
    try {
      const clinic = await prisma.clinic.findFirst({
        where: { id: req.params.clinicId, active: true },
        select: { id: true, name: true, city: true, address: true, phone: true, color: true },
      });
      if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
      const doctors = await prisma.user.findMany({
        where: { clinicId: req.params.clinicId, role: 'doctor', OR: [{ visibility: 'public' }, { visibility: null }] },
        select: { id: true, name: true, spec: true, bio: true, photoUrl: true, experienceYears: true },
        orderBy: { name: 'asc' },
      });
      res.json({ clinic, doctors });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Submit booking ───
  router.post('/booking', publicBookingLimiter, async (req, res) => {
    try {
      const { clinic_id, patient_name, phone, email, doctor_id, service_name, date, time, notes } = req.body;
      if (!clinic_id || !patient_name || !phone || !date || !time) {
        return res.status(400).json({ error: 'Заполните обязательные поля' });
      }
      if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
        return res.status(400).json({ error: 'Некорректный номер телефона' });
      }
      const id = crypto.randomUUID();
      const result = await prisma.booking.create({
        data: {
          id, clinicId: clinic_id, patientName: patient_name, phone, email: email || null,
          doctorId: doctor_id || null, serviceName: service_name || null, date: new Date(date),
          time, notes: notes || null, status: 'pending',
        },
      });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── View document by signing token ───
  router.get('/document/:token', async (req, res) => {
    try {
      const result = await prisma.document.findFirst({
        where: { signatureToken: req.params.token },
        include: { clinic: { select: { name: true, phone: true, address: true } } },
      });
      if (!result) return res.status(404).json({ error: 'Document not found or already signed' });
      res.json({ ...result, clinic_name: result.clinic?.name, clinic_phone: result.clinic?.phone, clinic_address: result.clinic?.address });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
