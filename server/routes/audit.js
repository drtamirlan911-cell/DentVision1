// ═══════════════════════════════════════════════════════════════
// Audit & Backup Routes (authenticated, director/superadmin only)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';

export default function auditRoutes(pool, writeAuditLog) {
  const router = Router();

  // ─── Audit Log ───
  router.get('/audit-log', authenticate, requirePermission('view_audit'), requireSameClinic, async (req, res) => {
    try {
      const { clinic_id, limit = 100 } = req.query;
      const result = await pool.query('SELECT * FROM audit_log WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT $2', [clinic_id, parseInt(limit)]);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Backup ───
  router.post('/backup', authenticate, requirePermission('backup'), requireSameClinic, async (req, res) => {
    try {
      const { clinic_id } = req.body;
      if (!clinic_id) return res.status(400).json({ error: 'clinic_id required' });
      const tables = ['patients', 'appointments', 'treatments', 'receipts', 'lab_orders', 'photos', 'expenses', 'inventory', 'debts', 'referrals', 'promotions', 'bookings', 'medical_cards', 'visits', 'documents', 'audit_log'];
      const backup = {};
      for (const t of tables) {
        const result = await pool.query(`SELECT * FROM ${t} WHERE clinic_id = $1`, [clinic_id]);
        backup[t] = result.rows;
      }
      backup.metadata = {
        clinic_id, backup_date: new Date().toISOString(), tables: tables.length,
        records: Object.values(backup).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
      };
      writeAuditLog(clinic_id, req.user.id, req.user.name, 'backup', 'system', null, backup.metadata);
      res.json(backup);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
