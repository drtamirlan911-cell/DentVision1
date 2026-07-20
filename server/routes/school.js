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
import { resolveExamPayload, publicExamView, gradeExam } from '../lib/exams.js';

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
      const { course_id, clinic_id } = req.body;
      // Enroll "for clinic" when clinic_id provided, else personal (active clinic if any)
      const targetClinicId = clinic_id || req.user.activeClinicId || req.user.clinicId || null;
      if (targetClinicId) {
        const isSuper = req.user.platformRole === 'superadmin' || req.user.role === 'superadmin';
        if (!isSuper && targetClinicId !== (req.user.activeClinicId || req.user.clinicId)) {
          return res.status(403).json({ error: 'Access denied: cross-clinic access forbidden' });
        }
      }
      const existing = await prisma.schoolEnrollment.findFirst({ where: { userId: req.user.id, courseId: course_id } });
      if (existing) return res.json(existing);
      const id = crypto.randomUUID();
      await prisma.schoolEnrollment.create({
        data: { id, clinicId: targetClinicId, userId: req.user.id, userName: req.user.name, courseId: course_id },
      });
      await prisma.schoolCourse.update({ where: { id: course_id }, data: { enrolledCount: { increment: 1 } } });
      // Push to the unified Notification Center (personal)
      const course = await prisma.schoolCourse.findUnique({ where: { id: course_id }, select: { title: true } });
      await createNotification({
        type: 'school',
        category: 'enrollment',
        clinicId: targetClinicId,
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

  // ─── Exam engine ───
  router.get('/lessons/:lessonId/exam', authenticate, requireServiceAccess('school'), async (req, res) => {
    try {
      const lesson = await prisma.schoolLesson.findUnique({ where: { id: req.params.lessonId } });
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
      if (!['test', 'exam', 'quiz'].includes(String(lesson.type || '').toLowerCase()) && !lesson.content) {
        // Still allow exam payload via default bank for practice lessons marked as test in UI
      }
      const exam = resolveExamPayload(lesson);
      res.json({
        lessonId: lesson.id,
        courseId: lesson.courseId,
        type: lesson.type || 'test',
        exam: publicExamView(exam),
      });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
  });

  router.post('/lessons/:lessonId/exam/submit', authenticate, requireServiceAccess('school'), async (req, res) => {
    try {
      const lesson = await prisma.schoolLesson.findUnique({ where: { id: req.params.lessonId } });
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
      const exam = resolveExamPayload(lesson);
      const result = gradeExam(exam, req.body?.answers || {});

      // Persist attempt when table exists
      try {
        if (prisma.schoolExamAttempt) {
          await prisma.schoolExamAttempt.create({
            data: {
              id: crypto.randomUUID(),
              userId: req.user.id,
              userName: req.user.name || req.user.login,
              courseId: lesson.courseId || req.body?.courseId || '',
              lessonId: lesson.id,
              answers: req.body?.answers || {},
              score: result.score,
              passed: result.passed,
              passingScore: result.passingScore,
              total: result.total,
            },
          });
        }
      } catch { /* table may not exist yet */ }

      // On pass: mark lesson complete + maybe certificate
      let certificate = null;
      if (result.passed && lesson.courseId) {
        const enrollment = await prisma.schoolEnrollment.findFirst({
          where: { userId: req.user.id, courseId: lesson.courseId },
        });
        if (enrollment) {
          let completed = [];
          try {
            completed = Array.isArray(enrollment.completedLessons)
              ? enrollment.completedLessons
              : JSON.parse(enrollment.completedLessons || '[]');
          } catch { completed = []; }
          if (!completed.includes(lesson.id)) completed.push(lesson.id);

          const course = await prisma.schoolCourse.findUnique({
            where: { id: lesson.courseId },
            include: { lessons: { select: { id: true } }, modules: { include: { lessons: { select: { id: true } } } } },
          });
          const allLessonIds = new Set([
            ...(course?.lessons || []).map((l) => l.id),
            ...((course?.modules || []).flatMap((m) => (m.lessons || []).map((l) => l.id))),
          ]);
          const progress = allLessonIds.size
            ? Math.min(100, Math.round((completed.filter((id) => allLessonIds.has(id)).length / allLessonIds.size) * 100))
            : Math.max(enrollment.progress || 0, result.score);

          const done = progress >= 100 || String(lesson.type).toLowerCase() === 'exam';
          await prisma.schoolEnrollment.update({
            where: { id: enrollment.id },
            data: {
              completedLessons: completed,
              progress: done ? 100 : progress,
              completed: done || enrollment.completed,
              completedAt: done ? (enrollment.completedAt || new Date()) : enrollment.completedAt,
            },
          });

          if ((done || String(lesson.type).toLowerCase() === 'exam') && course?.certificateEnabled !== false) {
            const existingCert = await prisma.schoolCertificate.findFirst({
              where: { userId: req.user.id, courseId: lesson.courseId },
            });
            if (!existingCert) {
              const certId = crypto.randomUUID();
              const num = 'DV-' + new Date().getFullYear() + '-' + crypto.randomUUID().slice(0, 6).toUpperCase();
              certificate = await prisma.schoolCertificate.create({
                data: {
                  id: certId,
                  clinicId: enrollment.clinicId,
                  userId: req.user.id,
                  userName: enrollment.userName || req.user.name,
                  courseId: lesson.courseId,
                  courseTitle: course?.title,
                  certificateNumber: num,
                },
              });
              await createNotification({
                type: 'school',
                category: 'certificate',
                clinicId: enrollment.clinicId,
                userId: req.user.id,
                title: 'Сертификат получен',
                message: `Экзамен сдан (${result.score}%). Сертификат по курсу «${course?.title}»`,
                actionUrl: '/school',
              });
            } else {
              certificate = existingCert;
            }
          }
        }
      }

      res.json({
        ...result,
        details: result.details.map((d) => ({ id: d.id, selected: d.selected, correct: d.correct })),
        certificate,
      });
    } catch (e) {
      console.error('Exam submit error:', e);
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
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
