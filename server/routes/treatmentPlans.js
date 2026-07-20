// ═══════════════════════════════════════════════════════════════
// Treatment Plans — CRM MUST (stages, budget, chart link)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

function serialize(plan, patientName) {
  return {
    ...plan,
    patientName: patientName || null,
    stages: Array.isArray(plan.stages) ? plan.stages : (plan.stages || []),
    teeth: plan.teeth || [],
  };
}

export default function treatmentPlanRoutes() {
  const router = Router();

  router.get('/:clinicId/treatment-plans', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinicId } = req.params;
      const where = { clinicId };
      if (req.query.patientId) where.patientId = String(req.query.patientId);
      if (req.query.status) where.status = String(req.query.status);

      const plans = await prisma.treatmentPlan.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 100, 300),
      });
      const patientIds = [...new Set(plans.map((p) => p.patientId))];
      const patients = patientIds.length
        ? await prisma.patient.findMany({
          where: { id: { in: patientIds } },
          select: { id: true, fullName: true },
        })
        : [];
      const nameById = Object.fromEntries(patients.map((p) => [p.id, p.fullName]));
      res.json(plans.map((p) => serialize(p, nameById[p.patientId])));
    } catch (e) {
      console.error('Treatment plans list:', e.message);
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
  });

  router.post('/treatment-plans', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body || {};
      const clinicId = row.clinicId || row.clinic_id || req.user.activeClinicId || req.user.clinicId;
      if (!clinicId) return res.status(400).json({ error: 'clinic_id required' });
      if (!row.patientId && !row.patient_id) return res.status(400).json({ error: 'patientId required' });

      const id = row.id || crypto.randomUUID();
      const data = {
        id,
        clinicId,
        patientId: row.patientId || row.patient_id,
        doctorId: row.doctorId || row.doctor_id || req.user.id,
        title: row.title || 'План лечения',
        status: row.status || 'draft',
        diagnosis: row.diagnosis || null,
        notes: row.notes || null,
        totalBudget: row.totalBudget != null ? Number(row.totalBudget) : (row.total_budget != null ? Number(row.total_budget) : null),
        stages: Array.isArray(row.stages) ? row.stages : [],
        teeth: row.teeth || [],
        updatedAt: new Date(),
      };

      const result = await prisma.treatmentPlan.upsert({
        where: { id },
        update: data,
        create: data,
      });
      const patient = await prisma.patient.findUnique({
        where: { id: data.patientId },
        select: { fullName: true },
      });
      res.json(serialize(result, patient?.fullName));
    } catch (e) {
      console.error('Treatment plan upsert:', e.message);
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
  });

  router.delete('/treatment-plans/:id', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const plan = await prisma.treatmentPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: 'Not found' });
      const clinicId = req.user.activeClinicId || req.user.clinicId;
      const isSuper = req.user.platformRole === 'superadmin' || req.user.role === 'superadmin';
      if (!isSuper && plan.clinicId !== clinicId) return res.status(403).json({ error: 'Forbidden' });
      await prisma.treatmentPlan.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
  });

  return router;
}
