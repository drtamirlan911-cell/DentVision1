// ═══════════════════════════════════════════════════════════════
// School Routes — courses, enrollments, clinical cases, library
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireServiceAccess } from '../middleware/serviceAccess.js';
import { requireSuperadmin } from '../middleware/rbac.js';
import { createNotification } from '../lib/notifications.js';
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
      // Push to the unified Notification Center (personal)
      const course = await prisma.schoolCourse.findUnique({ where: { id: course_id }, select: { title: true } });
      await createNotification({
        type: 'school',
        category: 'enrollment',
        clinicId: req.user.clinicId,
        userId: req.user.id,
        title: 'Вы записались на курс',
        message: `«${course?.title || 'Курс'}» — обучение доступно в Академии`,
        actionUrl: '/school',
      });
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

  router.patch('/enrollments/:id', authenticate, requireServiceAccess('school'), async (req, res) => {
    try {
      const { progress, completedLessons } = req.body;
      const enrollment = await prisma.schoolEnrollment.findUnique({ where: { id: req.params.id } });
      if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
      if (enrollment.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      const completed = (progress ?? enrollment.progress ?? 0) >= 100;
      const updated = await prisma.schoolEnrollment.update({
        where: { id: req.params.id },
        data: {
          progress: progress ?? enrollment.progress,
          completedLessons: completedLessons !== undefined ? JSON.stringify(completedLessons) : undefined,
          completed,
          completedAt: completed ? (enrollment.completedAt || new Date()) : null,
        },
      });
      if (completed && !enrollment.completed) {
        const course = await prisma.schoolCourse.findUnique({ where: { id: enrollment.courseId }, select: { title: true, certificateEnabled: true } });
        if (course?.certificateEnabled !== false) {
          const certId = crypto.randomUUID();
          const num = 'DV-' + new Date().getFullYear() + '-' + crypto.randomUUID().slice(0, 6).toUpperCase();
          await prisma.schoolCertificate.create({
            data: { id: certId, clinicId: enrollment.clinicId, userId: enrollment.userId, userName: enrollment.userName, courseId: enrollment.courseId, courseTitle: course?.title, certificateNumber: num },
          });
          await createNotification({
            type: 'school', category: 'certificate', clinicId: enrollment.clinicId, userId: enrollment.userId,
            title: 'Сертификат получен', message: `Вы завершили курс «${course?.title}» и получили сертификат`, actionUrl: '/school',
          });
        }
      }
      res.json(updated);
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

  // ═══════════════════════════════════════════════════════════════
  // CONTENT MANAGEMENT (superadmin — "methodist cabinet")
  // ═══════════════════════════════════════════════════════════════

  // Helper: build nested modules/lessons for a course
  function buildModules(modules) {
    if (!Array.isArray(modules)) return undefined;
    return {
      create: modules.map((m) => ({
        id: m.id || crypto.randomUUID(),
        title: m.title,
        sortOrder: Number(m.sortOrder) || 0,
        lessons: {
          create: (m.lessons || []).map((l) => ({
            id: l.id || crypto.randomUUID(),
            title: l.title,
            duration: Number(l.duration) || 0,
            type: l.type || 'video',
            contentUrl: l.contentUrl || null,
            sortOrder: Number(l.sortOrder) || 0,
          })),
        },
      })),
    };
  }

  // Courses (with nested modules + lessons)
  router.post('/courses', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || crypto.randomUUID();
      const result = await prisma.schoolCourse.create({
        data: {
          id,
          category: b.category, title: b.title, subtitle: b.subtitle, description: b.description,
          instructor: b.instructor, instructorTitle: b.instructorTitle,
          difficulty: b.difficulty || 'beginner', durationHours: Number(b.durationHours) || 0,
          lessonCount: Number(b.lessonCount) || 0, price: Number(b.price) || 0,
          rating: Number(b.rating) || 0, enrolledCount: 0,
          tags: b.tags || [], imageUrl: b.imageUrl || null,
          certificateEnabled: b.certificateEnabled !== false,
          modules: buildModules(b.modules) || undefined,
        },
      });
      res.json(result);
    } catch (e) { console.error('Course create error:', e.message); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.put('/courses/:id', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      const b = req.body;
      // Replace modules + lessons wholesale for simplicity
      await prisma.schoolModule.deleteMany({ where: { courseId: req.params.id } });
      const result = await prisma.schoolCourse.update({
        where: { id: req.params.id },
        data: {
          category: b.category, title: b.title, subtitle: b.subtitle, description: b.description,
          instructor: b.instructor, instructorTitle: b.instructorTitle,
          difficulty: b.difficulty || 'beginner', durationHours: Number(b.durationHours) || 0,
          lessonCount: Number(b.lessonCount) || 0, price: Number(b.price) || 0,
          rating: Number(b.rating) || 0,
          tags: b.tags || [], imageUrl: b.imageUrl || null,
          certificateEnabled: b.certificateEnabled !== false,
          modules: buildModules(b.modules) || undefined,
        },
      });
      res.json(result);
    } catch (e) { console.error('Course update error:', e.message); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.delete('/courses/:id', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      await prisma.schoolCourse.delete({ where: { id: req.params.id } });
      res.json({ deleted: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // Clinical cases
  router.post('/clinical-cases', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || crypto.randomUUID();
      const result = await prisma.schoolClinicalCase.upsert({
        where: { id },
        update: { category: b.category, title: b.title, description: b.description, difficulty: b.difficulty, author: b.author, imageUrl: b.imageUrl || null },
        create: { id, category: b.category, title: b.title, description: b.description, difficulty: b.difficulty, author: b.author, imageUrl: b.imageUrl || null },
      });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.delete('/clinical-cases/:id', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      await prisma.schoolClinicalCase.delete({ where: { id: req.params.id } });
      res.json({ deleted: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // Library
  router.post('/library', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || crypto.randomUUID();
      const result = await prisma.schoolLibrary.upsert({
        where: { id },
        update: { category: b.category, title: b.title, type: b.type || 'article', content: b.content, fileUrl: b.fileUrl || null, author: b.author, tags: b.tags || [] },
        create: { id, category: b.category, title: b.title, type: b.type || 'article', content: b.content, fileUrl: b.fileUrl || null, author: b.author, tags: b.tags || [] },
      });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.delete('/library/:id', authenticate, requireSuperadmin(), async (req, res) => {
    try {
      await prisma.schoolLibrary.delete({ where: { id: req.params.id } });
      res.json({ deleted: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
