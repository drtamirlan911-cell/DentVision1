// ═══════════════════════════════════════════════════════════════
// Notification Routes — unified Notification Center
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

export default function notificationRoutes() {
  const router = Router();

  // Build the visibility filter for the current user
  function visibilityWhere(req) {
    const uid = req.user.id;
    const clinicId = req.user.clinicId;
    // Superadmin sees all platform-wide + all clinic-wide notifications
    if (req.user.role === 'superadmin') {
      return {
        OR: [
          { clinicId: null, userId: null },
          { clinicId: { not: null }, userId: null },
        ],
      };
    }
    // Regular users: personal + clinic-wide + platform-wide
    return {
      OR: [
        { userId: uid },
        { clinicId: clinicId || '__none__', userId: null },
        { clinicId: null, userId: null },
      ],
    };
  }

  // ─── List notifications ───
  router.get('/', authenticate, async (req, res) => {
    try {
      const where = visibilityWhere(req);
      if (req.query.unread === 'true') where.read = false;
      if (req.query.type) where.type = req.query.type;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const result = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      res.json(result);
    } catch (e) {
      console.error('Notifications list error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Unread count ───
  router.get('/unread-count', authenticate, async (req, res) => {
    try {
      const where = visibilityWhere(req);
      where.read = false;
      const count = await prisma.notification.count({ where });
      res.json({ count });
    } catch (e) {
      console.error('Notifications count error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Create notification (admin/director/superadmin) ───
  router.post('/', authenticate, requirePermission('settings'), async (req, res) => {
    try {
      const { type, category, clinicId, userId, title, message, actionUrl } = req.body;
      if (!title) return res.status(400).json({ error: 'title required' });

      // Permission scoping
      const isPlatform = !clinicId && !userId;
      const isClinicWide = clinicId && !userId;
      if (isPlatform && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can create platform-wide notifications' });
      }
      if (isClinicWide && req.user.role !== 'superadmin' && clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Cannot create notifications for other clinics' });
      }
      const id = crypto.randomUUID();
      const result = await prisma.notification.create({
        data: {
          id,
          type: type || 'system',
          category,
          clinicId: clinicId || null,
          userId: userId || null,
          title,
          message,
          actionUrl,
          read: false,
        },
      });
      res.json(result);
    } catch (e) {
      console.error('Notification create error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Mark one as read ───
  router.post('/:id/read', authenticate, async (req, res) => {
    try {
      const where = visibilityWhere(req);
      where.id = req.params.id;
      const found = await prisma.notification.findFirst({ where });
      if (!found) return res.status(404).json({ error: 'Not found' });
      const result = await prisma.notification.update({
        where: { id: req.params.id },
        data: { read: true },
      });
      res.json(result);
    } catch (e) {
      console.error('Notification read error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Mark all as read ───
  router.post('/read-all', authenticate, async (req, res) => {
    try {
      const where = visibilityWhere(req);
      where.read = false;
      const result = await prisma.notification.updateMany({
        where,
        data: { read: true },
      });
      res.json({ updated: result.count });
    } catch (e) {
      console.error('Notification read-all error:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
