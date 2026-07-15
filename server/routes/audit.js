// ═══════════════════════════════════════════════════════════════
// Audit & Backup Routes (authenticated, director/superadmin only)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

export default function auditRoutes(writeAuditLog) {
  const router = Router();

  // ─── Audit Log ───
  router.get('/audit-log', authenticate, requirePermission('view_audit'), requireSameClinic, async (req, res) => {
    try {
      const { clinic_id, limit = 100 } = req.query;
      const result = await prisma.auditLog.findMany({
        where: { clinicId: clinic_id },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Backup ───
  router.post('/backup', authenticate, requirePermission('backup'), requireSameClinic, async (req, res) => {
    try {
      const { clinic_id } = req.body;
      if (!clinic_id) return res.status(400).json({ error: 'clinic_id required' });
      const [patients, appointments, treatments, receipts, labOrders, photos, expenses, inventory, debts, referrals, promotions, bookings, medicalCards, visits, documents, auditLogs] = await Promise.all([
        prisma.patient.findMany({ where: { clinicId: clinic_id } }),
        prisma.appointment.findMany({ where: { clinicId: clinic_id } }),
        prisma.treatment.findMany({ where: { clinicId: clinic_id } }),
        prisma.receipt.findMany({ where: { clinicId: clinic_id } }),
        prisma.labOrder.findMany({ where: { clinicId: clinic_id } }),
        prisma.photo.findMany({ where: { clinicId: clinic_id } }),
        prisma.expense.findMany({ where: { clinicId: clinic_id } }),
        prisma.inventory.findMany({ where: { clinicId: clinic_id } }),
        prisma.debt.findMany({ where: { clinicId: clinic_id } }),
        prisma.referral.findMany({ where: { clinicId: clinic_id } }),
        prisma.promotion.findMany({ where: { clinicId: clinic_id } }),
        prisma.booking.findMany({ where: { clinicId: clinic_id } }),
        prisma.medicalCard.findMany({ where: { clinicId: clinic_id } }),
        prisma.visit.findMany({ where: { clinicId: clinic_id } }),
        prisma.document.findMany({ where: { clinicId: clinic_id } }),
        prisma.auditLog.findMany({ where: { clinicId: clinic_id } }),
      ]);
      const backup = { patients, appointments, treatments, receipts, lab_orders: labOrders, photos, expenses, inventory, debts, referrals, promotions, bookings, medical_cards: medicalCards, visits, documents, audit_log: auditLogs };
      const totalRecords = Object.values(backup).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      backup.metadata = { clinic_id, backup_date: new Date().toISOString(), tables: 16, records: totalRecords };
      writeAuditLog(clinic_id, req.user.id, req.user.name, 'backup', 'system', null, backup.metadata);
      res.json(backup);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
