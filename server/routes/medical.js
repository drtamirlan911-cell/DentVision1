// ═══════════════════════════════════════════════════════════════
// Medical Routes — ICD-10, Medical Cards, Visits, Documents
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

function sanitizeColumnName(col) { return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col); }

export default function medicalRoutes(writeAuditLog) {
  const router = Router();

  // ─── ICD-10 (public read for autocomplete) ───
  router.get('/icd10', async (req, res) => {
    try {
      const { search } = req.query;
      let results;
      if (search && search.length >= 2) {
        results = await prisma.$queryRawUnsafe(
          `SELECT * FROM icd10 WHERE code ILIKE $1 OR name ILIKE $1 ORDER BY code LIMIT 50`,
          `%${search}%`
        );
      } else {
        results = await prisma.icd10.findMany({ orderBy: { code: 'asc' }, take: 200 });
      }
      res.json(results);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Medical Card ───
  router.get('/medical-cards/:patientId', authenticate, async (req, res) => {
    try {
      const result = await prisma.medicalCard.findFirst({
        where: { patientId: req.params.patientId },
        orderBy: { updatedAt: 'desc' },
      });
      res.json(result || null);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/medical-cards/upsert', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body;
      const result = await prisma.medicalCard.upsert({
        where: { id: row.id || 'new' },
        update: {
          bloodType: row.blood_type, allergies: row.allergies, chronicDiseases: row.chronic_diseases,
          medications: row.medications, pastSurgeries: row.past_surgeries, familyHistory: row.family_history,
          emergencyContact: row.emergency_contact, emergencyPhone: row.emergency_phone,
          insuranceProvider: row.insurance_provider, insuranceNumber: row.insurance_number, notes: row.notes,
        },
        create: {
          id: row.id, patientId: row.patient_id, clinicId: row.clinic_id,
          bloodType: row.blood_type, allergies: row.allergies, chronicDiseases: row.chronic_diseases,
          medications: row.medications, pastSurgeries: row.past_surgeries, familyHistory: row.family_history,
          emergencyContact: row.emergency_contact, emergencyPhone: row.emergency_phone,
          insuranceProvider: row.insurance_provider, insuranceNumber: row.insurance_number, notes: row.notes,
        },
      });
      writeAuditLog(row.clinic_id, req.user.id, req.user.name, 'upsert', 'medical_card', row.id, { patient_id: row.patient_id });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Visits ───
  router.get('/visits', authenticate, async (req, res) => {
    try {
      const { clinic_id, patient_id } = req.query;
      if (req.user.role !== 'superadmin' && clinic_id && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const where = {};
      if (clinic_id) where.clinicId = clinic_id;
      if (patient_id) where.patientId = patient_id;
      const results = await prisma.visit.findMany({
        where,
        include: { patient: { select: { fullName: true } }, doctor: { select: { name: true } } },
        orderBy: { visitDate: 'desc' },
        take: 200,
      });
      res.json(results.map(v => ({ ...v, patient_name: v.patient?.fullName, doctor_name: v.doctor?.name })));
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/visits/upsert', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body;
      const id = row.id || crypto.randomUUID();
      const result = await prisma.visit.upsert({
        where: { id },
        update: {
          chiefComplaint: row.chief_complaint, diagnosis: row.diagnosis, icd10Codes: row.icd10_codes,
          treatmentPlan: row.treatment_plan, proceduresDone: row.procedures_done,
          prescriptions: row.prescriptions, nextVisitDate: row.next_visit_date ? new Date(row.next_visit_date) : null,
          notes: row.notes,
        },
        create: {
          id, clinicId: row.clinic_id, patientId: row.patient_id, doctorId: row.doctor_id || null,
          appointmentId: row.appointment_id || null, chiefComplaint: row.chief_complaint, diagnosis: row.diagnosis,
          icd10Codes: row.icd10_codes, treatmentPlan: row.treatment_plan, proceduresDone: row.procedures_done,
          prescriptions: row.prescriptions, nextVisitDate: row.next_visit_date ? new Date(row.next_visit_date) : null,
          notes: row.notes,
        },
      });
      writeAuditLog(row.clinic_id, req.user.id, req.user.name, 'create_visit', 'visit', id, { patient_id: row.patient_id, diagnosis: row.diagnosis });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Documents ───
  router.get('/documents', authenticate, async (req, res) => {
    try {
      const { clinic_id, patient_id } = req.query;
      if (req.user.role !== 'superadmin' && clinic_id && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const where = {};
      if (clinic_id) where.clinicId = clinic_id;
      if (patient_id) where.patientId = patient_id;
      const results = await prisma.document.findMany({
        where,
        include: { patient: { select: { fullName: true } }, doctor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      res.json(results.map(d => ({ ...d, patient_name: d.patient?.fullName, doctor_name: d.doctor?.name })));
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/documents/upsert', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body;
      const result = await prisma.document.upsert({
        where: { id: row.id || 'new' },
        update: {
          clinicId: row.clinic_id, patientId: row.patient_id, doctorId: row.doctor_id,
          docType: row.doc_type, title: row.title, content: row.content, fileUrl: row.file_url,
          status: row.status, patientName: row.patient_name,
        },
        create: {
          id: row.id, clinicId: row.clinic_id, patientId: row.patient_id, doctorId: row.doctor_id,
          docType: row.doc_type, title: row.title, content: row.content, fileUrl: row.file_url,
          status: row.status, patientName: row.patient_name,
        },
      });
      writeAuditLog(row.clinic_id, req.user.id, req.user.name, 'upsert', 'document', row.id, { title: row.title, doc_type: row.doc_type });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.delete('/documents/:id', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const result = await prisma.document.delete({ where: { id: req.params.id } });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Document Signature ───
  router.post('/documents/:id/send-signature', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const token = crypto.randomUUID();
      const result = await prisma.document.update({
        where: { id: req.params.id },
        data: { signatureToken: token, status: 'pending_signature' },
      });
      const baseUrl = process.env.SIGNING_BASE_URL || req.headers.origin || 'https://dent-vision1.vercel.app';
      res.json({ document: result, signingUrl: `${baseUrl}/sign/${token}` });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.put('/documents/:id/sign', async (req, res) => {
    try {
      const { signature_data, signed_by_name, token } = req.body;
      if (!signature_data) return res.status(400).json({ error: 'signature_data required' });
      let result;
      if (token) {
        // Public signing via token (no auth required — patient-facing)
        result = await prisma.document.update({
          where: { signatureToken: token },
          data: { signatureData: signature_data, signedAt: new Date(), signedByName: signed_by_name || 'Пациент', status: 'signed', signatureToken: null },
        });
      } else {
        // Internal signing requires authentication
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        result = await prisma.document.update({
          where: { id: req.params.id },
          data: { signatureData: signature_data, signedAt: new Date(), signedByName: signed_by_name || req.user.name, status: 'signed' },
        });
      }
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
