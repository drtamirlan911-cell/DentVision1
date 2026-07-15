// ═══════════════════════════════════════════════════════════════
// School Routes — courses, enrollments, clinical cases, library
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireServiceAccess } from '../middleware/serviceAccess.js';
import prisma from '../lib/prisma.js';

export default function schoolRoutes() {
  const router = Router();

  // ─── Courses (public read) ───
  router.get('/courses', async (req, res) => {
    try {
      const { category, search, difficulty } = req.query;
      const where = {};
      if (category) where.category = category;
      if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
      if (difficulty) where.difficulty = difficulty;
      const result = await prisma.schoolCourse.findMany({ where, orderBy: { enrolledCount: 'desc' } });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/courses/:id', async (req, res) => {
    try {
      const course = await prisma.schoolCourse.findUnique({
        where: { id: req.params.id },
        include: { modules: { orderBy: { sortOrder: 'asc' }, include: { lessons: { orderBy: { sortOrder: 'asc' } } } } },
      });
      if (!course) return res.status(404).json({ error: 'Not found' });
      res.json(course);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Enrollments (authenticated) ───
  router.post('/enrollments', authenticate, requireServiceAccess('school'), async (req, res) => {
    try {
      const { course_id } = req.body;
      const existing = await prisma.schoolEnrollment.findFirst({ where: { userId: req.user.id, courseId: course_id } });
      if (existing) return res.json(existing);
      const id = crypto.randomUUID();
      await prisma.schoolEnrollment.create({
        data: { id, clinicId: req.user.clinicId, userId: req.user.id, userName: req.user.name, courseId: course_id },
      });
      await prisma.schoolCourse.update({ where: { id: course_id }, data: { enrolledCount: { increment: 1 } } });
      res.json({ id, success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/enrollments', authenticate, requireServiceAccess('school'), async (req, res) => {
    try {
      const result = await prisma.schoolEnrollment.findMany({
        where: { userId: req.user.id },
        include: { course: { select: { title: true, category: true, difficulty: true, imageUrl: true, instructor: true } } },
        orderBy: { startedAt: 'desc' },
      });
      res.json(result.map(e => ({ ...e, title: e.course?.title, category: e.course?.category, difficulty: e.course?.difficulty, image_url: e.course?.imageUrl, instructor: e.course?.instructor })));
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Clinical Cases (public read) ───
  router.get('/clinical-cases', async (req, res) => {
    try {
      const { category } = req.query;
      const where = category ? { category } : {};
      const result = await prisma.schoolClinicalCase.findMany({ where, orderBy: { createdAt: 'desc' } });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Library (public read) ───
  router.get('/library', async (req, res) => {
    try {
      const { category, type } = req.query;
      const where = {};
      if (category) where.category = category;
      if (type) where.type = type;
      const result = await prisma.schoolLibrary.findMany({ where, orderBy: { createdAt: 'desc' } });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Certificates (authenticated) ───
  router.get('/certificates', authenticate, requireServiceAccess('school'), async (req, res) => {
    try {
      const result = await prisma.schoolCertificate.findMany({
        where: { userId: req.user.id },
        orderBy: { issuedAt: 'desc' },
      });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
