// ═══════════════════════════════════════════════════════════════
// Clinic Data Routes — data fetch, generic upsert/delete, user creation
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';

const ALLOWED_TABLES = [
  'clinics', 'users', 'patients', 'appointments', 'treatments',
  'receipts', 'subscriptions', 'lab_orders', 'photos', 'expenses',
  'inventory', 'debts', 'referrals', 'promotions', 'bookings',
  'medical_cards', 'visits', 'documents', 'waiting_list',
  'shop_products', 'shop_categories', 'shop_orders', 'shop_order_items',
  'shop_reviews', 'shop_favorites', 'shop_suppliers',
  'school_courses', 'school_modules', 'school_lessons', 'school_enrollments',
  'school_certificates', 'school_clinical_cases', 'school_library',
];

const PATIENT_ENCRYPT_FIELDS = ['address', 'email', 'notes'];
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch { return text; }
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return text; }
}

function decryptPatient(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of PATIENT_ENCRYPT_FIELDS) { if (out[f]) out[f] = decrypt(out[f]); }
  return out;
}

function decryptPatients(rows) { return rows.map(decryptPatient); }

function validateTable(table) { return ALLOWED_TABLES.includes(table); }
function sanitizeColumnName(col) { return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col); }

export default function clinicRoutes(pool, writeAuditLog) {
  const router = Router();

  // ─── Clinic data (authenticated, same-clinic enforced) ───
  router.get('/:clinicId/data', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinicId } = req.params;
      const [patients, appointments, treatments, receipts, subscriptions, labOrders, photos, expenses, inventory, debts, referrals, promotions, bookings, medicalCards, visits, documents, waitingList] = await Promise.all([
        pool.query('SELECT * FROM patients WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM appointments WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM treatments WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM receipts WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM subscriptions WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM lab_orders WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM photos WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM expenses WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM inventory WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM debts WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM referrals WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM promotions WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM bookings WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM medical_cards WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM visits WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM documents WHERE clinic_id = $1', [clinicId]),
        pool.query('SELECT * FROM waiting_list WHERE clinic_id = $1', [clinicId]),
      ]);
      res.json({
        patients: decryptPatients(patients.rows),
        appointments: appointments.rows,
        treatments: treatments.rows,
        receipts: receipts.rows,
        subscriptions: subscriptions.rows,
        labOrders: labOrders.rows,
        photos: photos.rows,
        expenses: expenses.rows,
        inventory: inventory.rows,
        debts: debts.rows,
        referrals: referrals.rows,
        promotions: promotions.rows,
        bookings: bookings.rows,
        medicalCards: medicalCards.rows,
        visits: visits.rows,
        documents: documents.rows,
        waitingList: waitingList.rows,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Generic upsert (authenticated, same-clinic enforced) ───
  router.post('/:table/upsert', authenticate, requireSameClinic, requirePermission('write'), async (req, res) => {
    try {
      const { table } = req.params;
      if (!validateTable(table)) return res.status(400).json({ error: 'Invalid table name' });
      const row = req.body;
      const columns = Object.keys(row).filter(sanitizeColumnName);
      if (columns.length === 0) return res.status(400).json({ error: 'No valid columns provided' });
      const values = columns.map(c => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const updates = columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ');
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING *`;
      const result = await pool.query(query, values);
      if (row.clinic_id && result.rows[0]) {
        const action = `upsert_${table}`;
        writeAuditLog(row.clinic_id, req.user.id, req.user.name, action, table, row.id, { table, id: row.id });
      }
      res.json(result.rows[0]);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Generic delete (authenticated, same-clinic enforced) ───
  router.delete('/:table/:id', authenticate, requireSameClinic, requirePermission('write'), async (req, res) => {
    try {
      const { table, id } = req.params;
      if (!validateTable(table)) return res.status(400).json({ error: 'Invalid table name' });
      const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
      if (result.rows[0]?.clinic_id) {
        writeAuditLog(result.rows[0].clinic_id, req.user.id, req.user.name, `delete_${table}`, table, id, { table, id });
      }
      res.json(result.rows[0] || { deleted: true, id });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── User creation (authenticated, admin/director only) ───
  router.post('/users/create', authenticate, requirePermission('manage_users'), async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { id, clinic_id, login, password, name, role, spec, phone } = req.body;
      if (!login || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // Ensure user can only create in their own clinic (unless superadmin)
      if (req.user.role !== 'superadmin' && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Cannot create users in other clinics' });
      }
      const password_hash = await bcrypt.default.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (id, clinic_id, login, password_hash, name, role, spec, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, login = EXCLUDED.login, name = EXCLUDED.name, role = EXCLUDED.role, spec = EXCLUDED.spec, phone = EXCLUDED.phone RETURNING *`,
        [id, clinic_id, login, password_hash, name, role, spec, phone]
      );
      const { password_hash: _, ...user } = result.rows[0];
      res.json(user);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
