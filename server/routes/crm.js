// ═══════════════════════════════════════════════════════════════
// CRM Routes — granular per-resource CRUD (replaces mega-endpoint)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

// Resource definitions: name → { model, queryIncludes?, orderBy? }
const RESOURCES = {
  patients:     { model: () => prisma.patient,     orderBy: { fullName: 'asc' } },
  appointments: { model: () => prisma.appointment, orderBy: { startTime: 'desc' } },
  treatments:   { model: () => prisma.treatment,   orderBy: { createdAt: 'desc' } },
  receipts:     { model: () => prisma.receipt,     orderBy: { createdAt: 'desc' } },
  subscriptions:{ model: () => prisma.subscription,orderBy: { createdAt: 'desc' } },
  lab_orders:   { model: () => prisma.labOrder,    orderBy: { createdAt: 'desc' } },
  photos:       { model: () => prisma.photo,       orderBy: { createdAt: 'desc' } },
  expenses:     { model: () => prisma.expense,     orderBy: { createdAt: 'desc' } },
  inventory:    { model: () => prisma.inventory,   orderBy: { name: 'asc' } },
  debts:        { model: () => prisma.debt,        orderBy: { createdAt: 'desc' } },
  referrals:    { model: () => prisma.referral,    orderBy: { createdAt: 'desc' } },
  promotions:   { model: () => prisma.promotion,   orderBy: { createdAt: 'desc' } },
  bookings:     { model: () => prisma.booking,     orderBy: { createdAt: 'desc' } },
  waiting_list: { model: () => prisma.waitingList, orderBy: { createdAt: 'desc' } },
};

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

export default function crmRoutes(writeAuditLog) {
  const router = Router();

  // ─── Generic CRUD for each resource ───
  for (const [name, def] of Object.entries(RESOURCES)) {
    const model = def.model();

    // GET /api/crm/:clinicId/<resource> — list with optional filters
    router.get(`/:clinicId/${name}`, authenticate, requireSameClinic, async (req, res) => {
      try {
        const { clinicId } = req.params;
        const where = { clinicId };
        // Pass through common query filters
        for (const [key, val] of Object.entries(req.query)) {
          if (key === 'search' && val) {
            // Generic text search on name/title fields
            where.OR = [
              { name: { contains: val, mode: 'insensitive' } },
              { title: { contains: val, mode: 'insensitive' } },
            ];
          } else if (key !== 'clinic_id' && key !== 'limit' && key !== 'offset') {
            where[key] = val;
          }
        }
        const limit = Math.min(Number(req.query.limit) || 200, 500);
        const result = await model.findMany({ where, orderBy: def.orderBy, take: limit });
        // Decrypt patient fields
        if (name === 'patients') return res.json(result.map(decryptPatient));
        res.json(result);
      } catch (e) { console.error(`CRM ${name} list error:`, e.message); res.status(500).json({ error: 'Internal server error' }); }
    });

    // POST /api/crm/<resource> — upsert
    router.post(`/${name}`, authenticate, requireSameClinic, requirePermission('write'), async (req, res) => {
      try {
        const row = req.body;
        if (!row.clinic_id && !row.clinicId) {
          return res.status(400).json({ error: 'clinic_id required' });
        }
        // Encrypt patient fields before upsert
        if (name === 'patients') {
          for (const f of PATIENT_ENCRYPT_FIELDS) { if (row[f]) row[f] = encrypt(row[f]); }
        }
        const id = row.id || crypto.randomUUID();
        const data = {};
        // Map snake_case body fields to camelCase model fields
        for (const [key, val] of Object.entries(row)) {
          if (key === 'id') continue;
          // Convert clinic_id → clinicId, patient_id → patientId, etc.
          const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
          data[camel] = val;
        }
        data.id = id;
        data.clinicId = row.clinic_id || row.clinicId;
        const result = await model.upsert({
          where: { id },
          update: data,
          create: data,
        });
        const action = `upsert_${name}`;
        writeAuditLog(data.clinicId, req.user.id, req.user.name, action, name, id, { id });
        res.json(result);
      } catch (e) { console.error(`CRM ${name} upsert error:`, e.message); res.status(500).json({ error: 'Internal server error' }); }
    });

    // DELETE /api/crm/<resource>/:id — delete
    router.delete(`/${name}/:id`, authenticate, requireSameClinic, requirePermission('write'), async (req, res) => {
      try {
        const result = await model.delete({ where: { id: req.params.id } });
        if (result.clinicId) {
          writeAuditLog(result.clinicId, req.user.id, req.user.name, `delete_${name}`, name, req.params.id, { id: req.params.id });
        }
        res.json(result);
      } catch (e) { console.error(`CRM ${name} delete error:`, e.message); res.status(500).json({ error: 'Internal server error' }); }
    });
  }

  // ─── Mega-endpoint (backward-compatible, deprecated) ───
  router.get('/:clinicId/data', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinicId } = req.params;
      const entries = Object.entries(RESOURCES);
      const results = await Promise.all(
        entries.map(async ([name, def]) => {
          const model = def.model();
          const data = await model.findMany({ where: { clinicId }, orderBy: def.orderBy });
          return [name, name === 'patients' ? data.map(decryptPatient) : data];
        })
      );
      res.json(Object.fromEntries(results));
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── User creation (authenticated, admin/director only) ───
  router.post('/users/create', authenticate, requirePermission('manage_users'), async (req, res) => {
    try {
      const bcrypt = (await import('bcryptjs')).default;
      const { id, clinic_id, login, password, name, role, spec, phone } = req.body;
      if (!login || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (req.user.role !== 'superadmin' && clinic_id !== req.user.clinicId) {
        return res.status(403).json({ error: 'Cannot create users in other clinics' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      const user = await prisma.user.upsert({
        where: { id: id || '' },
        update: { clinicId: clinic_id, login, name, role, spec, phone },
        create: { id, clinicId: clinic_id, login, passwordHash: password_hash, name, role, spec, phone },
      });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
