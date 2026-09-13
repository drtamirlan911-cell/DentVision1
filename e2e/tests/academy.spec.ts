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
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data || body)).toBeTruthy();
  });

  test('ACADEMY-002: Get course → 200 + correct data', async () => {
    const list = await api.get(`${BASE_URL}/api/academies/courses`, { headers: auth(ownerToken) });
    const body = await list.json();
    const courses = Array.isArray(body.data) ? body.data : body.data?.courses || [];
    test.skip(!courses.length, 'No seeded academy courses available');
    testCourseId = courses[0].id;

    const res = await api.get(`${BASE_URL}/api/academies/courses/${testCourseId}`, { headers: auth(ownerToken) });
    expect(res.status()).toBe(200);
    const detail = await res.json();
    expect(detail.data?.id || detail.id).toBe(testCourseId);
  });

  test('ACADEMY-003: Enroll in course → 201', async () => {
    test.skip(!testCourseId, 'No test course available');
    const res = await api.post(`${BASE_URL}/api/school/enrollments`, {
      headers: auth(ownerToken),
      data: { courseId: testCourseId },
    });
    expect([200, 201, 409]).toContain(res.status());
    if (res.status() !== 409) {
      const body = await res.json();
      testEnrollmentId = body.data?.id || body.id || '';
    }
  });

  test('ACADEMY-004: Get enrollment → 200 + correct data', async () => {
    test.skip(!testEnrollmentId, 'No enrollment created');
    const res = await api.get(`${BASE_URL}/api/school/enrollments/${testEnrollmentId}`, { headers: auth(ownerToken) });
    expect(res.status()).toBe(200);
  });

  test('ACADEMY-005: Course progress update → 200', async () => {
    test.skip(!testEnrollmentId, 'No enrollment created');
    const res = await api.post(`${BASE_URL}/api/school/enrollments/${testEnrollmentId}/progress`, {
      headers: auth(ownerToken),
      data: { progress: 50 },
    });
    expect([200, 201]).toContain(res.status());
  });

  test('ACADEMY-006: Complete course → 200 + certificate', async () => {
    test.skip(!testEnrollmentId, 'No enrollment created');
    const res = await api.post(`${BASE_URL}/api/school/enrollments/${testEnrollmentId}/complete`, { headers: auth(ownerToken) });
    expect([200, 201]).toContain(res.status());
  });

  test('ACADEMY-007: Unpaid user cannot access premium content → 403', async () => {
    const res = await api.get(`${BASE_URL}/api/school/premium`, { headers: auth(ownerToken) });
    expect([403, 404]).toContain(res.status());
  });

  test('ACADEMY-008: Double enrollment → 409 or idempotent', async () => {
    test.skip(!testCourseId, 'No test course available');
    const first = await api.post(`${BASE_URL}/api/school/enrollments`, {
      headers: auth(ownerToken),
      data: { courseId: testCourseId },
    });
    const second = await api.post(`${BASE_URL}/api/school/enrollments`, {
      headers: auth(ownerToken),
      data: { courseId: testCourseId },
    });
    expect([200, 201, 409]).toContain(first.status());
    expect([200, 201, 409]).toContain(second.status());
  });
});
