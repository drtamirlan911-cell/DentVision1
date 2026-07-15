// ═══════════════════════════════════════════════════════════════
// Auth Routes — login, register, forgot/reset password, token refresh
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateTokens, verifyToken, authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

export default function authRoutes(authLimiter) {
  const router = Router();

  // ─── Login ───
  router.post('/login', authLimiter, async (req, res) => {
    try {
      const { login, password } = req.body;
      if (!login || !password) {
        return res.status(400).json({ error: 'Login and password required' });
      }
      const user = await prisma.user.findUnique({ where: { login } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const tokens = generateTokens({
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
        spec: user.spec,
        phone: user.phone,
        email: user.email,
        photo_url: user.photoUrl,
      });
      res.json(tokens);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Register ───
  router.post('/register', authLimiter, async (req, res) => {
    try {
      const { clinicName, city, phone, email, directorName, login: loginStr, password } = req.body;
      if (!clinicName || !loginStr || !password || !directorName) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      }
      const existing = await prisma.user.findUnique({ where: { login: loginStr } });
      if (existing) {
        return res.status(400).json({ error: 'Такой логин уже занят — выберите другой' });
      }
      const clinicId = crypto.randomUUID();
      const directorId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);

      await prisma.$transaction([
        prisma.clinic.create({
          data: { id: clinicId, name: clinicName, city: city || '', phone: phone || '', address: '', plan: 'starter', active: true, color: '#C9A96E' },
        }),
        prisma.user.create({
          data: { id: directorId, clinicId, login: loginStr, passwordHash, name: directorName, role: 'director', spec: 'Руководитель', phone: phone || '', email: email || '' },
        }),
      ]);

      const tokens = generateTokens({
        id: directorId, login: loginStr, name: directorName, role: 'director', clinicId,
      });
      res.json({
        ...tokens,
        clinic: { id: clinicId, name: clinicName, city: city || '', plan: 'starter', active: true, color: '#C9A96E' },
      });
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
      const tokens = generateTokens({
        id: user.id, login: user.login, name: user.name, role: user.role, clinicId: user.clinicId,
      });
      res.json(tokens);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  // ─── Me (get current user from token) ───
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, clinicId: true, login: true, name: true, role: true, spec: true, phone: true, email: true, photoUrl: true },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
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
      if (!user) {
        return res.json({ message: 'Если аккаунт существует, инструкция отправлена' });
      }
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordReset.upsert({
        where: { userId: user.id },
        update: { token, expiresAt: expires },
        create: { userId: user.id, token, expiresAt: expires },
      });
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
      if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      const reset = await prisma.passwordReset.findFirst({
        where: { token, expiresAt: { gt: new Date() } },
      });
      if (!reset) return res.status(400).json({ error: 'Неверный или просроченный токен' });
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } });
      await prisma.passwordReset.delete({ where: { userId: reset.userId } });
      res.json({ message: 'Пароль успешно изменён' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
