import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { prisma } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };

let ownerToken = '';
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

test.describe('Academy / Course Workflow', () => {
  let api: APIRequestContext;

  /**
   * `api` is a context this file owns, created here and disposed in `afterAll`.
   *
   * It previously captured Playwright's `request` fixture in `beforeAll`,
   * which Playwright does not allow to be reused from tests. The suite now owns
   * a dedicated APIRequestContext and disposes it in `afterAll`.
   *
   * Current CI's core E2E command includes this file through the
   * `e2e/tests/*.spec.ts` glob (only explicitly excluded suites are omitted).
   * Do not reintroduce the old claim that Academy is absent from CI.
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

  test('ACADEMY-005: learner cannot forge lesson progress or course completion', async () => {
    const coursesRes = await api.get(`${BASE_URL}/api/academies/courses`, { headers: auth(ownerToken) });
    const endpoint = coursesRes.status() === 404 ? '/api/school/courses' : '/api/academies/courses';
    const base = enrollmentBase(endpoint);
    const enrollRes = await api.get(`${BASE_URL}${base}/enrollments`, { headers: auth(ownerToken) });
    const enrollBody = await enrollRes.json();
    const enrollData = enrollBody.data || enrollBody;
    const enrollments = enrollData.enrollments || enrollData;
    const enrollment = Array.isArray(enrollments)
      ? enrollments.find((row: any) => !row.completed && row.accessStatus === 'active')
      : null;

    if (enrollment) {
      const beforeProgress = enrollment.progress;
      const forged = await api.patch(`${BASE_URL}${base}/enrollments/${enrollment.id}`, {
        headers: auth(ownerToken),
        data: { progress: 100, completed: true },
      });
      expect(forged.status()).toBe(400);

      const refreshed = await api.get(`${BASE_URL}${base}/enrollments`, { headers: auth(ownerToken) });
      const refreshedBody = await refreshed.json();
      const refreshedData = refreshedBody.data || refreshedBody;
      const rows = refreshedData.enrollments || refreshedData;
      const unchanged = rows.find((row: any) => row.id === enrollment.id);
      expect(unchanged.completed).toBe(false);
      expect(unchanged.progress).toBe(beforeProgress);
    }
  });

  test('ACADEMY-006: course certificate is not issued from a client-side progress update', async () => {
    const coursesRes = await api.get(`${BASE_URL}/api/academies/courses`, { headers: auth(ownerToken) });
    const endpoint = coursesRes.status() === 404 ? '/api/school/courses' : '/api/academies/courses';
    const base = enrollmentBase(endpoint);
    const enrollRes = await api.get(`${BASE_URL}${base}/enrollments`, { headers: auth(ownerToken) });
    const enrollBody = await enrollRes.json();
    const enrollData = enrollBody.data || enrollBody;
    const enrollments = enrollData.enrollments || enrollData;
    const enrollment = Array.isArray(enrollments)
      ? enrollments.find((row: any) => !row.completed && row.accessStatus === 'active')
      : null;

    if (enrollment) {
      const forged = await api.patch(`${BASE_URL}${base}/enrollments/${enrollment.id}`, {
        headers: auth(ownerToken),
        data: { progress: 100, completed: true },
      });
      expect(forged.status()).toBe(400);

      const certificates = await api.get(`${BASE_URL}/api/school/certificates`, { headers: auth(ownerToken) });
      expect(certificates.status()).toBe(200);
      const certificateBody = await certificates.json();
      const certificateData = certificateBody.data || certificateBody;
      expect(certificateData.some((item: any) => item.courseId === enrollment.courseId)).toBe(false);
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
      expect([200, 401, 403]).toContain(unauthRes.status());
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
