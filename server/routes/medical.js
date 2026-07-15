// ═══════════════════════════════════════════════════════════════
// Medical Routes — ICD-10, Medical Cards, Visits, Documents
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';

function sanitizeColumnName(col) { return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col); }

export default function medicalRoutes(pool, writeAuditLog) {
  const router = Router();

  // ─── ICD-10 (public read for autocomplete) ───
  router.get('/icd10', async (req, res) => {
    try {
      const { search } = req.query;
      let result;
      if (search && search.length >= 2) {
        result = await pool.query(`SELECT * FROM icd10 WHERE code ILIKE $1 OR name ILIKE $1 ORDER BY code LIMIT 50`, [`%${search}%`]);
      } else {
        result = await pool.query('SELECT * FROM icd10 ORDER BY code LIMIT 200');
      }
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Medical Card ───
  router.get('/medical-cards/:patientId', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM medical_cards WHERE patient_id = $1 ORDER BY updated_at DESC LIMIT 1', [req.params.patientId]);
      res.json(result.rows[0] || null);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/medical-cards/upsert', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body;
      const columns = Object.keys(row).filter(sanitizeColumnName);
      if (columns.length === 0) return res.status(400).json({ error: 'No valid columns' });
      const values = columns.map(c => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const updates = columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ');
      const result = await pool.query(
        `INSERT INTO medical_cards (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP RETURNING *`,
        values
      );
      writeAuditLog(row.clinic_id, req.user.id, req.user.name, 'upsert', 'medical_card', row.id, { patient_id: row.patient_id });
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Visits ───
  router.get('/visits', authenticate, async (req, res) => {
    try {
      const { clinic_id, patient_id } = req.query;
      // Enforce same-clinic for non-superadmin
      if (req.user.role !== 'superadmin' && clinic_id && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      let query = 'SELECT v.*, p.full_name as patient_name, u.name as doctor_name FROM visits v LEFT JOIN patients p ON v.patient_id = p.id LEFT JOIN users u ON v.doctor_id = u.id WHERE 1=1';
      const params = []; let idx = 1;
      if (clinic_id) { query += ` AND v.clinic_id = $${idx++}`; params.push(clinic_id); }
      if (patient_id) { query += ` AND v.patient_id = $${idx++}`; params.push(patient_id); }
      query += ' ORDER BY v.visit_date DESC LIMIT 200';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/visits/upsert', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body;
      const id = row.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      const result = await pool.query(
        `INSERT INTO visits (id, clinic_id, patient_id, doctor_id, appointment_id, chief_complaint, diagnosis, icd10_codes, treatment_plan, procedures_done, prescriptions, next_visit_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET chief_complaint=EXCLUDED.chief_complaint, diagnosis=EXCLUDED.diagnosis, icd10_codes=EXCLUDED.icd10_codes, treatment_plan=EXCLUDED.treatment_plan, procedures_done=EXCLUDED.procedures_done, prescriptions=EXCLUDED.prescriptions, next_visit_date=EXCLUDED.next_visit_date, notes=EXCLUDED.notes RETURNING *`,
        [id, row.clinic_id, row.patient_id, row.doctor_id || null, row.appointment_id || null, row.chief_complaint || null, row.diagnosis || null, row.icd10_codes || null, row.treatment_plan || null, row.procedures_done || null, row.prescriptions || null, row.next_visit_date || null, row.notes || null]
      );
      writeAuditLog(row.clinic_id, req.user.id, req.user.name, 'create_visit', 'visit', id, { patient_id: row.patient_id, diagnosis: row.diagnosis });
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Documents ───
  router.get('/documents', authenticate, async (req, res) => {
    try {
      const { clinic_id, patient_id } = req.query;
      if (req.user.role !== 'superadmin' && clinic_id && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      let query = 'SELECT d.*, p.full_name as patient_name, u.name as doctor_name FROM documents d LEFT JOIN patients p ON d.patient_id = p.id LEFT JOIN users u ON d.doctor_id = u.id WHERE 1=1';
      const params = []; let idx = 1;
      if (clinic_id) { query += ` AND d.clinic_id = $${idx++}`; params.push(clinic_id); }
      if (patient_id) { query += ` AND d.patient_id = $${idx++}`; params.push(patient_id); }
      query += ' ORDER BY d.created_at DESC LIMIT 200';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/documents/upsert', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const row = req.body;
      const columns = Object.keys(row).filter(sanitizeColumnName);
      if (columns.length === 0) return res.status(400).json({ error: 'No valid columns' });
      const values = columns.map(c => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const updates = columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ');
      const result = await pool.query(`INSERT INTO documents (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP RETURNING *`, values);
      writeAuditLog(row.clinic_id, req.user.id, req.user.name, 'upsert', 'document', row.id, { title: row.title, doc_type: row.doc_type });
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.delete('/documents/:id', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
      res.json(result.rows[0] || { deleted: true, id: req.params.id });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Document Signature ───
  router.post('/documents/:id/send-signature', authenticate, requirePermission('write'), async (req, res) => {
    try {
      const token = crypto.randomUUID();
      const result = await pool.query('UPDATE documents SET signature_token = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *', [token, 'pending_signature', req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
      const baseUrl = process.env.SIGNING_BASE_URL || req.headers.origin || 'https://dent-vision1.vercel.app';
      res.json({ document: result.rows[0], signingUrl: `${baseUrl}/sign/${token}` });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.put('/documents/:id/sign', async (req, res) => {
    try {
      const { signature_data, signed_by_name, token } = req.body;
      if (!signature_data) return res.status(400).json({ error: 'signature_data required' });
      let query, params;
      if (token) {
        query = 'UPDATE documents SET signature_data = $1, signed_at = NOW(), signed_by_name = $2, status = $3, signature_token = NULL, updated_at = NOW() WHERE signature_token = $4 RETURNING *';
        params = [signature_data, signed_by_name || 'Пациент', 'signed', token];
      } else {
        query = 'UPDATE documents SET signature_data = $1, signed_at = NOW(), signed_by_name = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING *';
        params = [signature_data, signed_by_name || 'Пациент', 'signed', req.params.id];
      }
      const result = await pool.query(query, params);
      if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
