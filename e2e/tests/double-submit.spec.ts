import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { payload as apiPayload } from '../helpers/api';
import { prisma, cleanupTestUser } from '../helpers/db';
import { makeIin } from '../helpers/iin';

// The backend loads this the same way (`dotenv/config` in
// dentvision-backend/src/config.ts) — read straight from the same .env
// file rather than adding a dotenv dependency just for one test to mirror it.
function readBackendEnv(key: string): string | undefined {
  try {
    const text = readFileSync(new URL('../../dentvision-backend/.env', import.meta.url), 'utf8');
    const line = text.split('\n').find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

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

// `POST /shop/orders` validates every item's productId against real rows
// (shop.routes.ts's handler: 400 "Товар не найден" for anything it can't
// find) — a fabricated id like 'test-product' fails that check on both
// concurrent requests before any race is ever exercised. Mirrors
// marketplace.spec.ts's own findExistingProduct helper.
async function findExistingProduct(api: APIRequestContext): Promise<{ id: string; price: number }> {
  const res = await api.get(`${BASE_URL}/api/shop/products?limit=1`);
  // apiPayload already unwraps the `{ok, data}` envelope, and GET /products'
  // `data` is the array itself (unlike list endpoints going through
  // paginatedResponse) — no second `.data` to peel off here.
  const products = await apiPayload(res);
  expect(Array.isArray(products) && products.length).toBeGreaterThan(0);
  return { id: products[0].id, price: Number(products[0].price) };
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
      iin: makeIin(),
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
    const product = await findExistingProduct(api);
    // A per-test-run marker in the body (rather than a bare `{productId,
    // quantity}`) keeps this test's idempotency key from colliding with a
    // prior run's — otherwise a rerun would hit the *previous* run's
    // already-completed key and short-circuit to `exists` before the race
    // below is exercised at all.
    const payload = {
      items: [{ productId: product.id, quantity: 1 }],
      notes: `double-003-${Date.now()}`,
    };
    // The handler ignores any client-supplied `total` (`void total;` in
    // shop.routes.ts) and computes it itself: goodsTotal + a flat delivery
    // fee under the free-delivery threshold. Matching that here — rather
    // than asserting against a client-invented number — is what makes this
    // assertion mean anything.
    const expectedTotal = product.price + (product.price >= 50000 ? 0 : 2500);
    const startedAt = new Date();

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/shop/orders`, { headers: auth(ownerToken), data: payload }),
      api.post(`${BASE_URL}/api/shop/orders`, { headers: auth(ownerToken), data: payload }),
    ]);

    expect([200, 201, 409]).toContain(res1.status());
    expect([200, 201, 409]).toContain(res2.status());

    // Scoped to orders created by this run (`createdAt: {gte: startedAt}`),
    // not just "the last 5" — otherwise duplicate rows left behind by an
    // earlier, pre-idempotency-fix run of this same test would still be
    // there to inflate the count regardless of whether today's code is
    // actually deduplicating.
    const orders = await prisma.order.findMany({
      where: {
        userId: (await prisma.user.findFirst({ where: { email: OWNER.email } }))?.id,
        createdAt: { gte: startedAt },
      },
      orderBy: { createdAt: 'desc' },
    });
    const matching = orders.filter((o) => o.total === expectedTotal);
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
    // `/api/webhooks/payment` isn't a route at all — the real Kaspi callback
    // is `POST /api/payments/callbacks/kaspi`, guarded by an HMAC signature
    // over `${externalId}:${status}` keyed on KASPI_CALLBACK_SECRET
    // (kaspi.provider.ts's verifyKaspiCallbackAuth — unsigned callbacks are
    // rejected outright, by design). Without the secret this can't be
    // exercised meaningfully; skip rather than fake a check that isn't real.
    const secret = readBackendEnv('KASPI_CALLBACK_SECRET');
    if (!secret) return test.skip();

    const product = await findExistingProduct(api);
    const orderRes = await api.post(`${BASE_URL}/api/shop/orders`, {
      headers: auth(ownerToken),
      // No payment_method → defaults to 'kaspi' (payments.routes.ts's
      // shop.routes.ts handler), which takes the online-pay branch and
      // creates a real Payment row with an externalId to call back on.
      data: { items: [{ productId: product.id, quantity: 1 }], notes: `double-005-${Date.now()}` },
    });
    expect(orderRes.status()).toBe(201);
    const order = await apiPayload(orderRes);
    const externalId = order.payment?.externalId;
    if (!externalId) return test.skip();

    const status = 'paid';
    const signature = createHmac('sha256', secret).update(`${externalId}:${status}`).digest('hex');
    const webhookPayload = { externalId, status };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/payments/callbacks/kaspi`, {
        headers: { 'Content-Type': 'application/json', 'x-kaspi-signature': signature },
        data: webhookPayload,
      }),
      api.post(`${BASE_URL}/api/payments/callbacks/kaspi`, {
        headers: { 'Content-Type': 'application/json', 'x-kaspi-signature': signature },
        data: webhookPayload,
      }),
    ]);

    expect(res1.status()).toBe(200);
    expect(res2.status()).toBe(200);

    // claimPaymentForSettlement (payments.routes.ts) lets only one concurrent
    // callback win the pending→paid transition — that's what this proves,
    // not just that both requests returned success.
    const body1 = await apiPayload(res1);
    const body2 = await apiPayload(res2);
    const settledCount = [body1.settled, body2.settled].filter(Boolean).length;
    expect(settledCount).toBe(1);

    const payment = await prisma.payment.findFirst({ where: { externalId } });
    expect(payment?.status).toBe('paid');
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

  test('DOUBLE-007: Double register same email → only 1 user created', async () => {
    // The `existing` check in /register is check-then-act, not a transaction:
    // a genuinely concurrent duplicate can pass it twice and race to `create`.
    // Sequential re-registration already returns 409 (AUTH-005); this proves
    // the race itself doesn't leave a duplicate user or surface a 500 for the
    // loser — the unique index on User.email plus the P2002 handler in
    // auth.routes.ts's catch block are what this test actually exercises.
    const email = `double-register-${Date.now()}@test.com`;
    const payload = { email, password: 'Test1234!', firstName: 'Double', lastName: 'Register' };

    const [res1, res2] = await Promise.all([
      api.post(`${BASE_URL}/api/auth/register`, { data: payload }),
      api.post(`${BASE_URL}/api/auth/register`, { data: payload }),
    ]);

    expect([201, 409]).toContain(res1.status());
    expect([201, 409]).toContain(res2.status());
    expect(res1.status()).not.toBe(res2.status());

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);

    await cleanupTestUser(email);
  });
});
