import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requirePermission, requireSuperadmin } from '../middleware/rbac.js';
import { broadcast } from '../ws.js';
import aiRoutes from '../ai/chat.js';
import crmRoutes from './crm.js';

export default function registerBridgeRoutes(app, writeAuditLog) {
  const aiRouter = aiRoutes();
  app.post('/api/ai/query', optionalAuth, (req, res, next) => {
    req.body.message = req.body.text || req.body.message;
    req.body.history = req.body.history || [];
    req.url = '/chat';
    aiRouter(req, res, next);
  });

  app.post('/api/ai/query/stream', optionalAuth, (req, res, next) => {
    req.body.message = req.body.text || req.body.message;
    req.body.history = req.body.history || [];
    req.url = '/chat/stream';
    aiRouter(req, res, next);
  });

  // Convenience aliases for AI threads (same router also mounted at /api/ai)
  app.get('/api/ai/threads', authenticate, (req, res, next) => {
    req.url = '/threads';
    aiRouter(req, res, next);
  });
  app.get('/api/ai/threads/active', authenticate, (req, res, next) => {
    req.url = '/threads/active';
    aiRouter(req, res, next);
  });

  const crmRouter = crmRoutes(writeAuditLog);

  const CRM_RESOURCE_MAP = {
    patients: 'patients',
    appointments: 'appointments',
    'billing/invoices': 'receipts',
    inventory: 'inventory',
  };

  for (const [route, resource] of Object.entries(CRM_RESOURCE_MAP)) {
    const basePath = `/${resource}`;

    app.get(`/api/${route}`, authenticate, (req, res, next) => {
      req.params.clinicId = req.user?.clinicId;
      req.url = `/${req.user?.clinicId}/${resource}${req.search || ''}`;
      crmRouter(req, res, next);
    });

    app.post(`/api/${route}`, authenticate, (req, res, next) => {
      req.params.clinicId = req.user?.clinicId;
      req.url = `/${req.user?.clinicId}/${resource}`;
      crmRouter(req, res, next);
    });

    if (route !== 'billing/invoices') {
      app.delete(`/api/${route}/:id`, authenticate, (req, res, next) => {
        req.params.clinicId = req.user?.clinicId;
        req.url = `/${req.user?.clinicId}/${resource}/${req.params.id}`;
        crmRouter(req, res, next);
      });
    }
  }

  app.get('/api/clinics/:id', authenticate, async (req, res) => {
    try {
      const clinic = await prisma.clinic.findUnique({ where: { id: req.params.id } });
      if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
      res.json(clinic);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/medical/icd10', authenticate, async (req, res) => {
    try {
      const q = req.query.q || '';
      const results = await prisma.icd10.findMany({
        where: { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] },
        take: 20,
      });
      res.json(results);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/medical/visits', authenticate, async (req, res) => {
    try {
      const visits = await prisma.visit.findMany({
        where: { patientId: req.query.patientId || undefined },
        orderBy: { date: 'desc' },
        take: 50,
      });
      res.json(visits);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/medical/visits', authenticate, async (req, res) => {
    try {
      const data = req.body;
      const visit = await prisma.visit.upsert({
        where: { id: data.id || crypto.randomUUID() },
        create: { id: data.id || crypto.randomUUID(), ...data },
        update: data,
      });
      broadcast(req.user?.clinicId, 'visit.updated', { id: visit.id });
      res.json(visit);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/medical/treatment-plan', authenticate, async (req, res) => {
    try {
      const data = req.body;
      const result = await prisma.medicalCard.upsert({
        where: { id: data.id || crypto.randomUUID() },
        create: { id: data.id || crypto.randomUUID(), patientId: data.patientId, ...data },
        update: data,
      });
      broadcast(req.user?.clinicId, 'medical_card.updated', { id: result.id });
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/patients/:patientId/medical-card', authenticate, async (req, res) => {
    try {
      const card = await prisma.medicalCard.findFirst({ where: { patientId: req.params.patientId } });
      res.json(card || {});
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/medical/patients/:patientId/visits', authenticate, async (req, res) => {
    try {
      const visits = await prisma.visit.findMany({
        where: { patientId: req.params.patientId },
        orderBy: { date: 'desc' },
        take: 50,
      });
      res.json(visits);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/medical/images', authenticate, async (req, res) => {
    try {
      const { patientId, type, url, name, metadata } = req.body;
      const image = await prisma.photo.create({
        data: { id: crypto.randomUUID(), patientId, type: type || 'photo', url, name, metadata: metadata || {} },
      });
      res.json(image);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/files/upload', authenticate, async (req, res) => {
    try {
      const data = req.body;
      const doc = await prisma.document.upsert({
        where: { id: data.id || crypto.randomUUID() },
        create: { id: data.id || crypto.randomUUID(), ...data },
        update: data,
      });
      broadcast(req.user?.clinicId, 'document.updated', { id: doc.id });
      res.json(doc);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/files/:id', authenticate, async (req, res) => {
    try {
      await prisma.document.delete({ where: { id: req.params.id } }).catch(() => {});
      await prisma.photo.delete({ where: { id: req.params.id } }).catch(() => {});
      broadcast(req.user?.clinicId, 'document.deleted', { id: req.params.id });
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Delete failed' }); }
  });

  app.get('/api/audit', authenticate, requirePermission('view_audit'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
      res.json(logs);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/audit/backup', authenticate, requirePermission('backup'), async (req, res) => {
    try {
      await prisma.auditLog.create({ data: { id: crypto.randomUUID(), action: 'backup', details: JSON.stringify({ triggeredBy: req.user?.id }) } });
      res.json({ ok: true, message: 'Backup triggered' });
    } catch { res.status(500).json({ error: 'Backup failed' }); }
  });

  app.get('/api/auth/invitations/lookup', authenticate, async (req, res) => {
    try {
      const invitation = await prisma.invitation.findFirst({ where: { code: req.query.code } });
      res.json(invitation || null);
    } catch { res.status(500).json({ error: 'Lookup failed' }); }
  });

  app.patch('/api/shop/products/:id', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      const product = await prisma.shopProduct.update({ where: { id: req.params.id }, data: req.body });
      res.json(product);
    } catch { res.status(500).json({ error: 'Update failed' }); }
  });

  app.get('/api/service-access/public/:clinicId', async (req, res) => {
    try {
      const { clinicId } = req.params;
      const access = await prisma.serviceAccess.findMany({ where: { clinicId } });
      const ALL_SERVICES = ['crm', 'shop', 'school', 'ai', 'analytics', 'settings'];
      const map = {};
      for (const svc of ALL_SERVICES) {
        const found = access.find(a => a.service === svc);
        map[svc] = found ? found.enabled : true;
      }
      res.json(map);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });
}
