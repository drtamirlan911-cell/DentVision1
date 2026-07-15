// ═══════════════════════════════════════════════════════════════
// Service Access Routes — CRUD for clinic-level service toggles
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireSameClinic } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

// All available services in the platform
const ALL_SERVICES = ['crm', 'shop', 'school', 'ai', 'analytics', 'settings'];

export default function serviceAccessRoutes() {
  const router = Router();

  // ─── GET /api/service-access/:clinicId — list service access for a clinic ───
  router.get('/:clinicId', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinicId } = req.params;
      const access = await prisma.serviceAccess.findMany({
        where: { clinicId },
        orderBy: { service: 'asc' },
      });
      // Return as a map: { crm: true, shop: false, ... }
      const map = {};
      for (const svc of ALL_SERVICES) {
        const found = access.find(a => a.service === svc);
        map[svc] = found ? found.enabled : true; // default: enabled
      }
      res.json(map);
    } catch (e) {
      console.error('Service access list error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── POST /api/service-access — toggle a service for a clinic ───
  // Body: { clinic_id, service, enabled }
  router.post('/', authenticate, requirePermission('settings'), requireSameClinic, async (req, res) => {
    try {
      const { clinic_id, service, enabled } = req.body;
      if (!clinic_id || !service) {
        return res.status(400).json({ error: 'clinic_id and service required' });
      }
      if (!ALL_SERVICES.includes(service)) {
        return res.status(400).json({ error: `Invalid service. Allowed: ${ALL_SERVICES.join(', ')}` });
      }
      // CRM is always enabled — cannot be disabled
      if (service === 'crm' && enabled === false) {
        return res.status(400).json({ error: 'CRM cannot be disabled' });
      }
      const id = crypto.randomUUID();
      const result = await prisma.serviceAccess.upsert({
        where: { clinicId_service: { clinicId: clinic_id, service } },
        update: { enabled: !!enabled },
        create: { id, clinicId: clinic_id, service, enabled: enabled !== false },
      });
      res.json(result);
    } catch (e) {
      console.error('Service access upsert error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── POST /api/service-access/bulk — set multiple services at once ───
  // Body: { clinic_id, services: { shop: true, school: false, ... } }
  router.post('/bulk', authenticate, requirePermission('settings'), requireSameClinic, async (req, res) => {
    try {
      const { clinic_id, services } = req.body;
      if (!clinic_id || !services || typeof services !== 'object') {
        return res.status(400).json({ error: 'clinic_id and services object required' });
      }
      const results = [];
      for (const [service, enabled] of Object.entries(services)) {
        if (!ALL_SERVICES.includes(service)) continue;
        if (service === 'crm' && enabled === false) continue; // CRM always on
        const id = crypto.randomUUID();
        const result = await prisma.serviceAccess.upsert({
          where: { clinicId_service: { clinicId: clinic_id, service } },
          update: { enabled: !!enabled },
          create: { id, clinicId: clinic_id, service, enabled: enabled !== false },
        });
        results.push(result);
      }
      res.json({ updated: results.length, services });
    } catch (e) {
      console.error('Service access bulk error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
