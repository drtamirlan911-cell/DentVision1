import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

const schoolRouter = Router();

schoolRouter.get('/courses', async (req, res) => {
  try {
    const { category, search } = req.query;

    const where: Record<string, unknown> = {};

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      include: { _count: { select: { lessons: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: courses });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch courses' });
  }
});

schoolRouter.get('/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
    });

    if (!course) {
      res.status(404).json({ ok: false, error: 'Course not found' });
      return;
    }

    res.json({ ok: true, data: course });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch course' });
  }
});

schoolRouter.post('/enrollments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user!.id;

    if (!courseId) {
      res.status(400).json({ ok: false, error: 'courseId is required' });
      return;
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      res.status(404).json({ ok: false, error: 'Course not found' });
      return;
    }

    const existing = await prisma.schoolEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) {
      res.status(409).json({ ok: false, error: 'Already enrolled in this course' });
      return;
    }

    const enrollment = await prisma.schoolEnrollment.create({
      data: {
        id: uid(),
        userId,
        courseId,
      },
      include: { course: true },
    });

    res.status(201).json({ ok: true, data: enrollment });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create enrollment' });
  }
});

schoolRouter.get('/enrollments', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const enrollments = await prisma.schoolEnrollment.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: enrollments });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch enrollments' });
  }
});

schoolRouter.patch('/enrollments/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { progress, completed } = req.body;
    const userId = req.user!.id;

    const enrollment = await prisma.schoolEnrollment.findUnique({ where: { id } });

    if (!enrollment) {
      res.status(404).json({ ok: false, error: 'Enrollment not found' });
      return;
    }

    if (enrollment.userId !== userId) {
      res.status(403).json({ ok: false, error: 'Not your enrollment' });
      return;
    }

    if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
      res.status(400).json({ ok: false, error: 'progress must be a number between 0 and 100' });
      return;
    }

    const updated = await prisma.schoolEnrollment.update({
      where: { id },
      data: {
        ...(progress !== undefined && { progress: Math.round(progress) }),
        ...(completed !== undefined && { completed }),
      },
      include: { course: true },
    });

    res.json({ ok: true, data: updated });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update enrollment' });
  }
});

export { schoolRouter };
