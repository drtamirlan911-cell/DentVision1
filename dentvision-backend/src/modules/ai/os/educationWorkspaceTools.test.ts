import { beforeEach, describe, expect, it, vi } from 'vitest';

const { lecturerFindFirst, courseCount, courseFindMany } = vi.hoisted(() => ({
  lecturerFindFirst: vi.fn(),
  courseCount: vi.fn(),
  courseFindMany: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    lecturer: { findFirst: lecturerFindFirst },
    course: { count: courseCount, findMany: courseFindMany },
  },
}));

import { getLecturerCoursesOverview } from './educationWorkspaceTools.js';

const context = {
  userId: 'lecturer-user-1',
  lecturerId: 'lecturer-1',
  role: 'LECTURER',
};

describe('getLecturerCoursesOverview — lecturer-owned read-only catalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lecturerFindFirst.mockResolvedValue({
      id: 'lecturer-1',
      level: 'expert',
      academy: { id: 'academy-1', name: 'DentVision Academy' },
    });
    courseCount.mockResolvedValue(1);
    courseFindMany.mockResolvedValue([{
      id: 'course-1',
      title: 'Modern Endodontics',
      category: 'Endodontics',
      format: 'course',
      duration: '8 weeks',
      startsAt: new Date('2026-12-01T00:00:00.000Z'),
      seats: 30,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-10T00:00:00.000Z'),
      _count: { enrollments: 14, lessons: 8 },
      students: [{ id: 'private-student', email: 'private@example.com' }],
      walletBalance: 'private-finance-value',
    }]);
  });

  it('returns only courses owned by the authenticated lecturer', async () => {
    const result = await getLecturerCoursesOverview(context);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      lecturer: { id: 'lecturer-1', level: 'expert', academy: { id: 'academy-1', name: 'DentVision Academy' } },
      totalCourses: 1,
      returned: 1,
      hasMore: false,
      courses: [{
        id: 'course-1',
        title: 'Modern Endodontics',
        category: 'Endodontics',
        format: 'course',
        enrollmentCount: 14,
        lessonCount: 8,
      }],
    });
    expect(lecturerFindFirst).toHaveBeenCalledWith({
      where: { id: 'lecturer-1', userId: 'lecturer-user-1' },
      select: { id: true, level: true, academy: { select: { id: true, name: true } } },
    });
    expect(courseFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { lecturerId: 'lecturer-1' },
      take: 51,
      select: expect.objectContaining({
        id: true, title: true, category: true, format: true,
        _count: { select: { enrollments: true, lessons: true } },
      }),
    }));
    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain('private-student');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('private-finance-value');
  });

  it('rejects non-lecturer context before querying identity or courses', async () => {
    const result = await getLecturerCoursesOverview({ ...context, role: 'STUDENT' });
    expect(result.ok).toBe(false);
    expect(lecturerFindFirst).not.toHaveBeenCalled();
    expect(courseCount).not.toHaveBeenCalled();
    expect(courseFindMany).not.toHaveBeenCalled();
  });

  it('rejects a lecturer id that is not owned by the current user', async () => {
    lecturerFindFirst.mockResolvedValueOnce(null);
    const result = await getLecturerCoursesOverview(context);
    expect(result.ok).toBe(false);
    expect(courseCount).not.toHaveBeenCalled();
    expect(courseFindMany).not.toHaveBeenCalled();
  });

  it('bounds output to 50 courses and indicates when more exist', async () => {
    courseCount.mockResolvedValueOnce(51);
    courseFindMany.mockResolvedValueOnce(Array.from({ length: 51 }, (_, index) => ({
      id: 'course-' + index,
      title: 'Course ' + index,
      category: null,
      format: 'course',
      duration: null,
      startsAt: null,
      seats: null,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: null,
      _count: { enrollments: 0, lessons: 0 },
    })));

    const result = await getLecturerCoursesOverview(context);
    expect(result.ok).toBe(true);
    expect(result.data.returned).toBe(50);
    expect(result.data.totalCourses).toBe(51);
    expect(result.data.hasMore).toBe(true);
  });
});
