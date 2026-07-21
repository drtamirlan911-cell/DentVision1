import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { AuthRequest } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import {
  CLINICAL_CASES,
  DEFAULT_EXAM,
  LIBRARY_ITEMS,
  reviewHomework,
  upcomingLiveSessions,
} from './academyContent.js';

const schoolRouter = Router();

function mapCourse(course: any) {
  const lessonCount = course._count?.lessons ?? course.lessons?.length ?? 0;
  const durationHours = course.duration
    ? Number(String(course.duration).replace(/[^\d.]/g, '')) || lessonCount
    : lessonCount;
  return {
    id: course.id,
    title: course.title,
    subtitle: course.author || course.lecturer?.userId || '',
    description: course.description,
    category: course.category || 'Общее',
    difficulty: 'intermediate',
    rating: 4.8,
    lesson_count: lessonCount,
    lessonCount,
    duration_hours: durationHours,
    durationHours,
    enrolled_count: course._count?.enrollments ?? 0,
    enrolledCount: course._count?.enrollments ?? 0,
    instructor: course.author || course.lecturerBio || 'Academy OS',
    lecturerId: course.lecturerId,
    academyId: course.academyId,
    academyName: course.academy?.name || null,
    lecturerLevel: course.lecturer?.level || null,
    image_url: course.imageUrl,
    imageUrl: course.imageUrl,
    price: course.price,
    created_at: course.createdAt,
  };
}

function mapCourseDetail(course: any) {
  const lessons = (course.lessons || []).map((l: any, idx: number) => {
    const content = String(l.content || '');
    const type = content.includes('[EXAM]')
      ? 'exam'
      : content.includes('[TEST]')
        ? 'test'
        : content.includes('[HOMEWORK]')
          ? 'homework'
          : l.videoUrl
            ? 'video'
            : 'pdf';
    return {
      id: l.id,
      title: l.title,
      type,
      order: l.order ?? idx,
      duration: l.duration,
      duration_minutes: l.duration ? Number(String(l.duration).replace(/[^\d.]/g, '')) || 15 : 15,
      videoUrl: l.videoUrl,
      content: l.content,
      module_id: 'm1',
    };
  });

  // Every Academy OS course ends with certification exam if none tagged.
  if (!lessons.some((l: { type: string }) => l.type === 'exam' || l.type === 'test')) {
    lessons.push({
      id: `exam-${course.id}`,
      title: 'Итоговый экзамен · сертификация',
      type: 'exam',
      order: lessons.length,
      duration: '30 мин',
      duration_minutes: 30,
      videoUrl: null,
      content: '[EXAM]',
      module_id: 'm1',
    });
  }

  return {
    ...mapCourse(course),
    modules: [
      {
        id: 'm1',
        title: 'Основной модуль',
        sort_order: 1,
        lessons,
      },
    ],
    lessons,
  };
}

schoolRouter.get('/hub', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const [courses, academies, lecturers, enrollments] = await Promise.all([
      prisma.course.findMany({
        include: {
          _count: { select: { lessons: true, enrollments: true } },
          academy: { select: { id: true, name: true, city: true } },
          lecturer: { select: { id: true, level: true, bio: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.academy.findMany({
        include: { _count: { select: { lecturers: true, courses: true } } },
        orderBy: { name: 'asc' },
        take: 50,
      }),
      prisma.lecturer.findMany({
        include: {
          academy: { select: { id: true, name: true } },
          _count: { select: { courses: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      req.user?.id
        ? prisma.schoolEnrollment.findMany({
            where: { userId: req.user.id, completed: true },
            include: { course: { select: { id: true, title: true, category: true } } },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    const users = lecturers.length
      ? await prisma.user.findMany({
          where: { id: { in: lecturers.map((l) => l.userId) } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameByUser = Object.fromEntries(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    res.json({
      ok: true,
      data: {
        kpis: {
          courses: courses.length,
          academies: academies.length,
          lecturers: lecturers.length,
          cases: CLINICAL_CASES.length,
          live: upcomingLiveSessions().length,
          certificates: enrollments.length,
        },
        courses: courses.map(mapCourse),
        academies: academies.map((a) => ({
          id: a.id,
          name: a.name,
          city: a.city,
          lecturers: a._count.lecturers,
          courses: a._count.courses,
        })),
        lecturers: lecturers.map((l) => ({
          id: l.id,
          name: nameByUser[l.userId] || 'Лектор',
          level: l.level,
          bio: l.bio,
          academyName: l.academy?.name || null,
          courses: l._count.courses,
        })),
        cases: CLINICAL_CASES,
        library: LIBRARY_ITEMS,
        live: upcomingLiveSessions(),
        certificates: enrollments.map((e: any) => ({
          id: e.id,
          courseId: e.courseId,
          courseTitle: e.course?.title,
          category: e.course?.category,
          issuedAt: e.updatedAt,
          certificateUrl: e.certificateUrl || null,
          status: 'issued',
        })),
      },
    });
  } catch (error) {
    console.error('Academy OS hub error:', error);
    res.status(500).json({ ok: false, error: 'Не удалось загрузить Academy OS' });
  }
});

schoolRouter.get('/courses', async (req, res) => {
  try {
    const { category, search } = req.query;
    const where: Record<string, unknown> = {};

    if (category && typeof category === 'string') where.category = category;
    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        _count: { select: { lessons: true, enrollments: true } },
        academy: { select: { id: true, name: true } },
        lecturer: { select: { id: true, level: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: courses.map(mapCourse) });
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
        _count: { select: { lessons: true, enrollments: true } },
        academy: { select: { id: true, name: true } },
        lecturer: { select: { id: true, level: true, bio: true } },
      },
    });

    if (!course) {
      res.status(404).json({ ok: false, error: 'Course not found' });
      return;
    }

    res.json({ ok: true, data: mapCourseDetail(course) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch course' });
  }
});

schoolRouter.post('/enrollments', authenticate, async (req: AuthRequest, res) => {
  try {
    const courseId = req.body.courseId || req.body.course_id;
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
      data: { id: uid(), userId, courseId },
      include: { course: true },
    });
    res.status(201).json({ ok: true, data: enrollment });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create enrollment' });
  }
});

schoolRouter.get('/enrollments', authenticate, async (req: AuthRequest, res) => {
  try {
    const enrollments = await prisma.schoolEnrollment.findMany({
      where: { userId: req.user!.id },
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
    const enrollment = await prisma.schoolEnrollment.findUnique({ where: { id } });
    if (!enrollment) {
      res.status(404).json({ ok: false, error: 'Enrollment not found' });
      return;
    }
    if (enrollment.userId !== req.user!.id) {
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
        ...(completed === true && !enrollment.certificateUrl
          ? { certificateUrl: `academy-cert://${id}` }
          : {}),
      },
      include: { course: true },
    });
    res.json({ ok: true, data: updated });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update enrollment' });
  }
});

schoolRouter.get('/clinical-cases', async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category) : '';
    const data = category
      ? CLINICAL_CASES.filter((c) => c.category === category)
      : CLINICAL_CASES;
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to fetch cases' });
  }
});

schoolRouter.get('/library', async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category) : '';
    const search = req.query.search ? String(req.query.search).toLowerCase() : '';
    let data = [...LIBRARY_ITEMS];
    if (category) data = data.filter((i) => i.category === category);
    if (search) {
      data = data.filter(
        (i) => i.title.toLowerCase().includes(search) || i.author.toLowerCase().includes(search),
      );
    }
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to fetch library' });
  }
});

schoolRouter.get('/live', async (_req, res) => {
  res.json({ ok: true, data: upcomingLiveSessions() });
});

schoolRouter.get('/certificates', authenticate, async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.schoolEnrollment.findMany({
      where: {
        userId: req.user!.id,
        OR: [{ completed: true }, { certificateUrl: { not: null } }],
      },
      include: { course: { select: { id: true, title: true, category: true, author: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({
      ok: true,
      data: rows.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        title: e.course.title,
        category: e.course.category,
        instructor: e.course.author,
        issuedAt: e.updatedAt,
        certificateUrl: e.certificateUrl || `academy-cert://${e.id}`,
        certificateNumber: `AOS-${e.id.slice(0, 8).toUpperCase()}`,
        status: 'issued',
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to fetch certificates' });
  }
});

async function resolveExamLesson(lessonId: string) {
  if (lessonId.startsWith('exam-')) {
    const courseId = lessonId.slice('exam-'.length);
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return null;
    return { id: lessonId, courseId: course.id, virtual: true as const };
  }
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return null;
  return { id: lesson.id, courseId: lesson.courseId, virtual: false as const };
}

schoolRouter.get('/lessons/:lessonId/exam', authenticate, async (req, res) => {
  try {
    const lesson = await resolveExamLesson(req.params.lessonId as string);
    if (!lesson) {
      res.status(404).json({ ok: false, error: 'Урок не найден' });
      return;
    }
    res.json({
      ok: true,
      data: {
        lessonId: lesson.id,
        courseId: lesson.courseId,
        ...DEFAULT_EXAM,
        passingScore: DEFAULT_EXAM.passScore,
        questionCount: DEFAULT_EXAM.questions.length,
        questions: DEFAULT_EXAM.questions.map(({ correctIndex, ...q }) => q),
      },
    });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to load exam' });
  }
});

schoolRouter.post('/lessons/:lessonId/exam/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const lesson = await resolveExamLesson(req.params.lessonId as string);
    if (!lesson) {
      res.status(404).json({ ok: false, error: 'Урок не найден' });
      return;
    }

    const answers = (req.body?.answers || {}) as Record<string, number>;
    let correct = 0;
    for (const q of DEFAULT_EXAM.questions) {
      if (Number(answers[q.id]) === q.correctIndex) correct += 1;
    }
    const score = Math.round((correct / DEFAULT_EXAM.questions.length) * 100);
    const passed = score >= DEFAULT_EXAM.passScore;

    let certificate = null;
    if (passed) {
      const enrollment = await prisma.schoolEnrollment.findUnique({
        where: {
          userId_courseId: { userId: req.user!.id, courseId: lesson.courseId },
        },
      });
      if (enrollment) {
        const updated = await prisma.schoolEnrollment.update({
          where: { id: enrollment.id },
          data: {
            progress: Math.max(enrollment.progress, 100),
            completed: true,
            certificateUrl: enrollment.certificateUrl || `academy-cert://${enrollment.id}`,
          },
          include: { course: true },
        });
        certificate = {
          id: updated.id,
          courseTitle: updated.course.title,
          certificateUrl: updated.certificateUrl,
          certificateNumber: `AOS-${updated.id.slice(0, 8).toUpperCase()}`,
          score,
        };
      }
    }

    res.json({
      ok: true,
      data: {
        score,
        passed,
        correct,
        total: DEFAULT_EXAM.questions.length,
        passingScore: DEFAULT_EXAM.passScore,
        certificate,
        message: passed
          ? 'Экзамен сдан. Сертификат добавлен в портфолио Academy OS.'
          : `Нужно ${DEFAULT_EXAM.passScore}% для сдачи. Ваш результат: ${score}%.`,
      },
    });
  } catch (error) {
    console.error('Exam submit error:', error);
    res.status(500).json({ ok: false, error: 'Failed to submit exam' });
  }
});

schoolRouter.post('/tutor', authenticate, async (req: AuthRequest, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ ok: false, error: 'message обязателен' });
      return;
    }

    const lower = message.toLowerCase();
    let reply =
      'Я AI Tutor Academy OS. Задайте вопрос по уроку, протоколу или разбору ошибки в тесте.';
    if (lower.includes('эндо') || lower.includes('канал')) {
      reply = 'Для эндодонтии под микроскопом: изоляция → рабочая длина → ирригация → обтурация. Хотите чек-лист ревизии?';
    } else if (lower.includes('имплант')) {
      reply = 'В эстетической зоне оцените биотип, объём кости и мягких тканей до установки. Могу разобрать ваш кейс по шагам.';
    } else if (lower.includes('экзамен') || lower.includes('тест')) {
      reply = 'Перед экзаменом повторите ключевые протоколы модуля. Проходной балл — 70%. После сдачи сертификат попадёт в портфолио.';
    } else if (lower.includes('домашн') || lower.includes('homework')) {
      reply = 'Загрузите описание кейса и фото — я проверю полноту протокола, диагноз и фотопротокол.';
    }

    res.json({
      ok: true,
      data: {
        reply,
        suggestions: ['Разобрать ошибку в тесте', 'Составить learning path', 'Проверить домашнее задание'],
      },
    });
  } catch {
    res.status(500).json({ ok: false, error: 'Tutor unavailable' });
  }
});

schoolRouter.post('/homework/review', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = reviewHomework({
      title: req.body?.title,
      notes: req.body?.notes,
      category: req.body?.category,
      imageCount: Number(req.body?.imageCount || 0),
    });
    res.json({ ok: true, data: result });
  } catch {
    res.status(500).json({ ok: false, error: 'Не удалось проверить работу' });
  }
});

export { schoolRouter };
