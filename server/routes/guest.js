// ═══════════════════════════════════════════════════════════════
// Guest Routes — anonymous sessions, demo data (no auth)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET;

const DEMO_CLINIC_ID = 'demo-clinic-001';
const GUEST_AI_LIMIT = 20;

function generateGuestToken(guestId) {
  return jwt.sign(
    { id: guestId, name: 'Гость', role: 'guest', platformRole: 'guest', isGuest: true },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export default function guestRoutes() {
  const router = Router();

  // ─── Create guest session ───
  router.post('/session', async (req, res) => {
    try {
      let guestId = req.body?.guestId;
      const existing = guestId
        ? await prisma.user.findFirst({ where: { id: guestId, role: 'guest' } })
        : null;

      if (existing) {
        const token = generateGuestToken(existing.id);
        return res.json({ guestId: existing.id, token, aiRequestsLeft: GUEST_AI_LIMIT });
      }

      guestId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: guestId,
          login: `guest_${guestId.slice(0, 8)}`,
          name: 'Гость',
          password: crypto.randomBytes(32).toString('hex'),
          role: 'guest',
          platformRole: 'guest',
        },
      });

      const token = generateGuestToken(guestId);
      res.json({ guestId, token, aiRequestsLeft: GUEST_AI_LIMIT });
    } catch (err) {
      console.error('Guest session error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Get demo clinic data ───
  router.get('/demo/clinic', async (_req, res) => {
    try {
      let clinic = await prisma.clinic.findFirst({ where: { id: DEMO_CLINIC_ID } });
      if (!clinic) {
        clinic = await prisma.clinic.create({
          data: {
            id: DEMO_CLINIC_ID,
            name: 'DentVision Demo Clinic',
            city: 'Алматы',
            address: 'ул. Достык 55',
            phone: '+77001234567',
            color: '#C9A96E',
            active: true,
            plan: 'enterprise',
          },
        });
      }
      res.json({
        clinic,
        doctors: [
          { id: 'demo-doc-1', name: 'Айбек К.', spec: 'Терапевт', experienceYears: 12 },
          { id: 'demo-doc-2', name: 'Сауле М.', spec: 'Ортодонт', experienceYears: 8 },
          { id: 'demo-doc-3', name: 'Данияр А.', spec: 'Хирург', experienceYears: 15 },
        ],
      });
    } catch (err) {
      console.error('Demo clinic error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Demo patients (sample) ───
  router.get('/demo/patients', async (_req, res) => {
    res.json([
      { id: 'dp-1', name: 'Иванов Петр', phone: '+77001112233', birthDate: '1985-03-15', balance: 0 },
      { id: 'dp-2', name: 'Козлова Анна', phone: '+77003334455', birthDate: '1992-07-22', balance: 5000 },
      { id: 'dp-3', name: 'Нурланов С.', phone: '+77005556677', birthDate: '1978-11-03', balance: -1200 },
    ]);
  });

  // ─── Demo schedule (sample) ───
  router.get('/demo/schedule', async (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    res.json([
      { id: 'ds-1', patientName: 'Иванов Петр', doctor: 'Айбек К.', time: '09:00', date: today, status: 'completed', services: ['Лечение кариеса'] },
      { id: 'ds-2', patientName: 'Козлова Анна', doctor: 'Сауле М.', time: '11:30', date: today, status: 'confirmed', services: ['Консультация ортодонта'] },
      { id: 'ds-3', patientName: 'Нурланов С.', doctor: 'Данияр А.', time: '14:00', date: today, status: 'pending', services: ['Удаление зуба'] },
    ]);
  });

  // ─── Demo products (mirror of shop) ───
  router.get('/demo/products', async (_req, res) => {
    try {
      const products = await prisma.shopProduct.findMany({ take: 10, orderBy: { rating: 'desc' } });
      res.json(products);
    } catch {
      res.json([]);
    }
  });

  // ─── Demo courses (mirror of school) ───
  router.get('/demo/courses', async (_req, res) => {
    try {
      const courses = await prisma.schoolCourse.findMany({ take: 10, orderBy: { enrolledCount: 'desc' } });
      res.json(courses);
    } catch {
      res.json([]);
    }
  });

  // ─── Convert guest → registered user ───
  router.post('/convert', async (req, res) => {
    try {
      const { guestId, login, password, name, email } = req.body;
      if (!guestId || !login || !password) {
        return res.status(400).json({ error: 'guestId, login, password required' });
      }

      const existing = await prisma.user.findFirst({ where: { login } });
      if (existing) return res.status(400).json({ error: 'Login already taken' });

      const bcrypt = await import('bcrypt');
      const hashed = await bcrypt.hash(password, 12);

      const user = await prisma.user.update({
        where: { id: guestId },
        data: {
          login,
          password: hashed,
          name: name || 'Пользователь',
          email: email || null,
          role: 'user',
          platformRole: 'user',
        },
      });

      res.json({ user: { id: user.id, login: user.login, name: user.name } });
    } catch (err) {
      console.error('Guest convert error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
