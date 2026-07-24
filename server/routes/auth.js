// ═══════════════════════════════════════════════════════════════
// Auth Routes — login, register (platform user only), token refresh,
// membership ( clinics ), clinic create / join / switch
// "User ≠ Clinic": registration never creates a clinic.
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateTokens, verifyToken, authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const ORG_ROLES = ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', 'cashier', 'accountant', 'laboratory', 'manager', 'intern'];

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' });
  res.clearCookie('refreshToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' });
}

async function buildUserPayload(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { include: { clinic: { select: { id: true, name: true, color: true, plan: true, logoUrl: true, type: true } } } },
    },
  });
  return user;
}

function publicUser(u) {
  return {
    id: u.id, login: u.login, name: u.name, firstName: u.firstName, lastName: u.lastName,
    username: u.username, email: u.email, phone: u.phone, bio: u.bio, photoUrl: u.photoUrl,
    spec: u.spec, headline: u.headline, city: u.city, country: u.country,
    experienceYears: u.experienceYears, platformRole: u.platformRole || 'user',
    clinicId: u.clinicId,
  };
}

export default function authRoutes(authLimiter) {
  const router = Router();

  // ─── Login ───
  router.post('/login', authLimiter, async (req, res) => {
    try {
      const { login, password } = req.body;
      if (!login || !password) return res.status(400).json({ error: 'Login and password required' });
      const user = await prisma.user.findUnique({ where: { login } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

      const memberships = await prisma.membership.findMany({ where: { userId: user.id, status: 'active' } });
      const active = memberships[0];
      const tokens = generateTokens(
        { ...user, platformRole: user.platformRole || 'user' },
        active?.clinicId || null,
        active?.role || null
      );
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ ...tokens, user: publicUser(user), memberships: memberships.map(m => ({ ...m, clinic: undefined })), activeMembership: active || null });
    } catch (e) {
      console.error('LOGIN ERROR:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Register (platform user ONLY — no clinic created) ───
  router.post('/register', authLimiter, async (req, res) => {
    try {
      const { name, firstName, lastName, login: loginStr, password, email, phone, spec, city, country } = req.body;
      if (!name || !loginStr || !password) return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });
      if (password.length < 8) return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
      const existing = await prisma.user.findUnique({ where: { login: loginStr } });
      if (existing) return res.status(400).json({ error: 'Такой логин уже занят — выберите другой' });
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomUUID();
      const user = await prisma.user.create({
        data: {
          id: userId, login: loginStr, passwordHash, name, firstName: firstName || null, lastName: lastName || null,
          email: email || null, phone: phone || null, spec: spec || null, city: city || null, country: country || null,
          role: 'user', platformRole: 'user',
        },
      });
      const tokens = generateTokens({ ...user, platformRole: 'user' }, null, null);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ ...tokens, user: publicUser(user), memberships: [], activeMembership: null });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Refresh Token ───
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
      const decoded = verifyToken(refreshToken);
      if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Invalid refresh token' });
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(401).json({ error: 'User not found' });
      const tokens = generateTokens(
        { ...user, platformRole: user.platformRole || 'user' },
        decoded.activeClinicId || user.clinicId || null,
        decoded.activeRole || user.role || null
      );
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json(tokens);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Me (current user + memberships) ───
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { memberships: { include: { clinic: { select: { id: true, name: true, color: true, plan: true, logoUrl: true, type: true } } } } },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      const active = user.memberships.find(m => m.clinicId === (req.user.activeClinicId))
        || user.memberships.find(m => m.status === 'active')
        || null;
      res.json({
        user: publicUser(user),
        memberships: user.memberships.map(m => ({ id: m.id, clinicId: m.clinicId, role: m.role, spec: m.spec, department: m.department, status: m.status, joinedAt: m.joinedAt, clinic: m.clinic })),
        activeMembership: active ? { id: active.id, clinicId: active.clinicId, role: active.role, spec: active.spec } : null,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Switch active clinic (re-issue token with new activeClinicId/role) ───
  router.post('/switch-clinic', authenticate, async (req, res) => {
    try {
      const { clinicId } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      let active = null;
      if (clinicId) {
        active = await prisma.membership.findFirst({ where: { userId: user.id, clinicId, status: 'active' } });
        if (!active) return res.status(403).json({ error: 'Вы не состоите в этой организации' });
      }
      const tokens = generateTokens(
        { ...user, platformRole: user.platformRole || 'user' },
        active?.clinicId || null,
        active?.role || null
      );
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ ...tokens, activeMembership: active ? { id: active.id, clinicId: active.clinicId, role: active.role, spec: active.spec } : null });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Create clinic (wizard) ───
  router.post('/clinics', authenticate, async (req, res) => {
    try {
      const { name, city, country, address, phone, email, logoUrl, language, timezone, currency, type, seats, plan } = req.body;
      if (!name) return res.status(400).json({ error: 'Название клиники обязательно' });
      const clinicId = crypto.randomUUID();
      const userId = req.user.id;
      const membershipId = crypto.randomUUID();
      const subscriptionId = crypto.randomUUID();
      await prisma.$transaction([
        prisma.clinic.create({
          data: {
            id: clinicId, name, city: city || null, country: country || null, address: address || null,
            phone: phone || null, email: email || null, logoUrl: logoUrl || null,
            language: language || 'ru', timezone: timezone || 'Asia/Almaty', currency: currency || 'KZT',
            type: type || 'clinic', seats: seats ? Number(seats) : 5, plan: plan || 'starter', active: true, color: '#C9A96E',
          },
        }),
        prisma.membership.create({
          data: { id: membershipId, userId, clinicId, role: 'owner', status: 'active' },
        }),
        prisma.subscription.create({
          data: { id: subscriptionId, clinicId, plan: plan || 'starter', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
        }),
      ]);
      // default service access: all on
      await prisma.serviceAccess.upsert({
        where: { clinicId },
        update: {}, create: { clinicId, crm: true, shop: true, school: true, ai: true, analytics: true, community: true },
      });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const tokens = generateTokens({ ...user, platformRole: user.platformRole || 'user' }, clinicId, 'owner');
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ ...tokens, clinic: { id: clinicId, name, plan: plan || 'starter', active: true, color: '#C9A96E' }, activeMembership: { id: membershipId, clinicId, role: 'owner' } });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Join clinic by invitation code / link ───
  router.post('/join-clinic', authenticate, async (req, res) => {
    try {
      const { code, clinicId } = req.body;
      if (!code && !clinicId) return res.status(400).json({ error: 'Укажите код приглашения или ID клиники' });
      const inv = await prisma.invitation.findFirst({
        where: { OR: [{ code }, { clinicId }], status: 'pending' },
      });
      if (!inv) return res.status(404).json({ error: 'Приглашение не найдено или уже использовано' });
      const userId = req.user.id;
      const existing = await prisma.membership.findFirst({ where: { userId, clinicId: inv.clinicId } });
      if (existing) return res.status(400).json({ error: 'Вы уже состоите в этой организации' });
      const membershipId = crypto.randomUUID();
      await prisma.$transaction([
        prisma.membership.create({ data: { id: membershipId, userId, clinicId: inv.clinicId, role: inv.role || 'doctor', spec: inv.spec || null, status: 'active', invitedBy: inv.invitedBy } }),
        prisma.invitation.update({ where: { id: inv.id }, data: { status: 'accepted' } }),
      ]);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const tokens = generateTokens({ ...user, platformRole: user.platformRole || 'user' }, inv.clinicId, inv.role || 'doctor');
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ ...tokens, clinic: { id: inv.clinicId }, activeMembership: { id: membershipId, clinicId: inv.clinicId, role: inv.role || 'doctor' } });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Create invitation (owner/admin of a clinic) ───
  router.post('/invitations', authenticate, async (req, res) => {
    try {
      const { clinicId, email, role, spec } = req.body;
      if (!clinicId) return res.status(400).json({ error: 'clinicId обязателен' });
      const mem = await prisma.membership.findFirst({ where: { userId: req.user.id, clinicId, status: 'active' } });
      if (!mem || !['owner', 'director', 'admin'].includes(mem.role)) return res.status(403).json({ error: 'Недостаточно прав' });
      if (role && !ORG_ROLES.includes(role)) return res.status(400).json({ error: 'Неизвестная роль' });
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const id = crypto.randomUUID();
      const inv = await prisma.invitation.create({
        data: { id, clinicId, code, email: email || null, role: role || 'doctor', spec: spec || null, invitedBy: req.user.id, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
      });
      res.json({ id: inv.id, code: inv.code, clinicId, role: inv.role, link: `${req.headers.origin || ''}/join?code=${inv.code}` });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── My clinics ───
  router.get('/my-clinics', authenticate, async (req, res) => {
    try {
      const memberships = await prisma.membership.findMany({
        where: { userId: req.user.id, status: 'active' },
        include: { clinic: { select: { id: true, name: true, color: true, plan: true, logoUrl: true, type: true, city: true } } },
        orderBy: { joinedAt: 'asc' },
      });
      res.json(memberships.map(m => ({ ...m, clinic: m.clinic })));
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Forgot Password ───
  router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
      const { login } = req.body;
      if (!login) return res.status(400).json({ error: 'Введите логин' });
      const user = await prisma.user.findUnique({ where: { login }, select: { id: true } });
      if (!user) return res.json({ message: 'Если аккаунт существует, инструкция отправлена' });
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordReset.upsert({ where: { userId: user.id }, update: { token, expiresAt: expires }, create: { userId: user.id, token, expiresAt: expires } });
      res.json({ message: 'Если аккаунт существует, инструкция отправлена' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Reset Password ───
  router.post('/reset-password', authLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
      const reset = await prisma.passwordReset.findFirst({ where: { token, expiresAt: { gt: new Date() } } });
      if (!reset) return res.status(400).json({ error: 'Неверный или просроченный токен' });
      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } });
      await prisma.passwordReset.delete({ where: { userId: reset.userId } });
      res.json({ message: 'Пароль успешно изменён' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
