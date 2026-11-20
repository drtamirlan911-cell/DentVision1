import { test, expect, type APIRequestContext, request as apiRequest } from '@playwright/test';
import { cleanupTestUser, prisma } from '../helpers/db';

const API = process.env.VITE_API_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test.describe('Student OS — personal learning, assessment and credentials', () => {
  let api: APIRequestContext;
  const stamp = Date.now();
  const email = `student-os-${stamp}@test.com`;
  const otherEmail = `student-os-other-${stamp}@test.com`;
  let studentToken = '';
  let otherStudentToken = '';
  let courseId = '';
  let courseTitle = '';
  let lessonId = '';
  let enrollmentId = '';
  let previewCourseId = '';
  let previewEnrollmentId = '';

  test.beforeAll(async () => {
    api = await apiRequest.newContext();

    const registration = await api.post(`${API}/api/auth/register`, {
      data: { email, password: PASSWORD, firstName: 'Student', lastName: 'Learning', role: 'STUDENT' },
    });
    expect(registration.status(), 'create an independent learner identity').toBe(201);
    const registrationBody = await registration.json();
    studentToken = registrationBody.data?.accessToken || registrationBody.accessToken;
    expect(studentToken).toBeTruthy();

    const otherRegistration = await api.post(`${API}/api/auth/register`, {
      data: { email: otherEmail, password: PASSWORD, firstName: 'Other', lastName: 'Learner', role: 'STUDENT' },
    });
    expect(otherRegistration.status()).toBe(201);
    const otherBody = await otherRegistration.json();
    otherStudentToken = otherBody.data?.accessToken || otherBody.accessToken;
    expect(otherStudentToken).toBeTruthy();

    courseTitle = `Student OS E2E Course ${stamp}`;
    const course = await prisma.course.create({
      data: {
        title: courseTitle,
        author: 'DentVision Academy Test',
        description: 'Synthetic learning lifecycle fixture',
        category: 'E2E',
        price: 0,
        format: 'course',
        meta: { audiences: ['ALL', 'PUBLIC'], certificateEnabled: true },
      },
    });
    courseId = course.id;

    const lesson = await prisma.lesson.create({
      data: { courseId, title: 'Verified lesson', content: 'Synthetic lesson body', order: 1, duration: 10 },
    });
    lessonId = lesson.id;

    const previewCourse = await prisma.course.create({
      data: {
        title: `Paid preview E2E Course ${stamp}`,
        author: 'DentVision Academy Test',
        description: 'Public program description with protected paid lesson content.',
        category: 'E2E',
        price: 25000,
        format: 'course',
        fileUrl: 'https://private.example.test/course-material.pdf',
        meta: { audiences: ['ALL', 'PUBLIC'], certificateEnabled: true },
      },
    });
    previewCourseId = previewCourse.id;
    await prisma.lesson.create({
      data: { courseId: previewCourseId, title: 'Paid private lesson', content: 'Protected lesson text', videoUrl: 'https://private.example.test/lesson.mp4', order: 1, duration: 20 },
    });
  });

  test.afterAll(async () => {
    await api?.dispose();
    if (enrollmentId) {
      await prisma.schoolEnrollment.deleteMany({ where: { id: enrollmentId } }).catch(() => {});
    }
    if (previewEnrollmentId) {
      await prisma.schoolEnrollment.deleteMany({ where: { id: previewEnrollmentId } }).catch(() => {});
    }
    if (courseId) {
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    if (previewCourseId) {
      await prisma.course.deleteMany({ where: { id: previewCourseId } }).catch(() => {});
    }
    await cleanupTestUser(email).catch(() => {});
    await cleanupTestUser(otherEmail).catch(() => {});
  });

  test('STUDENT-OS-000: public paid-course preview does not reveal paid lessons', async () => {
    const anonymousPreview = await api.get(`${API}/api/school/courses/${previewCourseId}`);
    expect(anonymousPreview.status()).toBe(200);
    const anonymousCourse = (await anonymousPreview.json()).data;
    expect(anonymousCourse.title).toBe(`Paid preview E2E Course ${stamp}`);
    expect(anonymousCourse.price).toBe(25000);
    expect(anonymousCourse.modules).toBeUndefined();
    expect(anonymousCourse.lessons).toBeUndefined();
    expect(anonymousCourse.fileUrl).toBeNull();

    const learnerPreview = await api.get(`${API}/api/school/courses/${previewCourseId}`, {
      headers: auth(studentToken),
    });
    expect(learnerPreview.status()).toBe(200);
    const learnerCourse = (await learnerPreview.json()).data;
    expect(learnerCourse.title).toBe(anonymousCourse.title);
    expect(learnerCourse.modules).toBeUndefined();
    expect(learnerCourse.fileUrl).toBeNull();

    const paidEntitlement = await prisma.schoolEnrollment.create({
      data: {
        id: `preview-entitlement-${stamp}`,
        userId: (await prisma.user.findUnique({ where: { email }, select: { id: true } }))!.id,
        courseId: previewCourseId,
        acquisitionType: 'purchase',
        accessStatus: 'active',
        paidAmountMinor: 2500000n,
        currency: 'KZT',
        paymentId: `synthetic-preview-payment-${stamp}`,
        purchaseConfirmedAt: new Date(),
      },
    });
    previewEnrollmentId = paidEntitlement.id;

    const entitledDetail = await api.get(`${API}/api/school/courses/${previewCourseId}`, {
      headers: auth(studentToken),
    });
    expect(entitledDetail.status()).toBe(200);
    const unlocked = (await entitledDetail.json()).data;
    expect(unlocked.modules?.[0]?.lessons?.[0]?.title).toBe('Paid private lesson');
    expect(unlocked.fileUrl).toBe('https://private.example.test/course-material.pdf');
  });

  test('STUDENT-OS-001: personal enrollment, protected progress, exam, certificate and privacy', async () => {
    const enrollmentResponse = await api.post(`${API}/api/school/enrollments`, {
      headers: auth(studentToken),
      data: { courseId },
    });
    expect(enrollmentResponse.status(), 'free course enrollment must create a personal entitlement').toBe(201);
    const enrollmentPayload = await enrollmentResponse.json();
    const enrollment = enrollmentPayload.data || enrollmentPayload;
    enrollmentId = enrollment.id;
    expect(enrollment.userId).toBeTruthy();
    expect(enrollment.courseId).toBe(courseId);
    expect(enrollment.acquisitionType).toBe('free');
    expect(enrollment.accessStatus).toBe('active');

    // Simulate a provider-confirmed money snapshot in the isolated E2E database.
    // This exercises JSON serialization without contacting a payment provider.
    await prisma.schoolEnrollment.update({
      where: { id: enrollmentId },
      data: {
        acquisitionType: 'purchase',
        paidAmountMinor: 2500000n,
        currency: 'KZT',
        paymentId: `synthetic-paid-${enrollmentId}`,
        purchaseConfirmedAt: new Date(),
      },
    });

    const myEnrollments = await api.get(`${API}/api/school/enrollments`, { headers: auth(studentToken) });
    expect(myEnrollments.status()).toBe(200);
    const enrollmentRows = (await myEnrollments.json()).data;
    const myRow = enrollmentRows.find((row: any) => row.id === enrollmentId);
    expect(myRow).toBeTruthy();
    expect(myRow.paidAmountMinor).toBe('2500000');
    expect(myRow.currency).toBe('KZT');
    expect(myRow.paymentId).toBe(`synthetic-paid-${enrollmentId}`);

    const forgedProgress = await api.patch(`${API}/api/school/enrollments/${enrollmentId}`, {
      headers: auth(studentToken),
      data: { progress: 100, completed: true },
    });
    expect(forgedProgress.status(), 'client cannot complete a course by setting progress/completed').toBe(400);

    const foreignLesson = await api.patch(`${API}/api/school/enrollments/${enrollmentId}`, {
      headers: auth(studentToken),
      data: { completedLessons: ['lesson-from-another-course'] },
    });
    expect(foreignLesson.status(), 'lesson IDs must belong to the enrolled course').toBe(400);

    const honestProgress = await api.patch(`${API}/api/school/enrollments/${enrollmentId}`, {
      headers: auth(studentToken),
      data: { progress: 100, completed: true, completedLessons: [lessonId] },
    });
    expect(honestProgress.status()).toBe(200);
    const progressPayload = await honestProgress.json();
    const savedProgress = progressPayload.data || progressPayload;
    expect(savedProgress.progress).toBe(99);
    expect(savedProgress.completed).toBe(false);
    expect(savedProgress.certificateUrl).toBeNull();

    const certificatesBeforeExam = await api.get(`${API}/api/school/certificates`, { headers: auth(studentToken) });
    expect(certificatesBeforeExam.status()).toBe(200);
    expect((await certificatesBeforeExam.json()).data.some((item: any) => item.courseId === courseId)).toBe(false);

    const examId = `exam-${courseId}`;
    const examResponse = await api.get(`${API}/api/school/lessons/${encodeURIComponent(examId)}/exam`, {
      headers: auth(studentToken),
    });
    expect(examResponse.status()).toBe(200);
    const examPayload = (await examResponse.json()).data;
    expect(examPayload.questions).toHaveLength(4);
    expect(examPayload.questions.every((question: any) => !('correctIndex' in question))).toBe(true);

    const examSubmission = await api.post(`${API}/api/school/lessons/${encodeURIComponent(examId)}/exam/submit`, {
      headers: auth(studentToken),
      data: { answers: { q1: 1, q2: 2, q3: 1, q4: 2 } },
    });
    expect(examSubmission.status()).toBe(200);
    const examResult = (await examSubmission.json()).data;
    expect(examResult.passed).toBe(true);
    expect(examResult.score).toBe(100);
    expect(examResult.attemptNumber).toBe(1);
    expect(examResult.certificate?.certificateNumber).toBeTruthy();
    expect(examResult.certificate?.verificationCode).toBeTruthy();

    const finalEnrollmentResponse = await api.get(`${API}/api/school/enrollments`, { headers: auth(studentToken) });
    const finalEnrollment = (await finalEnrollmentResponse.json()).data.find((row: any) => row.id === enrollmentId);
    expect(finalEnrollment.completed).toBe(true);
    expect(finalEnrollment.progress).toBe(100);

    const certificateResponse = await api.get(`${API}/api/school/certificates`, { headers: auth(studentToken) });
    const certificate = (await certificateResponse.json()).data.find((row: any) => row.courseId === courseId);
    expect(certificate).toBeTruthy();
    expect(certificate.certificateNumber).toBe(examResult.certificate.certificateNumber);

    const verification = await api.get(`${API}/api/school/certificates/verify/${encodeURIComponent(certificate.verificationCode)}`);
    expect(verification.status()).toBe(200);
    const verified = (await verification.json()).data;
    expect(verified).toMatchObject({
      certificateNumber: certificate.certificateNumber,
      courseTitle,
      status: 'issued',
    });
    expect(verified).not.toHaveProperty('userId');
    expect(verified).not.toHaveProperty('studentEmail');

    const attempts = await prisma.schoolAssessmentAttempt.findMany({ where: { enrollmentId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].passed).toBe(true);

    const otherLearnerEnrollments = await api.get(`${API}/api/school/enrollments`, {
      headers: auth(otherStudentToken),
    });
    expect((await otherLearnerEnrollments.json()).data.some((row: any) => row.id === enrollmentId)).toBe(false);

    const otherLearnerCannotReadEnrollment = await api.patch(`${API}/api/school/enrollments/${enrollmentId}`, {
      headers: auth(otherStudentToken),
      data: { completedLessons: [lessonId] },
    });
    expect(otherLearnerCannotReadEnrollment.status()).toBe(404);

    const otherLearnerCannotSubmitExam = await api.post(`${API}/api/school/lessons/${encodeURIComponent(examId)}/exam/submit`, {
      headers: auth(otherStudentToken),
      data: { answers: { q1: 1, q2: 2, q3: 1, q4: 2 } },
    });
    expect(otherLearnerCannotSubmitExam.status()).toBe(403);
  });
});
