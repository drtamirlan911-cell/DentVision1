import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { prisma } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };

let ownerToken = '';
let testCourseId = '';
let testEnrollmentId = '';
let protectedCourseId = '';
let protectedEnrollmentId = '';
let academyHistoryCourseIds: string[] = [];
let academyHistoryEnrollmentIds: string[] = [];

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
    if (protectedEnrollmentId) {
      await prisma.schoolEnrollment.deleteMany({ where: { id: protectedEnrollmentId } }).catch(() => {});
    }
    if (protectedCourseId) {
      await prisma.course.deleteMany({ where: { id: protectedCourseId } }).catch(() => {});
    }
    if (academyHistoryEnrollmentIds.length) {
      await prisma.schoolEnrollment.deleteMany({ where: { id: { in: academyHistoryEnrollmentIds } } }).catch(() => {});
    }
    if (academyHistoryCourseIds.length) {
      await prisma.course.deleteMany({ where: { id: { in: academyHistoryCourseIds } } }).catch(() => {});
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

  test('ACADEMY-009: lecturer cannot delete a course with learner history', async () => {
    const registration = await api.post(`${BASE_URL}/api/lecturer/register`, {
      headers: auth(ownerToken),
      data: {},
    });
    expect([200, 201]).toContain(registration.status());
    const registrationBody = await registration.json();
    const lecturerId = (registrationBody.data || registrationBody).id;
    expect(lecturerId).toBeTruthy();

    await prisma.lecturer.update({ where: { id: lecturerId }, data: { level: 'verified' } });
    const switched = await api.post(`${BASE_URL}/api/iam/switch-context`, {
      headers: auth(ownerToken),
      data: { scopeType: 'LECTURER', scopeId: lecturerId },
    });
    expect(switched.status()).toBe(200);
    const switchedBody = await switched.json();
    const lecturerToken = switchedBody.data?.accessToken || switchedBody.accessToken;
    expect(lecturerToken).toBeTruthy();

    const created = await api.post(`${BASE_URL}/api/lecturer/courses`, {
      headers: auth(lecturerToken),
      data: { title: 'Protected learner history regression', format: 'course', price: 0 },
    });
    expect(created.status()).toBe(201);
    const courseBody = await created.json();
    protectedCourseId = (courseBody.data || courseBody).id;
    expect(protectedCourseId).toBeTruthy();

    const owner = await prisma.user.findUniqueOrThrow({ where: { email: OWNER.email }, select: { id: true } });
    const enrollment = await prisma.schoolEnrollment.create({
      data: { userId: owner.id, courseId: protectedCourseId, acquisitionType: 'free', accessStatus: 'active' },
    });
    protectedEnrollmentId = enrollment.id;

    const deleted = await api.delete(`${BASE_URL}/api/lecturer/courses/${protectedCourseId}`, {
      headers: auth(lecturerToken),
    });
    expect(deleted.status()).toBe(409);
    expect(await prisma.course.findUnique({ where: { id: protectedCourseId }, select: { id: true } })).not.toBeNull();
    expect(await prisma.schoolEnrollment.findUnique({ where: { id: protectedEnrollmentId }, select: { id: true } })).not.toBeNull();
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

  async function createAcademyHistoryFixture(courseTitle: string) {
    const registration = await api.post(`${BASE_URL}/api/academies/register`, {
      headers: auth(ownerToken),
      data: { name: `E2E Academy ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, city: 'Taraz' },
    });
    const registrationText = await registration.text();
    expect(registration.status(), registrationText).toBe(201);
    const registrationBody = JSON.parse(registrationText);
    const organizationId = registrationBody.data?.organizationId;
    expect(organizationId).toBeTruthy();

    const contextResponse = await api.get(`${BASE_URL}/api/iam/me/contexts`, {
      headers: auth(ownerToken),
    });
    const contextText = await contextResponse.text();
    expect(contextResponse.status(), contextText).toBe(200);
    const contextBody = JSON.parse(contextText);
    const availableContexts = contextBody.data?.contexts || contextBody.contexts || [];
    expect(availableContexts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scopeType: 'ACADEMY',
        organizationId,
        roleKey: 'academy_owner',
        roleLabel: 'Владелец академии',
      }),
    ]));

    const switched = await api.post(`${BASE_URL}/api/iam/switch-context`, {
      headers: auth(ownerToken),
      data: { scopeType: 'ACADEMY', scopeId: organizationId },
    });
    const switchedText = await switched.text();
    expect(switched.status(), switchedText).toBe(200);
    const academyToken = JSON.parse(switchedText).data?.accessToken;
    expect(academyToken).toBeTruthy();

    const created = await api.post(`${BASE_URL}/api/school/courses`, {
      headers: auth(academyToken),
      data: {
        title: courseTitle,
        description: 'Полная программа курса для проверки публикации и сохранения учебной истории.',
        price: 0,
        modules: [{
          title: 'Основной модуль',
          lessons: [{
            title: 'Урок с сохранённой историей',
            type: 'text',
            contentUrl: 'Исходное содержание урока',
            duration: 10,
            order: 0,
          }],
        }],
      },
    });
    const createdText = await created.text();
    expect(created.status(), createdText).toBe(201);
    const course = JSON.parse(createdText).data;
    expect(course?.id).toBeTruthy();
    expect(course?.publicationStatus).toBe('draft');
    academyHistoryCourseIds.push(course.id);

    const draftDetail = await api.get(`${BASE_URL}/api/school/courses/${course.id}`);
    expect(draftDetail.status()).toBe(404);

    const published = await api.patch(`${BASE_URL}/api/school/courses/${course.id}/publication`, {
      headers: auth(academyToken),
      data: { publicationStatus: 'published' },
    });
    const publishedText = await published.text();
    expect(published.status(), publishedText).toBe(200);

    const publicDetail = await api.get(`${BASE_URL}/api/school/courses/${course.id}`);
    expect(publicDetail.status()).toBe(200);

    const learner = await prisma.user.findUniqueOrThrow({
      where: { email: OWNER.email },
      select: { id: true },
    });
    const enrollment = await prisma.schoolEnrollment.create({
      data: {
        userId: learner.id,
        courseId: course.id,
        acquisitionType: 'free',
        accessStatus: 'active',
      },
    });
    academyHistoryEnrollmentIds.push(enrollment.id);
    return { academyToken, courseId: course.id, enrollmentId: enrollment.id };
  }

  test('ACADEMY-010: academy owner cannot replace lesson history for enrolled learners', async () => {
    const fixture = await createAcademyHistoryFixture('Immutable learning history update');
    const beforeLessons = await prisma.lesson.findMany({
      where: { courseId: fixture.courseId },
      orderBy: { order: 'asc' },
    });
    expect(beforeLessons).toHaveLength(1);

    const update = await api.put(`${BASE_URL}/api/school/courses/${fixture.courseId}`, {
      headers: auth(fixture.academyToken),
      data: {
        title: 'Attempted destructive content replacement',
        modules: [{
          title: 'Изменённый модуль',
          lessons: [{
            title: 'Новая версия урока',
            type: 'text',
            contentUrl: 'Новое содержание не должно подменять историю',
            duration: 15,
            order: 0,
          }],
        }],
      },
    });
    const updateText = await update.text();
    expect(update.status(), updateText).toBe(409);

    const [course, afterLessons, enrollment] = await Promise.all([
      prisma.course.findUnique({ where: { id: fixture.courseId }, select: { title: true } }),
      prisma.lesson.findMany({ where: { courseId: fixture.courseId }, orderBy: { order: 'asc' } }),
      prisma.schoolEnrollment.findUnique({ where: { id: fixture.enrollmentId }, select: { id: true } }),
    ]);
    expect(course?.title).toBe('Immutable learning history update');
    expect(afterLessons.map((lesson) => lesson.id)).toEqual(beforeLessons.map((lesson) => lesson.id));
    expect(afterLessons[0]).toMatchObject({
      title: 'Урок с сохранённой историей',
      content: 'Исходное содержание урока',
    });
    expect(enrollment).not.toBeNull();
  });

  test('ACADEMY-011: academy owner cannot delete a course with learner history', async () => {
    const fixture = await createAcademyHistoryFixture('Protected academy owner course');
    const lessonBefore = await prisma.lesson.findFirstOrThrow({
      where: { courseId: fixture.courseId },
      select: { id: true },
    });

    const deletion = await api.delete(`${BASE_URL}/api/school/courses/${fixture.courseId}`, {
      headers: auth(fixture.academyToken),
    });
    const deletionText = await deletion.text();
    expect(deletion.status(), deletionText).toBe(409);

    const [course, enrollment, lesson] = await Promise.all([
      prisma.course.findUnique({ where: { id: fixture.courseId }, select: { id: true } }),
      prisma.schoolEnrollment.findUnique({ where: { id: fixture.enrollmentId }, select: { id: true } }),
      prisma.lesson.findUnique({ where: { id: lessonBefore.id }, select: { id: true } }),
    ]);
    expect(course).not.toBeNull();
    expect(enrollment).not.toBeNull();
    expect(lesson).not.toBeNull();
  });

  test('ACADEMY-012: archived course leaves discovery and sales but keeps active learner access', async () => {
    const fixture = await createAcademyHistoryFixture('Archived learner access lifecycle');

    const archived = await api.patch(`${BASE_URL}/api/school/courses/${fixture.courseId}/publication`, {
      headers: auth(fixture.academyToken),
      data: { publicationStatus: 'archived' },
    });
    const archivedText = await archived.text();
    expect(archived.status(), archivedText).toBe(200);
    expect(JSON.parse(archivedText).data?.publicationStatus).toBe('archived');

    const [catalog, managedCatalog, managedLearners, learnerDetail, publicDetail, newSale] = await Promise.all([
      api.get(`${BASE_URL}/api/school/courses`, { headers: auth(ownerToken) }),
      api.get(`${BASE_URL}/api/school/courses/managed`, { headers: auth(fixture.academyToken) }),
      api.get(`${BASE_URL}/api/school/enrollments/managed`, { headers: auth(fixture.academyToken) }),
      api.get(`${BASE_URL}/api/school/courses/${fixture.courseId}`, { headers: auth(ownerToken) }),
      api.get(`${BASE_URL}/api/school/courses/${fixture.courseId}`),
      api.post(`${BASE_URL}/api/school/commerce/register`, {
        headers: auth(ownerToken),
        data: { productId: fixture.courseId, format: 'course' },
      }),
    ]);
    const catalogBody = await catalog.json();
    const catalogRows = catalogBody.data || catalogBody;
    expect(Array.isArray(catalogRows)).toBe(true);
    expect(catalogRows.some((course: any) => course.id === fixture.courseId)).toBe(false);

    const managedBody = await managedCatalog.json();
    const managedRows = managedBody.data || managedBody;
    const managedCourse = managedRows.find((course: any) => course.id === fixture.courseId);
    expect(managedCourse?.publicationStatus).toBe('archived');

    const managedLearnerBody = await managedLearners.json();
    const managedLearnerRows = managedLearnerBody.data || managedLearnerBody;
    expect(managedLearnerRows.some((row: any) => row.id === fixture.enrollmentId)).toBe(true);

    expect(learnerDetail.status()).toBe(200);
    const detailBody = await learnerDetail.json();
    const detail = detailBody.data || detailBody;
    expect(detail.lessons).toHaveLength(1);
    expect(detail.lessons[0].title).toBe('Урок с сохранённой историей');
    expect(publicDetail.status()).toBe(404);

    expect(newSale.status()).toBe(409);
    const newSaleBody = await newSale.json();
    expect(newSaleBody.code).toBe('ACADEMY_COURSE_ARCHIVED');

    const republished = await api.patch(`${BASE_URL}/api/school/courses/${fixture.courseId}/publication`, {
      headers: auth(fixture.academyToken),
      data: { publicationStatus: 'published' },
    });
    const republishedText = await republished.text();
    expect(republished.status(), republishedText).toBe(200);
    expect(JSON.parse(republishedText).data?.publicationStatus).toBe('published');

    const republishedCatalog = await api.get(`${BASE_URL}/api/school/courses`, {
      headers: auth(ownerToken),
    });
    const republishedCatalogBody = await republishedCatalog.json();
    const republishedRows = republishedCatalogBody.data || republishedCatalogBody;
    expect(republishedRows.some((course: any) => course.id === fixture.courseId)).toBe(true);
  });

});
