// ═══════════════════════════════════════════════════════════════
// Clinic Data Routes — data fetch, generic upsert/delete, user creation
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

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
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  const msg = 'ENCRYPTION_KEY (32+ chars) is required';
  if (process.env.NODE_ENV === 'production') throw new Error(msg);
  console.warn(`WARNING: ${msg}. Using random key for this session — encrypted data will be lost on restart.`);
}

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  } catch { return text; }
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts.slice(2).join(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    decipher.setAuthTag(tag);
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

const TABLE_TO_PRISMA = {
  clinics: 'clinic', users: 'user', patients: 'patient', appointments: 'appointment',
  treatments: 'treatment', receipts: 'receipt', subscriptions: 'subscription',
  lab_orders: 'labOrder', photos: 'photo', expenses: 'expense', inventory: 'inventory',
  debts: 'debt', referrals: 'referral', promotions: 'promotion', bookings: 'booking',
  medical_cards: 'medicalCard', visits: 'visit', documents: 'document', waiting_list: 'waitingList',
  shop_products: 'shopProduct', shop_categories: 'shopCategory', shop_orders: 'shopOrder',
  shop_order_items: 'shopOrderItem', shop_reviews: 'shopReview', shop_favorites: 'shopFavorite',
  shop_suppliers: 'shopSupplier', school_courses: 'schoolCourse', school_modules: 'schoolModule',
  school_lessons: 'schoolLesson', school_enrollments: 'schoolEnrollment',
  school_certificates: 'schoolCertificate', school_clinical_cases: 'schoolClinicalCase',
  school_library: 'schoolLibrary',
};

function validateTable(table) { return !!TABLE_TO_PRISMA[table]; }

export default function clinicRoutes(writeAuditLog) {
  const router = Router();

  // ─── Clinic data (authenticated, same-clinic enforced) ───
  router.get('/:clinicId/data', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinicId } = req.params;
      const [patients, appointments, treatments, receipts, subscriptions, labOrders, photos, expenses, inventory, debts, referrals, promotions, bookings, medicalCards, visits, documents, waitingList] = await Promise.all([
        prisma.patient.findMany({ where: { clinicId } }),
        prisma.appointment.findMany({ where: { clinicId } }),
        prisma.treatment.findMany({ where: { clinicId } }),
        prisma.receipt.findMany({ where: { clinicId } }),
        prisma.subscription.findMany({ where: { clinicId } }),
        prisma.labOrder.findMany({ where: { clinicId } }),
        prisma.photo.findMany({ where: { clinicId } }),
        prisma.expense.findMany({ where: { clinicId } }),
        prisma.inventory.findMany({ where: { clinicId } }),
        prisma.debt.findMany({ where: { clinicId } }),
        prisma.referral.findMany({ where: { clinicId } }),
        prisma.promotion.findMany({ where: { clinicId } }),
        prisma.booking.findMany({ where: { clinicId } }),
        prisma.medicalCard.findMany({ where: { clinicId } }),
        prisma.visit.findMany({ where: { clinicId } }),
        prisma.document.findMany({ where: { clinicId } }),
        prisma.waitingList.findMany({ where: { clinicId } }),
      ]);
      res.json({
        patients: decryptPatients(patients),
        appointments,
        treatments,
        receipts,
        subscriptions,
        labOrders,
        photos,
        expenses,
        inventory,
        debts,
        referrals,
        promotions,
        bookings,
        medicalCards,
        visits,
        documents,
        waitingList,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Generic upsert (authenticated, same-clinic enforced) ───
  const ALLOWED_FIELDS = {
    users: new Set(['name', 'spec', 'phone', 'role', 'clinicId', 'email']),
  };
  router.post('/:table/upsert', authenticate, requireSameClinic, requirePermission('write'), async (req, res) => {
    try {
      const { table } = req.params;
      const modelName = TABLE_TO_PRISMA[table];
      if (!modelName) return res.status(400).json({ error: 'Invalid table name' });
      const row = req.body;
      if (!row.id) return res.status(400).json({ error: 'id is required' });
      const allowed = ALLOWED_FIELDS[table];
      const data = allowed
        ? Object.fromEntries(Object.entries(row).filter(([k]) => allowed.has(k)))
        : row;
      if (!data.id) data.id = row.id;
      const model = prisma[modelName];
      const result = await model.upsert({
        where: { id: row.id },
        create: data,
        update: data,
      });
      if (row.clinic_id && result) {
        writeAuditLog(row.clinic_id, req.user.id, req.user.name, `upsert_${table}`, table, row.id, { table, id: row.id });
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Generic delete (authenticated, same-clinic enforced) ───
  router.delete('/:table/:id', authenticate, requireSameClinic, requirePermission('write'), async (req, res) => {
    try {
      const { table, id } = req.params;
      const modelName = TABLE_TO_PRISMA[table];
      if (!modelName) return res.status(400).json({ error: 'Invalid table name' });
      const model = prisma[modelName];
      const result = await model.delete({ where: { id } });
      if (result?.clinicId) {
        writeAuditLog(result.clinicId, req.user.id, req.user.name, `delete_${table}`, table, id, { table, id });
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── User creation (authenticated, admin/director only) ───
  router.post('/users/create', authenticate, requirePermission('manage_users'), async (req, res) => {
    try {
      const { id, clinic_id, login, password, name, role, spec, phone } = req.body;
      if (!login || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (req.user.role !== 'superadmin' && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Cannot create users in other clinics' });
      }
      const password_hash = await bcrypt.hash(password, 12);
      const user = await prisma.user.upsert({
        where: { id: id || '' },
        update: { clinicId: clinic_id, login, name, role, spec, phone },
        create: { id, clinicId: clinic_id, login, passwordHash: password_hash, name, role, spec, phone },
      });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
