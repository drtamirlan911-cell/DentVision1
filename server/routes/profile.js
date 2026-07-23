// ═══════════════════════════════════════════════════════════════
// Profile Routes — platform user professional profile (LinkedIn-style)
// Belongs to User, not Clinic. Skills / certificates / achievements /
// portfolio / cases / reviews / activity are all user-scoped.
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const EDITABLE_USER_FIELDS = [
  'firstName', 'lastName', 'username', 'headline', 'bio', 'city',
  'country', 'spec', 'experienceYears', 'phone', 'email', 'photoUrl', 'visibility',
];

export default function profileRoutes() {
  const router = Router();

  // ─── Full profile (self) ───
  router.get('/', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;
      const [user, skills, certificates, achievements, portfolio, cases, reviews, activities] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true, login: true, name: true, firstName: true, lastName: true, username: true,
            headline: true, bio: true, photoUrl: true, city: true, country: true, spec: true,
            experienceYears: true, phone: true, email: true, visibility: true, platformRole: true,
            createdAt: true,
          },
        }),
        prisma.userSkill.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
        prisma.userCertificateModel.findMany({ where: { userId }, orderBy: { year: 'desc' } }),
        prisma.userAchievement.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
        prisma.userPortfolioItem.findMany({ where: { userId }, orderBy: { id: 'desc' } }),
        prisma.userCase.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.userReview.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.userActivity.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
      ]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user, skills, certificates, achievements, portfolio, cases, reviews, activities });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Public profile (by userId or username) ───
  router.get('/:identifier', authenticate, async (req, res) => {
    try {
      const { identifier } = req.params;
      const where = identifier.length > 30 ? { id: identifier } : { OR: [{ id: identifier }, { username: identifier }] };
      const user = await prisma.user.findFirst({
        where,
        select: {
          id: true, name: true, firstName: true, lastName: true, username: true, headline: true,
          bio: true, photoUrl: true, city: true, country: true, spec: true, experienceYears: true,
          visibility: true, platformRole: true, createdAt: true,
        },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.visibility === 'private' && req.user?.id !== user.id) {
        return res.status(403).json({ error: 'Профиль скрыт' });
      }
      const [skills, certificates, achievements, portfolio, cases, reviews] = await Promise.all([
        prisma.userSkill.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
        prisma.userCertificateModel.findMany({ where: { userId: user.id }, orderBy: { year: 'desc' } }),
        prisma.userAchievement.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' } }),
        prisma.userPortfolioItem.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' } }),
        prisma.userCase.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
        prisma.userReview.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
      ]);
      res.json({ user, skills, certificates, achievements, portfolio, cases, reviews });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Update user profile fields ───
  router.put('/', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;
      const data = {};
      for (const f of EDITABLE_USER_FIELDS) {
        if (req.body[f] !== undefined) data[f] = req.body[f];
      }
      if (data.username) {
        const conflict = await prisma.user.findFirst({ where: { username: data.username, NOT: { id: userId } } });
        if (conflict) return res.status(400).json({ error: 'Этот username уже занят' });
      }
      const user = await prisma.user.update({ where: { id: userId }, data });
      res.json({
        id: user.id, login: user.login, name: user.name, firstName: user.firstName, lastName: user.lastName,
        username: user.username, email: user.email, phone: user.phone, bio: user.bio, photoUrl: user.photoUrl,
        spec: user.spec, headline: user.headline, city: user.city, country: user.country,
        experienceYears: user.experienceYears, platformRole: user.platformRole, visibility: user.visibility,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Skills CRUD ───
  router.post('/skills', authenticate, async (req, res) => {
    try {
      const { name, level } = req.body;
      if (!name) return res.status(400).json({ error: 'Название навыка обязательно' });
      const item = await prisma.userSkill.create({ data: { id: crypto.randomUUID(), userId: req.user.id, name, level: level || null } });
      res.json(item);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });
  router.delete('/skills/:id', authenticate, async (req, res) => {
    try {
      await prisma.userSkill.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Certificates CRUD ───
  router.post('/certificates', authenticate, async (req, res) => {
    try {
      const { title, issuer, year, fileUrl, issuedAt } = req.body;
      if (!title) return res.status(400).json({ error: 'Название сертификата обязательно' });
      const item = await prisma.userCertificateModel.create({
        data: { id: crypto.randomUUID(), userId: req.user.id, title, issuer: issuer || null, year: year || null, fileUrl: fileUrl || null, issuedAt: issuedAt ? new Date(issuedAt) : null },
      });
      res.json(item);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });
  router.delete('/certificates/:id', authenticate, async (req, res) => {
    try {
      await prisma.userCertificateModel.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Achievements CRUD ───
  router.post('/achievements', authenticate, async (req, res) => {
    try {
      const { title, description, date } = req.body;
      if (!title) return res.status(400).json({ error: 'Название достижения обязательно' });
      const item = await prisma.userAchievement.create({
        data: { id: crypto.randomUUID(), userId: req.user.id, title, description: description || null, date: date ? new Date(date) : null },
      });
      res.json(item);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });
  router.delete('/achievements/:id', authenticate, async (req, res) => {
    try {
      await prisma.userAchievement.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Portfolio CRUD ───
  router.post('/portfolio', authenticate, async (req, res) => {
    try {
      const { title, description, imageUrl, link } = req.body;
      if (!title) return res.status(400).json({ error: 'Название работы обязательно' });
      const item = await prisma.userPortfolioItem.create({
        data: { id: crypto.randomUUID(), userId: req.user.id, title, description: description || null, imageUrl: imageUrl || null, link: link || null },
      });
      res.json(item);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });
  router.delete('/portfolio/:id', authenticate, async (req, res) => {
    try {
      await prisma.userPortfolioItem.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Cases CRUD ───
  router.post('/cases', authenticate, async (req, res) => {
    try {
      const { title, description, beforeImage, afterImage, tags } = req.body;
      if (!title) return res.status(400).json({ error: 'Название кейса обязательно' });
      const item = await prisma.userCase.create({
        data: { id: crypto.randomUUID(), userId: req.user.id, title, description: description || null, beforeImage: beforeImage || null, afterImage: afterImage || null, tags: Array.isArray(tags) ? tags : [] },
      });
      res.json(item);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });
  router.delete('/cases/:id', authenticate, async (req, res) => {
    try {
      await prisma.userCase.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
