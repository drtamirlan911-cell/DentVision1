import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };

function contextHeaders(context: 'PATIENT' | 'DOCTOR') {
  return { 'X-DentVision-Context': context, 'Content-Type': 'application/json' };
}

function courseAudiences(course: any): string[] {
  const raw = course?.meta?.audiences;
  return Array.isArray(raw) ? raw.map((v) => String(v).toUpperCase()) : ['PROFESSIONAL'];
}

function productAudiences(product: any): string[] {
  const raw = Array.isArray(product?.tags)
    ? product.tags
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((v: string) => v.trim().toUpperCase())
        .filter((v: string) => v.startsWith('AUDIENCE:'))
        .map((v: string) => v.slice('AUDIENCE:'.length))
    : [];
  return raw.length ? raw : ['PROFESSIONAL'];
}

function isProfessional(audiences: string[]) {
  return audiences.some((a) => ['PROFESSIONAL', 'DOCTOR', 'DENTAL_STUDENT', 'ASSISTANT', 'LAB', 'DIAGNOSTIC', 'SELLER'].includes(a));
}

async function loginOwner(api: APIRequestContext) {
  const res = await api.post(`${BASE_URL}/api/auth/login`, { data: OWNER });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data?.accessToken || body.accessToken;
}

test.describe('Context-bound Academy and Marketplace catalog access', () => {
  let api: APIRequestContext;
  let ownerToken = '';

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    ownerToken = await loginOwner(api);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('patient context cannot receive professional Academy courses and cannot open one directly', async () => {
    const doctorList = await api.get(`${BASE_URL}/api/school/courses`, {
      headers: { Authorization: `Bearer ${ownerToken}`, ...contextHeaders('DOCTOR') },
    });
    expect(doctorList.status()).toBe(200);
    const doctorBody = await doctorList.json();
    const doctorCourses = Array.isArray(doctorBody.data) ? doctorBody.data : doctorBody.data?.courses || [];
    const professionalCourse = doctorCourses.find((course: any) => isProfessional(courseAudiences(course)));

    const patientList = await api.get(`${BASE_URL}/api/school/courses`, {
      headers: contextHeaders('PATIENT'),
    });
    expect(patientList.status()).toBe(200);
    const patientBody = await patientList.json();
    const patientCourses = Array.isArray(patientBody.data) ? patientBody.data : patientBody.data?.courses || [];
    expect(patientCourses.every((course: any) => !isProfessional(courseAudiences(course)))).toBe(true);

    if (professionalCourse?.id) {
      const patientDetail = await api.get(`${BASE_URL}/api/school/courses/${professionalCourse.id}`, {
        headers: contextHeaders('PATIENT'),
      });
      expect(patientDetail.status()).toBe(404);

      const doctorDetail = await api.get(`${BASE_URL}/api/school/courses/${professionalCourse.id}`, {
        headers: { Authorization: `Bearer ${ownerToken}`, ...contextHeaders('DOCTOR') },
      });
      expect(doctorDetail.status()).toBe(200);
    }
  });

  test('the same Person cannot inherit Doctor Academy access while explicitly in Patient context', async () => {
    const doctorList = await api.get(`${BASE_URL}/api/school/courses`, {
      headers: { Authorization: `Bearer ${ownerToken}`, ...contextHeaders('DOCTOR') },
    });
    const doctorBody = await doctorList.json();
    const doctorCourses = Array.isArray(doctorBody.data) ? doctorBody.data : doctorBody.data?.courses || [];
    const professionalCourse = doctorCourses.find((course: any) => isProfessional(courseAudiences(course)));
    test.skip(!professionalCourse?.id, 'No professional seeded course available for positive/negative detail assertion');

    const patientDetail = await api.get(`${BASE_URL}/api/school/courses/${professionalCourse.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}`, ...contextHeaders('PATIENT') },
    });
    expect(patientDetail.status()).toBe(404);
  });

  test('patient context cannot receive professional Marketplace products and cannot open one directly', async () => {
    const doctorList = await api.get(`${BASE_URL}/api/shop/products`, {
      headers: contextHeaders('DOCTOR'),
    });
    expect(doctorList.status()).toBe(200);
    const doctorBody = await doctorList.json();
    const doctorProducts = Array.isArray(doctorBody.data) ? doctorBody.data : doctorBody.data?.products || [];
    const professionalProduct = doctorProducts.find((product: any) => isProfessional(productAudiences(product)));

    const patientList = await api.get(`${BASE_URL}/api/shop/products`, {
      headers: contextHeaders('PATIENT'),
    });
    expect(patientList.status()).toBe(200);
    const patientBody = await patientList.json();
    const patientProducts = Array.isArray(patientBody.data) ? patientBody.data : patientBody.data?.products || [];
    expect(patientProducts.every((product: any) => !isProfessional(productAudiences(product)))).toBe(true);

    if (professionalProduct?.id) {
      const patientDetail = await api.get(`${BASE_URL}/api/shop/products/${professionalProduct.id}`, {
        headers: contextHeaders('PATIENT'),
      });
      expect(patientDetail.status()).toBe(404);

      const doctorDetail = await api.get(`${BASE_URL}/api/shop/products/${professionalProduct.id}`, {
        headers: contextHeaders('DOCTOR'),
      });
      expect(doctorDetail.status()).toBe(200);
    }
  });
});
