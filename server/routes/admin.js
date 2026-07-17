import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireSuperadmin } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

function genId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 20); }

export default function adminRoutes(writeAuditLog) {
  const router = Router();
  const admin = [authenticate, requireSuperadmin()];

  // ═══════════════════════════════════════════════════════════════
  // CLINICS
  // ═══════════════════════════════════════════════════════════════

  router.get('/clinics', ...admin, async (_req, res) => {
    try {
      const clinics = await prisma.clinic.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { memberships: true, patients: true, appointments: true } },
          subscription: true,
        },
      });
      res.json({ data: clinics });
    } catch (e) {
      console.error('Admin list clinics:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/clinics/:id', ...admin, async (req, res) => {
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: req.params.id },
        include: {
          memberships: { include: { user: { select: { id: true, name: true, login: true, email: true, role: true, platformRole: true } } } },
          subscription: true,
          _count: { select: { patients: true, appointments: true, receipts: true } },
        },
      });
      if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
      res.json({ data: clinic });
    } catch (e) {
      console.error('Admin get clinic:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/clinics', ...admin, async (req, res) => {
    try {
      const { name, city, address, phone, email, plan = 'starter' } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Название обязательно' });

      const clinicId = genId();
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const clinic = await prisma.clinic.create({
        data: {
          id: clinicId,
          name: name.trim(),
          slug: slug || undefined,
          city: city || null,
          address: address || null,
          phone: phone || null,
          email: email || null,
          plan,
          active: true,
        },
      });

      // Create director account
      const directorLogin = `admin_${slug || clinicId}`.slice(0, 50);
      const tempPassword = `dv_${Date.now().toString(36)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const director = await prisma.user.create({
        data: {
          id: genId(),
          login: directorLogin,
          passwordHash,
          name: `Директор ${name}`,
          role: 'director',
          platformRole: 'user',
          clinicId,
        },
      });

      await prisma.membership.create({
        data: { id: genId(), userId: director.id, clinicId, role: 'director', status: 'active' },
      });

      // Create default subscription (30 days)
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      await prisma.subscription.create({
        data: {
          id: genId(),
          clinicId,
          plan,
          startDate: now,
          endDate,
          status: 'active',
        },
      });

      // Enable default services
      const defaultServices = ['crm', 'shop', 'school', 'ai', 'analytics', 'settings'];
      await prisma.serviceAccess.createMany({
        data: defaultServices.map(s => ({ id: genId(), clinicId, service: s, enabled: true })),
      });

      writeAuditLog(clinicId, req.user.id, req.user.name, 'clinic.create', 'clinic', clinicId, { name, plan });

      res.json({ data: { clinic, directorLogin, tempPassword } });
    } catch (e) {
      console.error('Admin create clinic:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/clinics/:id', ...admin, async (req, res) => {
    try {
      const { name, city, address, phone, email, plan, active } = req.body;
      const data = {};
      if (name !== undefined) data.name = name;
      if (city !== undefined) data.city = city;
      if (address !== undefined) data.address = address;
      if (phone !== undefined) data.phone = phone;
      if (email !== undefined) data.email = email;
      if (plan !== undefined) data.plan = plan;
      if (active !== undefined) data.active = active;

      const clinic = await prisma.clinic.update({ where: { id: req.params.id }, data });
      writeAuditLog(req.params.id, req.user.id, req.user.name, 'clinic.update', 'clinic', req.params.id, data);
      res.json({ data: clinic });
    } catch (e) {
      console.error('Admin update clinic:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/clinics/:id', ...admin, async (req, res) => {
    try {
      const id = req.params.id;
      // Cascade delete related data
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { clinicId: id } }),
        prisma.auditLog.deleteMany({ where: { clinicId: id } }),
        prisma.membership.deleteMany({ where: { clinicId: id } }),
        prisma.subscription.deleteMany({ where: { clinicId: id } }),
        prisma.serviceAccess.deleteMany({ where: { clinicId: id } }),
        prisma.document.deleteMany({ where: { clinicId: id } }),
        prisma.visit.deleteMany({ where: { clinicId: id } }),
        prisma.medicalCard.deleteMany({ where: { clinicId: id } }),
        prisma.booking.deleteMany({ where: { clinicId: id } }),
        prisma.waitingList.deleteMany({ where: { clinicId: id } }),
        prisma.referral.deleteMany({ where: { clinicId: id } }),
        prisma.promotion.deleteMany({ where: { clinicId: id } }),
        prisma.debt.deleteMany({ where: { clinicId: id } }),
        prisma.expense.deleteMany({ where: { clinicId: id } }),
        prisma.inventory.deleteMany({ where: { clinicId: id } }),
        prisma.labOrder.deleteMany({ where: { clinicId: id } }),
        prisma.photo.deleteMany({ where: { clinicId: id } }),
        prisma.treatment.deleteMany({ where: { clinicId: id } }),
        prisma.receipt.deleteMany({ where: { clinicId: id } }),
        prisma.appointment.deleteMany({ where: { clinicId: id } }),
        prisma.patient.deleteMany({ where: { clinicId: id } }),
        prisma.shopOrder.deleteMany({ where: { clinicId: id } }),
        prisma.clinic.delete({ where: { id } }),
      ]);
      writeAuditLog(null, req.user.id, req.user.name, 'clinic.delete', 'clinic', id, { name: id });
      res.json({ data: { ok: true } });
    } catch (e) {
      console.error('Admin delete clinic:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Toggle active
  router.patch('/clinics/:id/toggle', ...admin, async (req, res) => {
    try {
      const clinic = await prisma.clinic.findUnique({ where: { id: req.params.id }, select: { active: true } });
      if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
      const updated = await prisma.clinic.update({ where: { id: req.params.id }, data: { active: !clinic.active } });
      writeAuditLog(req.params.id, req.user.id, req.user.name, clinic.active ? 'clinic.block' : 'clinic.unblock', 'clinic', req.params.id);
      res.json({ data: updated });
    } catch (e) {
      console.error('Admin toggle clinic:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Change plan
  router.patch('/clinics/:id/plan', ...admin, async (req, res) => {
    try {
      const { plan } = req.body;
      if (!['starter', 'pro', 'enterprise'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
      const clinic = await prisma.clinic.update({ where: { id: req.params.id }, data: { plan } });
      // Update or create subscription
      const existing = await prisma.subscription.findUnique({ where: { clinicId: req.params.id } });
      if (existing) {
        await prisma.subscription.update({ where: { clinicId: req.params.id }, data: { plan } });
      }
      writeAuditLog(req.params.id, req.user.id, req.user.name, 'clinic.plan_change', 'clinic', req.params.id, { plan });
      res.json({ data: clinic });
    } catch (e) {
      console.error('Admin change plan:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Extend subscription
  router.patch('/clinics/:id/extend', ...admin, async (req, res) => {
    try {
      const { months = 1 } = req.body;
      const sub = await prisma.subscription.findUnique({ where: { clinicId: req.params.id } });
      if (!sub) {
        // Create new subscription
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + months);
        await prisma.subscription.create({
          data: { id: genId(), clinicId: req.params.id, plan: 'starter', startDate: now, endDate, status: 'active' },
        });
      } else {
        const currentEnd = sub.endDate > new Date() ? sub.endDate : new Date();
        const newEnd = new Date(currentEnd);
        newEnd.setMonth(newEnd.getMonth() + months);
        await prisma.subscription.update({ where: { clinicId: req.params.id }, data: { endDate: newEnd } });
      }
      writeAuditLog(req.params.id, req.user.id, req.user.name, 'clinic.extend', 'clinic', req.params.id, { months });
      res.json({ data: { ok: true } });
    } catch (e) {
      console.error('Admin extend subscription:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════

  router.get('/users', ...admin, async (req, res) => {
    try {
      const { clinicId, platformRole } = req.query;
      const where = {};
      if (clinicId) where.clinicId = clinicId;
      if (platformRole) where.platformRole = platformRole;

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true, login: true, name: true, firstName: true, lastName: true,
          email: true, phone: true, role: true, platformRole: true, spec: true,
          clinicId: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ data: users });
    } catch (e) {
      console.error('Admin list users:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/users', ...admin, async (req, res) => {
    try {
      const { login, name, email, phone, role = 'assistant', platformRole = 'user', clinicId, spec, password } = req.body;
      if (!login?.trim()) return res.status(400).json({ error: 'Логин обязателен' });
      if (!name?.trim()) return res.status(400).json({ error: 'Имя обязательно' });

      const existing = await prisma.user.findUnique({ where: { login: login.trim() } });
      if (existing) return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });

      const tempPassword = password || `dv_${Date.now().toString(36)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const user = await prisma.user.create({
        data: {
          id: genId(),
          login: login.trim(),
          passwordHash,
          name: name.trim(),
          email: email || null,
          phone: phone || null,
          role,
          platformRole,
          clinicId: clinicId || null,
          spec: spec || null,
        },
        select: {
          id: true, login: true, name: true, email: true, phone: true,
          role: true, platformRole: true, clinicId: true, createdAt: true,
        },
      });

      // If clinicId provided, create membership
      if (clinicId) {
        await prisma.membership.create({
          data: { id: genId(), userId: user.id, clinicId, role, status: 'active' },
        });
      }

      writeAuditLog(clinicId || null, req.user.id, req.user.name, 'user.create', 'user', user.id, { login, role, platformRole });
      res.json({ data: { ...user, tempPassword: password ? undefined : tempPassword } });
    } catch (e) {
      console.error('Admin create user:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Reset password
  router.patch('/users/:id/password', ...admin, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
      writeAuditLog(null, req.user.id, req.user.name, 'user.password_reset', 'user', req.params.id);
      res.json({ data: { ok: true } });
    } catch (e) {
      console.error('Admin reset password:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete user
  router.delete('/users/:id', ...admin, async (req, res) => {
    try {
      const id = req.params.id;
      const user = await prisma.user.findUnique({ where: { id }, select: { role: true, platformRole: true } });
      if (user?.platformRole === 'superadmin') return res.status(403).json({ error: 'Нельзя удалить суперадмина' });
      await prisma.membership.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
      writeAuditLog(null, req.user.id, req.user.name, 'user.delete', 'user', id);
      res.json({ data: { ok: true } });
    } catch (e) {
      console.error('Admin delete user:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PLATFORM SUPPORT / ASSISTANTS
  // ═══════════════════════════════════════════════════════════════

  router.get('/support', ...admin, async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { platformRole: { in: ['superadmin', 'support'] } },
        select: {
          id: true, login: true, name: true, email: true, phone: true,
          role: true, platformRole: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ data: users });
    } catch (e) {
      console.error('Admin list support:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/support', ...admin, async (req, res) => {
    try {
      const { login, name, email, phone, password } = req.body;
      if (!login?.trim()) return res.status(400).json({ error: 'Логин обязателен' });
      if (!name?.trim()) return res.status(400).json({ error: 'Имя обязательно' });

      const existing = await prisma.user.findUnique({ where: { login: login.trim() } });
      if (existing) return res.status(409).json({ error: 'Пользователь уже существует' });

      const tempPassword = password || `dv_${Date.now().toString(36)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const user = await prisma.user.create({
        data: {
          id: genId(),
          login: login.trim(),
          passwordHash,
          name: name.trim(),
          email: email || null,
          phone: phone || null,
          role: 'support',
          platformRole: 'support',
        },
        select: {
          id: true, login: true, name: true, email: true, phone: true,
          role: true, platformRole: true, createdAt: true,
        },
      });

      writeAuditLog(null, req.user.id, req.user.name, 'support.create', 'user', user.id, { login });
      res.json({ data: { ...user, tempPassword: password ? undefined : tempPassword } });
    } catch (e) {
      console.error('Admin create support:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/support/:id', ...admin, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { platformRole: true } });
      if (user?.platformRole === 'superadmin') return res.status(403).json({ error: 'Нельзя удалить суперадмина' });
      await prisma.user.delete({ where: { id: req.params.id } });
      writeAuditLog(null, req.user.id, req.user.name, 'support.delete', 'user', req.params.id);
      res.json({ data: { ok: true } });
    } catch (e) {
      console.error('Admin delete support:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════

  router.get('/stats', ...admin, async (_req, res) => {
    try {
      const [totalClinics, activeClinics, totalUsers, supportUsers, totalPatients, totalAppointments] = await Promise.all([
        prisma.clinic.count(),
        prisma.clinic.count({ where: { active: true } }),
        prisma.user.count(),
        prisma.user.count({ where: { platformRole: 'support' } }),
        prisma.patient.count(),
        prisma.appointment.count(),
      ]);

      // MRR calculation
      const clinics = await prisma.clinic.findMany({ select: { plan: true } });
      const PLAN_PRICES = { starter: 15000, pro: 35000, enterprise: 150000 };
      const mrr = clinics.reduce((sum, c) => sum + (PLAN_PRICES[c.plan] || 15000), 0);

      // Expiring within 7 days
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      const expiringSoon = await prisma.subscription.count({
        where: { status: 'active', endDate: { lte: sevenDays, gte: new Date() } },
      });

      res.json({
        data: {
          totalClinics,
          activeClinics,
          blockedClinics: totalClinics - activeClinics,
          totalUsers,
          supportUsers,
          totalPatients,
          totalAppointments,
          mrr,
          expiringSoon,
        },
      });
    } catch (e) {
      console.error('Admin stats:', e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
