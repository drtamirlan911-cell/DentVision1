import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { prisma } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };

let ownerToken = '';
let lecturerToken = '';
let testCourseId = '';
let testEnrollmentId = '';

async function loginOwner(api: APIRequestContext) {
  if (ownerToken) return ownerToken;
  const res = await api.post(`${BASE_URL}/api/auth/login`, {
    data: { email: OWNER.email, password: OWNER.password },
  });
  const body = await res.json();
  ownerToken = body.data?.accessToken || body.accessToken;
  return ownerToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function loginLecturer(api: APIRequestContext) {
  if (lecturerToken) return lecturerToken;
  const res = await api.post(`${BASE_URL}/api/auth/login`, {
    data: { email: 'lecturer@test.com', password: 'Test1234!' },
  });
  const body = await res.json();
  lecturerToken = body.data?.accessToken || body.accessToken;
  return lecturerToken;
}
test.describe('Academy / Course Workflow', () => {
  test('ACADEMY-010: lecturer course CRUD stays inside the active Academy organization', async () => {
    const lecturerApi = await apiRequest.newContext();
    const token = await loginLecturer(lecturerApi);
    const otherAcademyId = `academy-cross-tenant-${Date.now()}`;
    const foreignCourseId = `course-cross-tenant-${Date.now()}`;

    try {
      const created = await lecturerApi.post(`${BASE_URL}/api/school/courses`, {
        headers: auth(token),
        data: {
          title: 'E2E Lecturer Scoped Course',
          description: 'Academy scope regression',
          price: 10000,
          category: 'E2E',
          durationHours: 2,
          tags: ['e2e', 'scoped'],
          modules: [{ title: 'Scoped module', lessons: [{ title: 'Scoped lesson' }] }],
        },
      });
      expect(created.status()).toBe(201);
      const createdBody = await created.json();
      const createdCourse = createdBody.data || createdBody;
      expect(createdCourse.academyId).toBeTruthy();
      expect(createdCourse.lecturerId).toBeTruthy();
      testCourseId = createdCourse.id;

      const otherAcademy = await prisma.academy.create({
        data: { id: otherAcademyId, name: 'E2E Other Academy', city: 'Астана' },
      });
      await prisma.course.create({
        data: {
          id: foreignCourseId,
          title: 'E2E Foreign Academy Course',
          price: 10000,
          academyId: otherAcademy.id,
          format: 'course',
        },
      });

      const forbiddenUpdate = await lecturerApi.put(`${BASE_URL}/api/school/courses/${foreignCourseId}`, {
        headers: auth(token),
        data: { title: 'Attempted cross-Academy mutation' },
      });
      expect(forbiddenUpdate.status()).toBe(403);

      const forbiddenDelete = await lecturerApi.delete(`${BASE_URL}/api/school/courses/${foreignCourseId}`, {
        headers: auth(token),
      });
      expect(forbiddenDelete.status()).toBe(403);

      const updated = await lecturerApi.put(`${BASE_URL}/api/school/courses/${testCourseId}`, {
        headers: auth(token),
        data: { title: 'E2E Lecturer Scoped Course Updated', modules: [] },
      });
      expect(updated.status()).toBe(200);

      const deleted = await lecturerApi.delete(`${BASE_URL}/api/school/courses/${testCourseId}`, {
        headers: auth(token),
      });
      expect(deleted.status()).toBe(200);
      testCourseId = '';
    } finally {
      await prisma.course.deleteMany({ where: { id: { in: [foreignCourseId, testCourseId].filter(Boolean) } } }).catch(() => {});
      await prisma.academy.deleteMany({ where: { id: otherAcademyId } }).catch(() => {});
      await lecturerApi.dispose();
    }
  });
  test('ACADEMY-009: public Academy catalog cannot expose paid assets or professional-only courses', async () => {
    const publicApi = await apiRequest.newContext();
    const generalId = `academy-security-general-${Date.now()}`;
    const professionalId = `academy-security-professional-${Date.now()}`;

    try {
      await prisma.course.create({
        data: {
          id: generalId,
          title: 'E2E Public Paid Catalog',
          description: 'Catalog security fixture',
          price: 45000,
          format: 'course',
          fileUrl: 'https://private.example/paid-course.pdf',
          meta: {
            audiences: ['GENERAL'],
            modules: [{ title: 'Private module', lessons: [{ title: 'Secret lesson', contentUrl: 'https://private.example/secret.mp4' }] }],
          },
          lessons: {
            create: [{
              id: `lesson-security-${Date.now()}`,
              title: 'Secret lesson',
              content: 'SECRET_PAID_LESSON_CONTENT',
              videoUrl: 'https://private.example/secret.mp4',
              order: 0,
              duration: 20,
            }],
          },
        },
      });
      await prisma.course.create({
        data: {
          id: professionalId,
          title: 'E2E Professional Only Course',
          description: 'Professional catalog fixture',
          price: 30000,
          format: 'course',
          meta: { audiences: ['PROFESSIONAL'], modules: [{ title: 'Professional private module' }] },
        },
      });

      const listRes = await publicApi.get(`${BASE_URL}/api/school/courses`);
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      const courses = Array.isArray(body.data) ? body.data : body.data?.courses || body.data || [];

      const publicPaid = courses.find((course: { id?: string }) => course.id === generalId);
      expect(publicPaid, 'general-audience paid course remains catalog-visible').toBeTruthy();
      expect(publicPaid.fileUrl).toBeNull();
      expect(publicPaid.modules).toBeUndefined();
      expect(publicPaid.meta?.modules).toBeUndefined();

      expect(
        courses.some((course: { id?: string }) => course.id === professionalId),
        'professional-only course must not enter public catalog',
      ).toBe(false);

      const unauthDetail = await publicApi.get(`${BASE_URL}/api/school/courses/${generalId}`);
      expect([401, 403]).toContain(unauthDetail.status());

      const professionalDetail = await publicApi.get(`${BASE_URL}/api/school/courses/${professionalId}`);
      expect(professionalDetail.status()).toBe(404);
    } finally {
      await prisma.course.deleteMany({ where: { id: { in: [generalId, professionalId] } } }).catch(() => {});
      await publicApi.dispose();
    }
  });


  let api: APIRequestContext;

  /**
   * `api` is a context this file owns, created here and disposed in `afterAll`.
   *
   * It used to be Playwright's `request` fixture, captured in `beforeAll` and
   * reused from the tests — which Playwright refuses outright:
   * "Fixture { request } from beforeAll cannot be reused in a test." Every test
   * in this file threw that at its first call. Nothing noticed, because the suite
   * was never run: `test:e2e` is in package.json and in no CI workflow.
   */
  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    await loginOwner(api);
  });

  test.afterAll(async () => {
    await api.dispose();
    if (testEnrollmentId) {
      await prisma.schoolEnrollment.deleteMany({ where: { id: testEnrollmentId } }).catch(() => {});
    }
    if (testCourseId) {
      await prisma.course.deleteMany({ where: { id: testCourseId } }).catch(() => {});
    }
  });

  test('ACADEMY-001: List courses → 200 + array', async () => {
    const res = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    if (res.status() === 404) {
      const altRes = await api.get(`${BASE_URL}/api/school/courses`, {
        headers: auth(ownerToken),
      });
      expect(altRes.status()).toBe(200);
      const body = await altRes.json();
      const data = body.data || body;
      const courses = data.courses || data;
      expect(Array.isArray(courses)).toBe(true);
    } else {
      expect(res.status()).toBe(200);
      const body = await res.json();
      const data = body.data || body;
      const courses = data.courses || data;
      expect(Array.isArray(courses)).toBe(true);
    }
  });

  test('ACADEMY-002: Get course → 200 + correct data', async () => {
    const listRes = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    let endpoint = '/api/academies/courses';
    let listBody = await listRes.json();
    if (listRes.status() === 404) {
      const altRes = await api.get(`${BASE_URL}/api/school/courses`, {
        headers: auth(ownerToken),
      });
      endpoint = '/api/school/courses';
      listBody = await altRes.json();
    }
    const listData = listBody.data || listBody;
    const courses = listData.courses || listData;

    if (Array.isArray(courses) && courses.length > 0) {
      const course = courses[0];
      testCourseId = course.id;
      const res = await api.get(`${BASE_URL}${endpoint}/${course.id}`, {
        headers: auth(ownerToken),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const data = body.data || body;
      expect(data.id || data.course?.id).toBeDefined();
    }
  });

  // `/api/academies/*` (academy.routes.ts) is CRUD for academy organizations
  // themselves — it has no /courses, /enroll, or /enrollments routes at all.
  // The actual student-facing course catalog and enrollment flow lives under
  // `/api/school/*` (school.routes.ts: POST/GET /enrollments, PATCH
  // /enrollments/:id). ACADEMY-001/002 already probe for a 404 on
  // /api/academies/courses and fall back to /api/school/courses; enrollment
  // needs the same fallback; parallel to `endpoint` for the course routes.
  function enrollmentBase(courseEndpoint: string) {
    return courseEndpoint === '/api/school/courses' ? '/api/school' : '/api/academies';
  }

  test('ACADEMY-003: Enroll in course → 201', async () => {
    const listRes = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    let endpoint = '/api/academies/courses';
    let listBody = await listRes.json();
    if (listRes.status() === 404) {
      const altRes = await api.get(`${BASE_URL}/api/school/courses`, {
        headers: auth(ownerToken),
      });
      endpoint = '/api/school/courses';
      listBody = await altRes.json();
    }
    const listData = listBody.data || listBody;
    const courses = listData.courses || listData;

    if (Array.isArray(courses) && courses.length > 0) {
      const course = courses[0];
      testCourseId = course.id;
      const res = await api.post(`${BASE_URL}${enrollmentBase(endpoint)}/enrollments`, {
        headers: auth(ownerToken),
        data: { courseId: course.id },
      });
      expect([200, 201, 409]).toContain(res.status());
      if (res.status() === 201 || res.status() === 200) {
        const body = await res.json();
        const data = body.data || body;
        testEnrollmentId = data.id || data.enrollment?.id;
      }
    }
  });

  test('ACADEMY-004: Get enrollment → 200 + correct data', async () => {
    const coursesRes = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    const endpoint = coursesRes.status() === 404 ? '/api/school/courses' : '/api/academies/courses';
    const res = await api.get(`${BASE_URL}${enrollmentBase(endpoint)}/enrollments`, {
      headers: auth(ownerToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body.data || body;
    const enrollments = data.enrollments || data;
    expect(Array.isArray(enrollments)).toBe(true);
  });

  test('ACADEMY-005: Course progress update → 200', async () => {
    const coursesRes = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    const endpoint = coursesRes.status() === 404 ? '/api/school/courses' : '/api/academies/courses';
    const base = enrollmentBase(endpoint);
    const enrollRes = await api.get(`${BASE_URL}${base}/enrollments`, {
      headers: auth(ownerToken),
    });
    const enrollBody = await enrollRes.json();
    const enrollData = enrollBody.data || enrollBody;
    const enrollments = enrollData.enrollments || enrollData;

    if (Array.isArray(enrollments) && enrollments.length > 0) {
      const enrollment = enrollments[0];
      // PATCH /enrollments/:id, not a /progress sub-route — school.routes.ts
      // registers no such path, only the plain enrollment update.
      const res = await api.patch(
        `${BASE_URL}${base}/enrollments/${enrollment.id}`,
        {
          headers: auth(ownerToken),
          data: { progress: 50, completedLessons: ['lesson-1'] },
        },
      );
      expect(res.status()).toBe(200);
    }
  });

  test('ACADEMY-006: Complete course → 200 + certificate', async () => {
    const coursesRes = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    const endpoint = coursesRes.status() === 404 ? '/api/school/courses' : '/api/academies/courses';
    const base = enrollmentBase(endpoint);
    const enrollRes = await api.get(`${BASE_URL}${base}/enrollments`, {
      headers: auth(ownerToken),
    });
    const enrollBody = await enrollRes.json();
    const enrollData = enrollBody.data || enrollBody;
    const enrollments = enrollData.enrollments || enrollData;

    if (Array.isArray(enrollments) && enrollments.length > 0) {
      const enrollment = enrollments[0];
      // The route only issues a certificateUrl when `completed: true` is
      // sent explicitly — it doesn't infer completion from progress
      // reaching 100 (school.routes.ts's PATCH /enrollments/:id).
      const res = await api.patch(
        `${BASE_URL}${base}/enrollments/${enrollment.id}`,
        {
          headers: auth(ownerToken),
          data: { progress: 100, completed: true },
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      const data = body.data || body;
      expect(data.certificateUrl || data.completed || data.progress).toBeDefined();
    }
  });

  test('ACADEMY-007: Unpaid user cannot access premium content → 403', async () => {
    const res = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    let endpoint = '/api/academies/courses';
    if (res.status() === 404) {
      endpoint = '/api/school/courses';
    }
    const listBody = await (res.status() === 404
      ? api.get(`${BASE_URL}${endpoint}`, { headers: auth(ownerToken) })
      : res);
    const listData = await listBody.json();
    const courses = (listData.data || listData).courses || listData.data || listData;

    if (Array.isArray(courses) && courses.length > 0) {
      const premium = courses.find((c: any) => c.price > 0) || courses[0];
      const unauthRes = await api.get(`${BASE_URL}${endpoint}/${premium.id}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect([401, 403]).toContain(unauthRes.status());
    }
  });

  test('ACADEMY-008: Double enrollment → 409 or idempotent', async () => {
    const listRes = await api.get(`${BASE_URL}/api/academies/courses`, {
      headers: auth(ownerToken),
    });
    let endpoint = '/api/academies/courses';
    let listBody = await listRes.json();
    if (listRes.status() === 404) {
      const altRes = await api.get(`${BASE_URL}/api/school/courses`, {
        headers: auth(ownerToken),
      });
      endpoint = '/api/school/courses';
      listBody = await altRes.json();
    }
    const listData = listBody.data || listBody;
    const courses = listData.courses || listData;

    if (Array.isArray(courses) && courses.length > 0) {
      const course = courses[0];
      const base = enrollmentBase(endpoint);
      const res1 = await api.post(`${BASE_URL}${base}/enrollments`, {
        headers: auth(ownerToken),
        data: { courseId: course.id },
      });
      const res2 = await api.post(`${BASE_URL}${base}/enrollments`, {
        headers: auth(ownerToken),
        data: { courseId: course.id },
      });
      expect([200, 201, 409]).toContain(res2.status());
    }
  });
});
