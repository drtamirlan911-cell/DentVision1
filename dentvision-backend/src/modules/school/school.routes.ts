import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePermission, requireSuperadmin } from '../../middleware/rbac.js';
import { AuthRequest } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import {
  CLINICAL_CASES,
  DEFAULT_EXAM,
  getTutorReply,
  LIBRARY_ITEMS,
  reviewHomeworkWithAI,
} from './academyContent.js';
import {
  mapCourseToEventCard,
  normalizeSchoolFormat,
} from './schoolFormats.js';
import {
  audiencesFromCourseMeta,
  canExposeCatalogItem,
  resolveActiveContentContext,
} from '../../iam/contentCatalogAccess.js';

const schoolRouter = Router();

async function activeAcademyScope(req: AuthRequest): Promise<{ academyId: string; lecturerId?: string } | null> {
  const user = req.user;
  const organizationType = String(user?.organizationType || '').toUpperCase();
  const academyId = String(user?.organizationOriginalId || '').trim();
  if (organizationType !== 'ACADEMY' || !academyId) return null;

  const lecturer = await prisma.lecturer.findUnique({
    where: { userId: user!.id },
    select: { id: true, academyId: true },
  });
  if (lecturer?.academyId && lecturer.academyId !== academyId) return null;
  return {
    academyId,
    ...(lecturer?.id ? { lecturerId: lecturer.id } : {}),
  };
}

const PUBLIC_COURSE_META_KEYS = [
  'subtitle',
  'instructorTitle',
  'difficulty',
  'durationHours',
  'lessonCount',
  'rating',
  'tags',
  'certificateEnabled',
  'audiences',
] as const;

function catalogMeta(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const source = meta as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of PUBLIC_COURSE_META_KEYS) {
    if (source[key] !== undefined) safe[key] = source[key];
  }
  return Object.keys(safe).length ? safe : null;
}

function mapCourse(course: any, options: { includePrivateFile?: boolean } = {}) {
  const lessonCount = course._count?.lessons ?? course.lessons?.length ?? 0;
  const durationHours = course.duration
    ? Number(String(course.duration).replace(/[^\d.]/g, '')) || lessonCount
    : lessonCount;
  const format = normalizeSchoolFormat(course.format);
  const price = Number(course.price || 0);
  const safeMeta = catalogMeta(course.meta);
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
    duration: course.duration,
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
    format,
    startsAt: course.startsAt || null,
    seats: course.seats ?? null,
    // A paid course may carry a downloadable asset. It is a private field and
    // is returned only after the detail route has established enrollment.
    fileUrl: options.includePrivateFile || price <= 0 ? course.fileUrl || null : null,
    meta: safeMeta,
    // Preserve the catalog's existing flat rich fields without leaking lesson
    // modules or arbitrary future private keys stored in Course.meta.
    ...(safeMeta || {}),
    created_at: course.createdAt,
  };
}

function visibleAcademyCourses<T extends { meta?: unknown }>(courses: T[], req: AuthRequest): T[] {
  const context = resolveActiveContentContext(req);
  return courses.filter((course) =>
    canExposeCatalogItem('ACADEMY', context, audiencesFromCourseMeta(course.meta)),
  );
}

function lessonsFromModules(modules: any): Array<{ title: string; videoUrl: string | null; content: string | null; duration: number; order: number }> {
  const out: Array<{ title: string; videoUrl: string | null; content: string | null; duration: number; order: number }> = [];
  let order = 0;
  for (const m of Array.isArray(modules) ? modules : []) {
    for (const l of Array.isArray(m.lessons) ? m.lessons : []) {
      out.push({
        title: l.title || m.title || 'Урок',
        videoUrl: l.type === 'video' && l.contentUrl ? String(l.contentUrl) : null,
        content: l.contentUrl || null,
        duration: Number(l.duration) || 0,
        order: order++,
      });
    }
  }
  return out;
}

async function loadDbOfferings(format: 'webinar' | 'textbook' | 'office' | 'course') {
  return prisma.course.findMany({
    where: { format },
    include: {
      _count: { select: { enrollments: true, lessons: true } },
      academy: { select: { id: true, name: true, city: true } },
      lecturer: { select: { id: true, level: true, bio: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
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
    ...mapCourse(course, { includePrivateFile: true }),
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

    const contentContext = resolveActiveContentContext(req);
    const isVisible = (course: { meta?: unknown }) =>
      canExposeCatalogItem('ACADEMY', contentContext, audiencesFromCourseMeta(course.meta));

    const [dbWebinars, dbTextbooks, dbOffice] = await Promise.all([
      loadDbOfferings('webinar'),
      loadDbOfferings('textbook'),
      loadDbOfferings('office'),
    ]);
    const webinars = dbWebinars.filter(isVisible).map(mapCourseToEventCard);
    const officeCourses = dbOffice.filter(isVisible).map(mapCourseToEventCard);
    const textbooks = dbTextbooks.filter(isVisible).map(mapCourseToEventCard);
    const trackCourses = courses.filter((course) =>
      normalizeSchoolFormat((course as any).format) === 'course' && isVisible(course),
    );

    res.json({
      ok: true,
      data: {
        positioning: {
          primary: ['webinar', 'office', 'textbook', 'course'],
          headline: 'Academy OS — курсы, вебинары и учебники от лекторов',
          secondary: ['online_track', 'cases', 'certification', 'portfolio'],
        },
        kpis: {
          webinars: webinars.length,
          officeCourses: officeCourses.length,
          textbooks: textbooks.length,
          courses: trackCourses.length,
          academies: academies.length,
          lecturers: lecturers.length,
          cases: CLINICAL_CASES.length,
          live: webinars.length,
          certificates: enrollments.length,
        },
        webinars,
        officeCourses,
        textbooks,
        courses: trackCourses.map((course) => mapCourse(course)),
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
        live: webinars,
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

schoolRouter.get('/courses', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { category, search, format } = req.query;
    const where: Record<string, unknown> = {
      format: format ? normalizeSchoolFormat(format) : 'course',
    };

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

    const visibleCourses = visibleAcademyCourses(courses, req);
    res.json({ ok: true, data: visibleCourses.map((course) => mapCourse(course)) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch courses' });
  }
});

schoolRouter.get('/courses/:id', optionalAuth, async (req, res) => {
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

    const contentContext = resolveActiveContentContext(req);
    if (!canExposeCatalogItem('ACADEMY', contentContext, audiencesFromCourseMeta(course.meta))) {
      res.status(404).json({ ok: false, error: 'Course not found' });
      return;
    }

    // Public course discovery must work before purchase. Anonymous and
    // unenrolled visitors receive only the sanitized catalogue projection:
    // program metadata and price, never lessons, private files or exam content.
    // A verified active entitlement unlocks the full learning player.
    const userId = (req as AuthRequest).user?.id;
    if (Number(course.price || 0) > 0) {
      if (!userId) {
        return res.json({ ok: true, data: mapCourse(course) });
      }
      const enrollment = await prisma.schoolEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
        select: { id: true, accessStatus: true, accessExpiresAt: true },
      });
      const hasActiveEntitlement = Boolean(
        enrollment
        && enrollment.accessStatus === 'active'
        && (!enrollment.accessExpiresAt || enrollment.accessExpiresAt > new Date()),
      );
      if (!hasActiveEntitlement) {
        return res.json({ ok: true, data: mapCourse(course) });
      }
    }

    return res.json({ ok: true, data: mapCourseDetail(course) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch course' });
  }
});

schoolRouter.post('/courses', authenticate, requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const academyScope = await activeAcademyScope(req);
    if (!academyScope) return res.status(403).json({ ok: false, error: 'Активный контекст Academy не найден' });
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ ok: false, error: 'Название курса обязательно' });
    }
    const course = await prisma.course.create({
      data: {
        id: uid(),
        title: String(b.title).trim(),
        description: b.description || null,
        author: b.instructor || null,
        imageUrl: b.imageUrl || null,
        price: b.price != null ? Number(b.price) : 0,
        category: b.category || null,
        duration: b.durationHours ? `${Number(b.durationHours) || 0} ч` : null,
        format: 'course',
        lecturerId: academyScope.lecturerId || null,
        academyId: academyScope.academyId,
        meta: {
          subtitle: b.subtitle || null,
          instructorTitle: b.instructorTitle || null,
          difficulty: b.difficulty || 'beginner',
          durationHours: b.durationHours || null,
          lessonCount: b.lessonCount || null,
          rating: b.rating || null,
          tags: Array.isArray(b.tags) ? b.tags : [],
          certificateEnabled: b.certificateEnabled !== false,
          modules: Array.isArray(b.modules) ? b.modules : [],
        },
        lessons: { create: lessonsFromModules(b.modules) },
      },
    });
    res.status(201).json({ ok: true, data: course });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to create course' }); }
});

schoolRouter.put('/courses/:id', authenticate, requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const academyScope = await activeAcademyScope(req);
    if (!academyScope) return res.status(403).json({ ok: false, error: 'Активный контекст Academy не найден' });
    const id = req.params.id as string;
    const b = req.body || {};
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Курс не найден' });
    if (existing.academyId !== academyScope.academyId) return res.status(403).json({ ok: false, error: 'Курс принадлежит другой Academy организации' });
    await prisma.lesson.deleteMany({ where: { courseId: id } });
    const course = await prisma.course.update({
      where: { id },
      data: {
        title: b.title != null ? String(b.title).trim() : undefined,
        description: b.description ?? null,
        author: b.instructor ?? null,
        imageUrl: b.imageUrl ?? null,
        price: b.price != null ? Number(b.price) : undefined,
        category: b.category ?? null,
        duration: b.durationHours ? `${Number(b.durationHours) || 0} ч` : null,
        meta: {
          subtitle: b.subtitle || null,
          instructorTitle: b.instructorTitle || null,
          difficulty: b.difficulty || 'beginner',
          durationHours: b.durationHours || null,
          lessonCount: b.lessonCount || null,
          rating: b.rating || null,
          tags: Array.isArray(b.tags) ? b.tags : [],
          certificateEnabled: b.certificateEnabled !== false,
          modules: Array.isArray(b.modules) ? b.modules : [],
        },
        lessons: { create: lessonsFromModules(b.modules) },
      },
    });
    res.json({ ok: true, data: course });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to update course' }); }
});

schoolRouter.delete('/courses/:id', authenticate, requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const academyScope = await activeAcademyScope(req);
    if (!academyScope) return res.status(403).json({ ok: false, error: 'Активный контекст Academy не найден' });
    const id = req.params.id as string;
    const existing = await prisma.course.findUnique({ where: { id }, select: { academyId: true } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Курс не найден' });
    if (existing.academyId !== academyScope.academyId) return res.status(403).json({ ok: false, error: 'Курс принадлежит другой Academy организации' });
    await prisma.course.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to delete course' }); }
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

    const price = Number(course.price || 0);
    if (price > 0) {
      const { providers, withPaymentQr } = await import('../payments/kaspi.provider.js');
      const { tengeToMinor, serializeBigInt } = await import('../../lib/money.js');
      const amountMinor = tengeToMinor(price);
      const gateway = providers.kaspi_qr;
      const created = await gateway.createPayment({ amountMinor, refId: courseId });
      const payment = await prisma.payment.create({
        data: {
          provider: 'kaspi_qr',
          externalId: created.externalId,
          amount: amountMinor,
          status: 'pending',
          refType: 'enrollment',
          refId: courseId,
          domain: 'school',
          sellerType: course.lecturerId ? 'LECTURER' : course.academyId ? 'ACADEMY' : null,
          sellerId: course.lecturerId || course.academyId || null,
          meta: {
            qr: created.qr,
            userId,
            courseId,
            courseTitle: course.title,
          },
        },
      });
      await writeAuditLog({ action: 'ACADEMY_ENROLLMENT_PAYMENT_STARTED', entity: 'payment', entityId: payment.id, details: { workflow: 'learning', queueKey: 'courses', courseId, courseTitle: course.title, amount: price, provider: 'kaspi_qr' }, userId });
      res.status(201).json({
        ok: true,
        data: {
          requiresPayment: true,
          enrolled: false,
          payment: withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, created.qr),
          course: { id: course.id, title: course.title, price },
        },
      });
      return;
    }

    const enrollment = await prisma.schoolEnrollment.create({
      data: { id: uid(), userId, courseId, acquisitionType: 'free', accessStatus: 'active' },
      include: { course: true },
    });
    await writeAuditLog({
      action: 'ACADEMY_ENROLLMENT_CREATED',
      entity: 'school_enrollment',
      entityId: enrollment.id,
      details: { workflow: 'learning', queueKey: 'courses', courseId, courseTitle: course.title, price },
      userId,
    });
    res.status(201).json({
      ok: true,
      data: { ...enrollment, requiresPayment: false, enrolled: true },
    });
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
    // Prisma BigInt cannot be serialized by JSON.stringify. Return the minor-unit
    // amount as a decimal string so the candidate can see the confirmed purchase.
    const data = enrollments.map((enrollment) => ({
      ...enrollment,
      paidAmountMinor: enrollment.paidAmountMinor == null ? null : enrollment.paidAmountMinor.toString(),
    }));
    return res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch enrollments' });
  }
});

schoolRouter.patch('/enrollments/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const enrollment = await prisma.schoolEnrollment.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!enrollment) {
      return res.status(404).json({ ok: false, error: 'Enrollment not found' });
    }
    if (enrollment.accessStatus !== 'active' || (enrollment.accessExpiresAt && enrollment.accessExpiresAt <= new Date())) {
      return res.status(403).json({ ok: false, error: 'Доступ к курсу не активен', code: 'LEARNING_ENTITLEMENT_INACTIVE' });
    }

    const requested = req.body?.completedLessons;
    if (!Array.isArray(requested) || requested.some((item: unknown) => typeof item !== 'string' || !item.trim())) {
      return res.status(400).json({ ok: false, error: 'completedLessons должен содержать список идентификаторов уроков' });
    }
    const lessons = await prisma.lesson.findMany({
      where: { courseId: enrollment.courseId },
      select: { id: true },
    });
    const validLessonIds = new Set(lessons.map((lesson) => lesson.id));
    const uniqueRequested = Array.from(new Set(requested as string[]));
    if (uniqueRequested.some((lessonId) => !validLessonIds.has(lessonId))) {
      return res.status(400).json({ ok: false, error: 'Список содержит урок другого курса или неизвестный урок', code: 'INVALID_COURSE_LESSON' });
    }

    const previous = Array.isArray(enrollment.completedLessons)
      ? (enrollment.completedLessons as unknown[]).filter((value): value is string => typeof value === 'string')
      : [];
    const completedSet = new Set([...previous, ...uniqueRequested].filter((lessonId) => validLessonIds.has(lessonId)));
    const completedLessons = Array.from(completedSet);
    const progress = lessons.length > 0 ? Math.min(99, Math.round((completedLessons.length / lessons.length) * 100)) : 0;

    const updated = await prisma.schoolEnrollment.update({
      where: { id },
      data: {
        progress: enrollment.completed ? 100 : progress,
        completedLessons,
        // Completion and certificate issuance are exam/issuer-controlled.
        // Client-supplied progress and completed fields are intentionally ignored.
      },
      include: { course: true },
    });
    await writeAuditLog({
      action: 'ACADEMY_PROGRESS_UPDATED',
      entity: 'school_enrollment',
      entityId: updated.id,
      details: {
        workflow: 'learning', queueKey: 'courses', courseId: updated.courseId,
        progress: updated.progress, completed: updated.completed,
        completedLessonCount: completedLessons.length, lessonCount: lessons.length,
      },
      userId: req.user!.id,
    });
    return res.json({ ok: true, data: updated });
  } catch (error) {
    console.error('Update learning progress error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to update enrollment' });
  }
});

schoolRouter.get('/clinical-cases', optionalAuth, async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category) : '';
    let rows: any[] = [];
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, title, description, category, difficulty, image_url AS "imageUrl", content, author FROM "school_clinical_cases" ORDER BY created_at ASC`,
      );
    } catch { /* table missing — fall through to static */ }
    let data = rows.length > 0
      ? rows.map((r: any) => ({ ...r, imageUrl: r.imageUrl || null, author: r.author || null }))
      : [...CLINICAL_CASES];
    if (category) data = data.filter((c: any) => c.category === category);
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to fetch cases' });
  }
});

schoolRouter.post('/clinical-cases', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ ok: false, error: 'Название кейса обязательно' });
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "school_clinical_cases" (id, title, description, category, difficulty, image_url, content, author) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      uid(), String(b.title).trim(), b.description || null, b.category || null, b.difficulty || 'intermediate', b.imageUrl || null, null, b.author || null,
    );
    res.status(201).json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to create case' }); }
});

schoolRouter.put('/clinical-cases/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await prisma.$executeRawUnsafe(
      `UPDATE "school_clinical_cases" SET title = $2, description = $3, category = $4, difficulty = $5, image_url = $6, author = $7 WHERE id = $1`,
      req.params.id as string, String(b.title || '').trim() || 'Кейс', b.description || null, b.category || null, b.difficulty || 'intermediate', b.imageUrl || null, b.author || null,
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to update case' }); }
});

schoolRouter.get('/library', optionalAuth, async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category) : '';
    const search = req.query.search ? String(req.query.search).toLowerCase() : '';
    let rows: any[] = [];
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, title, description, author, category, type, url, content, tags FROM "school_library_items" ORDER BY created_at ASC`,
      );
    } catch { /* table missing — fall through to static */ }
    let data = rows.length > 0 ? rows : [...LIBRARY_ITEMS];
    if (category) data = data.filter((i: any) => i.category === category);
    if (search) {
      data = data.filter(
        (i: any) => String(i.title).toLowerCase().includes(search) || String(i.author || '').toLowerCase().includes(search),
      );
    }
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to fetch library' });
  }
});

async function visibleOfferingCards(format: 'webinar' | 'textbook' | 'office', req: AuthRequest) {
  const db = await loadDbOfferings(format);
  const context = resolveActiveContentContext(req);
  return db
    .filter((course) => canExposeCatalogItem('ACADEMY', context, audiencesFromCourseMeta(course.meta)))
    .map(mapCourseToEventCard);
}

schoolRouter.get('/live', optionalAuth, async (req: AuthRequest, res) => {
  res.json({ ok: true, data: await visibleOfferingCards('webinar', req) });
});

schoolRouter.get('/webinars', optionalAuth, async (req: AuthRequest, res) => {
  res.json({ ok: true, data: await visibleOfferingCards('webinar', req) });
});

schoolRouter.get('/office-courses', optionalAuth, async (req: AuthRequest, res) => {
  res.json({ ok: true, data: await visibleOfferingCards('office', req) });
});

schoolRouter.get('/textbooks', optionalAuth, async (req: AuthRequest, res) => {
  res.json({ ok: true, data: await visibleOfferingCards('textbook', req) });
});

/** Paid registration for webinars, office seats, textbooks (soft catalog + lecturer DB). */
schoolRouter.post('/commerce/register', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId, format: formatRaw } = req.body || {};
    if (!productId || !formatRaw) {
      res.status(400).json({ ok: false, error: 'productId и format обязательны' });
      return;
    }
    const format = normalizeSchoolFormat(formatRaw);

    // Every sellable product — platform-curated or lecturer-owned — is a real
    // `Course` row (see the `seed_academy_platform_catalog` migration).
    const dbProduct = await prisma.course.findUnique({
      where: { id: String(productId) },
      include: { _count: { select: { enrollments: true } } },
    });

    let product: any = null;
    let sellerType: 'LECTURER' | 'PLATFORM' = 'PLATFORM';
    let sellerId = 'system';

    if (dbProduct && normalizeSchoolFormat(dbProduct.format) === format) {
      product = mapCourseToEventCard(dbProduct);
      if (dbProduct.lecturerId) {
        sellerType = 'LECTURER';
        sellerId = dbProduct.lecturerId;
      }
    }

    if (!product) {
      res.status(404).json({ ok: false, error: 'Продукт не найден' });
      return;
    }

    const contentContext = resolveActiveContentContext(req);
    if (!canExposeCatalogItem('ACADEMY', contentContext, audiencesFromCourseMeta(dbProduct?.meta))) {
      res.status(404).json({ ok: false, error: 'Продукт недоступен в текущем контексте' });
      return;
    }

    const seats = (product as any).seats;
    const enrolled = (product as any).enrolled || 0;
    if (seats != null && seats > 0) {
      const seatsLeft = Math.max(0, seats - enrolled);
      if (seatsLeft <= 0) {
        res.status(409).json({ ok: false, error: 'Мест больше нет' });
        return;
      }
    }

    const price = Number(product.price || 0);
    if (price <= 0) {
      // Free: for DB products create enrollment; soft catalog just confirms.
      if (dbProduct) {
        await prisma.schoolEnrollment.upsert({
          where: { userId_courseId: { userId: req.user!.id, courseId: dbProduct.id } },
          create: { id: uid(), userId: req.user!.id, courseId: dbProduct.id, acquisitionType: 'free', accessStatus: 'active' },
          update: {},
        });
      }
      res.status(201).json({
        ok: true,
        data: {
          registrationId: `reg-${productId}-${req.user!.id.slice(0, 8)}`,
          productId: product.id,
          format: product.format,
          title: product.title,
          price: 0,
          currency: (product as any).currency || 'KZT',
          seatsLeft: (product as any).seatsLeft,
          status: 'confirmed',
          requiresPayment: false,
          message: format === 'textbook' ? 'Учебник открыт.' : 'Место подтверждено бесплатно.',
        },
      });
      return;
    }

    const { providers, withPaymentQr } = await import('../payments/kaspi.provider.js');
    const { tengeToMinor, serializeBigInt } = await import('../../lib/money.js');
    const amountMinor = tengeToMinor(price);
    const gateway = providers.kaspi_qr;
    const created = await gateway.createPayment({ amountMinor, refId: productId });
    const payment = await prisma.payment.create({
      data: {
        provider: 'kaspi_qr',
        externalId: created.externalId,
        amount: amountMinor,
        status: 'pending',
        refType: dbProduct ? 'enrollment' : 'academy_event',
        refId: dbProduct ? dbProduct.id : productId,
        domain: 'school',
        sellerType,
        sellerId,
        meta: {
          qr: created.qr,
          userId: req.user!.id,
          productId: product.id,
          format: product.format,
          title: product.title,
          courseId: dbProduct?.id,
        },
      },
    });

    res.status(201).json({
      ok: true,
      data: {
        registrationId: `reg-${productId}-${req.user!.id.slice(0, 8)}`,
        productId: product.id,
        format: product.format,
        title: product.title,
        price,
        currency: (product as any).currency || 'KZT',
        seatsLeft: (product as any).seatsLeft,
        status: 'awaiting_payment',
        requiresPayment: true,
        payment: withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, created.qr),
        message: 'Оплатите по QR, чтобы подтвердить место.',
      },
    });
  } catch (error) {
    console.error('[school commerce/register]', error);
    res.status(500).json({ ok: false, error: 'Не удалось зарегистрировать' });
  }
});

schoolRouter.get('/certificates/verify/:verificationCode', async (req, res) => {
  try {
    const certificate = await prisma.schoolCertificate.findUnique({
      where: { verificationCode: String(req.params.verificationCode) },
      include: { course: { select: { title: true, category: true } } },
    });
    if (!certificate || certificate.status !== 'issued' || certificate.revokedAt) {
      return res.status(404).json({ ok: false, error: 'Сертификат не найден или недействителен' });
    }
    return res.json({
      ok: true,
      data: {
        certificateNumber: certificate.certificateNumber,
        status: certificate.status,
        issuedAt: certificate.issuedAt,
        issuer: certificate.issuerNameSnapshot,
        courseTitle: certificate.course.title,
        category: certificate.course.category,
      },
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось проверить сертификат' });
  }
});

schoolRouter.get('/certificates', authenticate, async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.schoolCertificate.findMany({
      where: { userId: req.user!.id, status: 'issued', revokedAt: null },
      include: { course: { select: { id: true, title: true, category: true, author: true } } },
      orderBy: { issuedAt: 'desc' },
    });
    return res.json({
      ok: true,
      data: rows.map((certificate) => ({
        id: certificate.id,
        courseId: certificate.courseId,
        title: certificate.course.title,
        category: certificate.course.category,
        instructor: certificate.course.author,
        issuedAt: certificate.issuedAt,
        certificateUrl: `/school/certificates/verify/${certificate.verificationCode}`,
        certificateNumber: certificate.certificateNumber,
        verificationCode: certificate.verificationCode,
        status: certificate.status,
      })),
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'Failed to fetch certificates' });
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

schoolRouter.get('/lessons/:lessonId/exam', authenticate, async (req: AuthRequest, res) => {
  try {
    const lesson = await resolveExamLesson(req.params.lessonId as string);
    if (!lesson) return res.status(404).json({ ok: false, error: 'Урок не найден' });
    const enrollment = await prisma.schoolEnrollment.findFirst({
      where: { userId: req.user!.id, courseId: lesson.courseId },
      select: { id: true, accessStatus: true, accessExpiresAt: true },
    });
    if (!enrollment || enrollment.accessStatus !== 'active' || (enrollment.accessExpiresAt && enrollment.accessExpiresAt <= new Date())) {
      return res.status(403).json({ ok: false, error: 'Требуется активный доступ к курсу', code: 'LEARNING_ENTITLEMENT_INACTIVE' });
    }
    return res.json({
      ok: true,
      data: {
        lessonId: lesson.id,
        courseId: lesson.courseId,
        title: DEFAULT_EXAM.title,
        description: DEFAULT_EXAM.description,
        passScore: DEFAULT_EXAM.passScore,
        passingScore: DEFAULT_EXAM.passScore,
        questionCount: DEFAULT_EXAM.questions.length,
        questions: DEFAULT_EXAM.questions.map(({ correctIndex, ...question }) => question),
      },
    });
  } catch (error) {
    console.error('Load course exam error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to load exam' });
  }
});

schoolRouter.post('/lessons/:lessonId/exam/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const lesson = await resolveExamLesson(req.params.lessonId as string);
    if (!lesson) return res.status(404).json({ ok: false, error: 'Урок не найден' });
    const enrollment = await prisma.schoolEnrollment.findFirst({
      where: { userId: req.user!.id, courseId: lesson.courseId },
    });
    if (!enrollment || enrollment.accessStatus !== 'active' || (enrollment.accessExpiresAt && enrollment.accessExpiresAt <= new Date())) {
      return res.status(403).json({ ok: false, error: 'Требуется активный доступ к курсу', code: 'LEARNING_ENTITLEMENT_INACTIVE' });
    }

    const suppliedAnswers = req.body?.answers;
    if (!suppliedAnswers || typeof suppliedAnswers !== 'object' || Array.isArray(suppliedAnswers)) {
      return res.status(400).json({ ok: false, error: 'answers должен быть объектом ответов' });
    }
    const normalizedAnswers: Record<string, number | null> = {};
    let correct = 0;
    for (const question of DEFAULT_EXAM.questions) {
      const raw = suppliedAnswers[question.id];
      const selected = Number.isInteger(Number(raw)) ? Number(raw) : -1;
      normalizedAnswers[question.id] = selected >= 0 && selected < question.options.length ? selected : null;
      if (selected === question.correctIndex) correct += 1;
    }
    const score = Math.round((correct / DEFAULT_EXAM.questions.length) * 100);
    const passed = score >= DEFAULT_EXAM.passScore;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${enrollment.id}), 20261120)`;
      const previousAttempts = await tx.schoolAssessmentAttempt.count({ where: { enrollmentId: enrollment.id } });
      const attempt = await tx.schoolAssessmentAttempt.create({
        data: {
          id: uid(),
          userId: req.user!.id,
          enrollmentId: enrollment.id,
          courseId: lesson.courseId,
          lessonId: lesson.virtual ? null : lesson.id,
          attemptNumber: previousAttempts + 1,
          score,
          correct,
          total: DEFAULT_EXAM.questions.length,
          passed,
          answers: normalizedAnswers,
        },
      });

      const course = await tx.course.findUnique({
        where: { id: lesson.courseId },
        include: { academy: { select: { name: true } } },
      });
      if (!course) throw new Error('Course was removed before the assessment was persisted');

      let issuedCertificate: {
        id: string; certificateNumber: string; verificationCode: string;
        status: string; issuedAt: Date; issuerNameSnapshot: string;
      } | null = null;

      if (passed) {
        const certificateEnabled = !(course.meta && typeof course.meta === 'object' && !Array.isArray(course.meta) && (course.meta as Record<string, unknown>).certificateEnabled === false);
        await tx.schoolEnrollment.update({
          where: { id: enrollment.id },
          data: { progress: 100, completed: true },
        });

        if (certificateEnabled) {
          issuedCertificate = await tx.schoolCertificate.findUnique({ where: { enrollmentId: enrollment.id } });
          if (!issuedCertificate) {
            const verificationCode = uid();
            const certificateNumber = `DV-${new Date().getFullYear()}-${uid().slice(0, 8).toUpperCase()}`;
            issuedCertificate = await tx.schoolCertificate.create({
              data: {
                id: uid(),
                enrollmentId: enrollment.id,
                userId: req.user!.id,
                courseId: lesson.courseId,
                certificateNumber,
                verificationCode,
                issuerNameSnapshot: course.academy?.name || course.author || 'DentVision Academy',
                status: 'issued',
                metadata: {
                  assessmentAttemptId: attempt.id,
                  score,
                  passingScore: DEFAULT_EXAM.passScore,
                },
              },
              select: {
                id: true, certificateNumber: true, verificationCode: true,
                status: true, issuedAt: true, issuerNameSnapshot: true,
              },
            });
          }
          await tx.schoolEnrollment.update({
            where: { id: enrollment.id },
            data: { certificateUrl: `/school/certificates/verify/${issuedCertificate.verificationCode}` },
          });
        }
      }

      return { attempt, certificate: issuedCertificate, certificateEnabled: Boolean(issuedCertificate) };
    });

    const certificate = result.certificate ? {
      id: result.certificate.id,
      certificateNumber: result.certificate.certificateNumber,
      verificationCode: result.certificate.verificationCode,
      certificateUrl: `/school/certificates/verify/${result.certificate.verificationCode}`,
      issuer: result.certificate.issuerNameSnapshot,
      issuedAt: result.certificate.issuedAt,
      status: result.certificate.status,
    } : null;

    return res.json({
      ok: true,
      data: {
        score,
        passed,
        correct,
        total: DEFAULT_EXAM.questions.length,
        passingScore: DEFAULT_EXAM.passScore,
        attemptNumber: result.attempt.attemptNumber,
        certificate,
        message: passed
          ? certificate ? 'Экзамен сдан. Сертификат выдан и доступен для проверки.' : 'Экзамен сдан. Курс завершён; сертификат для этой программы не предусмотрен.'
          : `Нужно ${DEFAULT_EXAM.passScore}% для сдачи. Ваш результат: ${score}%.`,
      },
    });
  } catch (error) {
    console.error('Exam submit error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to submit exam' });
  }
});

schoolRouter.post('/tutor', authenticate, async (req: AuthRequest, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ ok: false, error: 'message обязателен' });
      return;
    }

    const { reply, suggestions } = await getTutorReply(message);
    res.json({ ok: true, data: { reply, suggestions } });
  } catch {
    res.status(500).json({ ok: false, error: 'Tutor unavailable' });
  }
});

schoolRouter.post('/homework/review', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await reviewHomeworkWithAI({
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

// ─── Clinical Cases CRUD ───
schoolRouter.delete('/clinical-cases/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "school_clinical_cases" WHERE id = $1`, req.params.id as string);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to delete clinical case' }); }
});

// ─── Library Items CRUD ───
schoolRouter.post('/library', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ ok: false, error: 'Название обязательно' });
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "school_library_items" (id, title, description, author, category, type, url, content, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      uid(), String(b.title).trim(), b.content || null, b.author || null, b.category || null, b.type || 'article', b.fileUrl || null, b.content || null, Array.isArray(b.tags) ? JSON.stringify(b.tags) : null,
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to create library item' }); }
});

schoolRouter.put('/library/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await prisma.$executeRawUnsafe(
      `UPDATE "school_library_items" SET title = $2, description = $3, author = $4, category = $5, type = $6, url = $7, content = $8, tags = $9 WHERE id = $1`,
      req.params.id as string, String(b.title || '').trim() || 'Материал', b.content || null, b.author || null, b.category || null, b.type || 'article', b.fileUrl || null, b.content || null, Array.isArray(b.tags) ? JSON.stringify(b.tags) : null,
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to update library item' }); }
});

schoolRouter.delete('/library/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "school_library_items" WHERE id = $1`, req.params.id as string);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to delete library item' }); }
});

export { schoolRouter };
