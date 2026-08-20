import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { payload as apiPayload } from '../helpers/api';
import { prisma } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };
const DOCTOR = { email: 'doctor-a@test.com', password: 'Test1234!' };

let ownerToken = '';
let doctorToken = '';
let clinicId = '';

async function loginAs(api: APIRequestContext, email: string, password: string) {
  const res = await api.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });
  const body = await apiPayload(res);
  return body.accessToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function getClinicId(api: APIRequestContext, token: string) {
  const res = await api.get(`${BASE_URL}/api/auth/my-clinics`, {
    headers: auth(token),
  });
  const body = await apiPayload(res);
  const clinics = body.data || body;
  return Array.isArray(clinics) ? clinics[0]?.id : clinics.id;
}

test.describe('Double Submit / Race Condition Tests', () => {
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
    ownerToken = await loginAs(api, OWNER.email, OWNER.password);
    doctorToken = await loginAs(api, DOCTOR.email, DOCTOR.password);
    clinicId = await getClinicId(api, ownerToken);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('DOUBLE-001: Double create patient → only 1 patient created', async () => {
    const ts = Date.now();
    const payload = {
      firstName: 'Double',
      lastName: `Patient ${ts}`,
      phone: `+7700${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: `double-patient-${ts}@test.com`,
      birthDate: '1990-01-01',
      gender: 'MALE',
    };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/patients`, { headers: auth(ownerToken), data: payload }),
      api.post(`${BASE_URL}/api/patients`, { headers: auth(ownerToken), data: payload }),
    ]);

    expect([200, 201, 409]).toContain(res1.status());
    expect([200, 201, 409]).toContain(res2.status());

    const count = await prisma.patient.count({
      where: { email: payload.email },
    });
    expect(count).toBe(1);
  });

  test('DOUBLE-002: Double create appointment → only 1 appointment', async () => {
    if (!doctorToken) return test.skip();

    const patient = await prisma.patient.findFirst({
      where: { clinicId },
    });
    if (!patient) return test.skip();

    const now = new Date();
    const payload = {
      patientId: patient.id,
      doctorId: (await prisma.clinicMember.findFirst({ where: { clinicId, role: 'DOCTOR' } }))?.userId,
      date: now.toISOString().split('T')[0],
      time: '14:00',
      duration: 30,
    };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/appointments`, { headers: auth(ownerToken), data: payload }),
      api.post(`${BASE_URL}/api/appointments`, { headers: auth(ownerToken), data: payload }),
    ]);

    expect([200, 201, 409]).toContain(res1.status());
    expect([200, 201, 409]).toContain(res2.status());

    const count = await prisma.appointment.count({
      where: {
        clinicId,
        patientId: patient.id,
        date: new Date(payload.date),
        time: payload.time,
      },
    });
    expect(count).toBe(1);
  });

  test('DOUBLE-003: Double create order → only 1 order', async () => {
    const ts = Date.now();
    const payload = {
      items: [{ productId: 'test-product', quantity: 1, price: 5000 }],
      total: 5000,
    };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/shop/orders`, { headers: auth(ownerToken), data: payload }),
      api.post(`${BASE_URL}/api/shop/orders`, { headers: auth(ownerToken), data: payload }),
    ]);

    expect([200, 201, 409]).toContain(res1.status());
    expect([200, 201, 409]).toContain(res2.status());

    const orders = await prisma.order.findMany({
      where: { userId: (await prisma.user.findFirst({ where: { email: OWNER.email } }))?.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const matching = orders.filter((o) => o.total === payload.total);
    expect(matching.length).toBeLessThanOrEqual(1);
  });

  test('DOUBLE-004: Double payment → idempotent (1 payment)', async () => {
    const user = await prisma.user.findFirst({ where: { email: OWNER.email } });
    if (!user) return test.skip();

    const order = await prisma.order.findFirst({
      where: { userId: user.id, paymentStatus: 'PENDING' },
    });
    if (!order) return test.skip();

    const payload = { orderId: order.id, method: 'CASH', amount: order.total };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/payments`, { headers: auth(ownerToken), data: payload }),
      api.post(`${BASE_URL}/api/payments`, { headers: auth(ownerToken), data: payload }),
    ]);

    expect([200, 201, 409]).toContain(res1.status());
    expect([200, 201, 409]).toContain(res2.status());

    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
    });
    expect(payments.length).toBe(1);
  });

  test('DOUBLE-005: Double webhook → idempotent (no double settlement)', async () => {
    const user = await prisma.user.findFirst({ where: { email: OWNER.email } });
    if (!user) return test.skip();

    const order = await prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) return test.skip();

    const webhookPayload = {
      event: 'payment.success',
      orderId: order.id,
      transactionId: `txn-${Date.now()}`,
    };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/webhooks/payment`, {
        headers: { 'Content-Type': 'application/json' },
        data: webhookPayload,
      }),
      api.post(`${BASE_URL}/api/webhooks/payment`, {
        headers: { 'Content-Type': 'application/json' },
        data: webhookPayload,
      }),
    ]);

    expect([200, 201, 409]).toContain(res1.status());
    expect([200, 201, 409]).toContain(res2.status());

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    if (updatedOrder) {
      expect(updatedOrder.paymentStatus).not.toBe('OVERPAID');
    }
  });

  test('DOUBLE-006: Double refund → only 1 refund', async () => {
    const user = await prisma.user.findFirst({ where: { email: OWNER.email } });
    if (!user) return test.skip();

    const order = await prisma.order.findFirst({
      where: { userId: user.id, paymentStatus: 'paid' },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) return test.skip();

    const payload = { orderId: order.id, reason: 'Test double refund' };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/payments/refund`, { headers: auth(ownerToken), data: payload }),
      api.post(`${BASE_URL}/api/payments/refund`, { headers: auth(ownerToken), data: payload }),
    ]);

    expect([200, 201, 409, 422]).toContain(res1.status());
    expect([200, 201, 409, 422]).toContain(res2.status());

    const payments = await prisma.payment.findMany({
      where: { orderId: order.id, method: 'REFUND' },
    });
    expect(payments.length).toBeLessThanOrEqual(1);
  });
});
