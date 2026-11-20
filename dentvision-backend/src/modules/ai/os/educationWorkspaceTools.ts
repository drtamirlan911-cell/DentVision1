import prisma from '../../../lib/prisma.js';

export interface LecturerCoursesOverviewContext {
  userId: string;
  lecturerId: string | null;
  role: string;
}

function safeCourseLabel(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

/**
 * Read-only view of the current lecturer's own courses.
 * Ownership is rechecked against Lecturer.userId; student identities and money
 * movements are deliberately excluded from the AI response.
 */
export async function getLecturerCoursesOverview(context: LecturerCoursesOverviewContext) {
  if (
    !context.userId
    || !context.lecturerId
    || String(context.role || '').trim().toUpperCase() !== 'LECTURER'
  ) {
    return { ok: false as const, error: 'Нет подтверждённого кабинета лектора' };
  }

  try {
    const lecturer = await prisma.lecturer.findFirst({
      where: { id: context.lecturerId, userId: context.userId },
      select: {
        id: true,
        level: true,
        academy: { select: { id: true, name: true } },
      },
    });
    if (!lecturer) {
      return { ok: false as const, error: 'Кабинет лектора не принадлежит текущему пользователю' };
    }

    const where = { lecturerId: lecturer.id };
    const [totalCourses, rows] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          format: true,
          duration: true,
          startsAt: true,
          seats: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { enrollments: true, lessons: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 51,
      }),
    ]);

    const courses = rows.slice(0, 50).map((course) => ({
      id: course.id,
      title: safeCourseLabel(course.title, 160) || 'Курс без названия',
      category: safeCourseLabel(course.category, 80),
      format: safeCourseLabel(course.format, 40) || 'course',
      duration: safeCourseLabel(course.duration, 80),
      startsAt: course.startsAt,
      seats: course.seats,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      enrollmentCount: course._count.enrollments,
      lessonCount: course._count.lessons,
    }));

    return {
      ok: true as const,
      data: {
        lecturer: {
          id: lecturer.id,
          level: safeCourseLabel(lecturer.level, 40),
          academy: lecturer.academy
            ? {
                id: lecturer.academy.id,
                name: safeCourseLabel(lecturer.academy.name, 120),
              }
            : null,
        },
        totalCourses,
        returned: courses.length,
        hasMore: totalCourses > courses.length,
        courses,
      },
    };
  } catch {
    return { ok: false as const, error: 'Не удалось безопасно загрузить курсы текущего лектора' };
  }
}
