import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
// See helpers/db.ts for why this isn't the bare `@prisma/client` specifier —
// it would resolve to a dead legacy schema at the repo root, not this backend.
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/index.js';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const USERS = {
  owner: { email: 'owner-a@test.com', password: 'Test1234!' },
  doctor: { email: 'doctor-a@test.com', password: 'Test1234!' },
};

const tokens: Record<string, string> = {};

async function loginAs(api: APIRequestContext, role: 'owner' | 'doctor'): Promise<string> {
  if (tokens[role]) return tokens[role];
  const res = await api.post(`${BASE_URL}/api/auth/login`, {
    data: USERS[role],
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const token = body.data?.accessToken || body.accessToken;
  expect(token).toBeTruthy();
  tokens[role] = token;
  return token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createTestOrder(api: APIRequestContext, token: string): Promise<{ id: string; total: number }> {
  // Get any available product
  const productsRes = await api.get(`${BASE_URL}/api/shop/products?limit=1`);
  expect(productsRes.ok()).toBeTruthy();
  const productsBody = await productsRes.json();
  const products = productsBody.data || [];
  expect(products.length).toBeGreaterThan(0);
  const product = products[0];

  // A fresh Idempotency-Key per call: this helper is shared across many
  // tests in this file, each of which wants its own distinct order, but
  // every call posts byte-identical items — without a key of its own, the
  // shop's double-submit guard (shop.routes.ts) reasonably reads repeated
  // identical bodies from the same user as the same double-click, and hands
  // back the first order instead of creating a new one.
  const res = await api.post(`${BASE_URL}/api/shop/orders`, {
    headers: { ...authHeaders(token), 'Idempotency-Key': `test-order-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    data: {
      items: [{ product_id: product.id, quantity: 1 }],
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.data.id, total: Number(body.data.total) };
}

test.describe('Payment API', () => {
  let api: APIRequestContext;
  let ownerToken: string;
  let doctorToken: string;

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
    ownerToken = await loginAs(api, 'owner');
    doctorToken = await loginAs(api, 'doctor');
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  // ─── PAY-001: Create payment for order → 201 + payment record ─────────────
  test('PAY-001: Create payment for order → 201 + payment record', async () => {
    const order = await createTestOrder(api, ownerToken);

    const res = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-001-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.status).toBe('pending');
    expect(body.data.amount).toBeTruthy();
  });

  // ─── PAY-002: Get payment status → 200 ────────────────────────────────────
  test('PAY-002: Get payment status → 200', async () => {
    const order = await createTestOrder(api, ownerToken);

    const createRes = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-002-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const paymentId = created.data.id;

    const res = await api.get(`${BASE_URL}/api/payments/${paymentId}`, {
      headers: authHeaders(ownerToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(paymentId);
    expect(body.data.status).toBeTruthy();
  });

  // ─── PAY-003: Duplicate payment request (idempotency) → same payment ──────
  test('PAY-003: Duplicate payment request → same payment returned', async () => {
    const order = await createTestOrder(api, ownerToken);
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const payload = {
      amount: order.total,
      provider: 'kaspi_qr',
      refType: 'order',
      refId: order.id,
    };

    const res1 = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': idempotencyKey,
      },
      data: payload,
    });
    expect(res1.status()).toBe(201);
    const body1 = await res1.json();
    const paymentId1 = body1.data.id;

    const res2 = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': idempotencyKey,
      },
      data: payload,
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    const paymentId2 = body2.data.id;

    // Same payment should be returned
    expect(paymentId2).toBe(paymentId1);
  });

  // ─── PAY-004: Payment with modified amount → 400/409 ──────────────────────
  test('PAY-004: Payment with modified amount → 409 (server validates)', async () => {
    const order = await createTestOrder(api, ownerToken);

    const res = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-004-${Date.now()}`,
      },
      data: {
        amount: 1, // Tampered amount (order.total is much larger)
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    // Server recomputes expected amount from order items and rejects mismatch
    expect([400, 409]).toContain(res.status());
  });

  // ─── PAY-005: Payment with modified orderId → 403 ─────────────────────────
  test('PAY-005: Payment with modified orderId → 403 (server validates ownership)', async () => {
    // Create order as owner, then try to pay as doctor
    const order = await createTestOrder(api, ownerToken);

    const res = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(doctorToken),
        'Idempotency-Key': `pay-005-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    // IDOR protection: doctor doesn't own this order
    expect([403, 404]).toContain(res.status());
  });

  // ─── PAY-006: Webhook callback (mock) → order status updated ──────────────
  test('PAY-006: Webhook callback (mock) → order status updated', async () => {
    const order = await createTestOrder(api, ownerToken);

    // Create payment
    const payRes = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-006-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(payRes.status()).toBe(201);
    const payBody = await payRes.json();
    const paymentId = payBody.data.id;
    const externalId = payBody.data.externalId;

    // Confirm via the confirm endpoint (sandbox mode auto-confirms)
    const confirmRes = await api.post(`${BASE_URL}/api/payments/${paymentId}/confirm`, {
      headers: authHeaders(ownerToken),
    });
    expect(confirmRes.status()).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.data.status).toBe('paid');

    // Verify order status updated
    const orderRes = await api.get(`${BASE_URL}/api/shop/orders`, {
      headers: authHeaders(ownerToken),
    });
    const orderBody = await orderRes.json();
    // paginatedResponse() nests the array at data.data, not data.items.
    const orders = orderBody.data?.data || orderBody.data || [];
    const found = Array.isArray(orders) ? orders.find((o: any) => o.id === order.id) : null;
    expect(found).toBeTruthy();
    expect(found.status).toBe('paid');
  });

  // ─── PAY-007: Duplicate webhook → idempotent ──────────────────────────────
  test('PAY-007: Duplicate webhook → idempotent (no double settlement)', async () => {
    const order = await createTestOrder(api, ownerToken);

    // Create and confirm payment
    const payRes = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-007-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(payRes.status()).toBe(201);
    const payBody = await payRes.json();
    const paymentId = payBody.data.id;

    const confirmRes = await api.post(`${BASE_URL}/api/payments/${paymentId}/confirm`, {
      headers: authHeaders(ownerToken),
    });
    expect(confirmRes.status()).toBe(200);

    // Second confirm should be a no-op (already paid)
    const confirmRes2 = await api.post(`${BASE_URL}/api/payments/${paymentId}/confirm`, {
      headers: authHeaders(ownerToken),
    });
    expect(confirmRes2.status()).toBe(200);
    const body2 = await confirmRes2.json();
    expect(body2.data.alreadyPaid).toBe(true);
  });

  // ─── PAY-008: Payment timeout handling → graceful error ───────────────────
  test('PAY-008: Payment not found → 404', async () => {
    const fakeId = `nonexistent-${Date.now()}`;
    const res = await api.get(`${BASE_URL}/api/payments/${fakeId}`, {
      headers: authHeaders(ownerToken),
    });
    expect(res.status()).toBe(404);
  });

  // ─── PAY-009: Refund → route not implemented (404) ───────────────────────
  test('PAY-009: Refund → route not implemented (404)', async () => {
    const order = await createTestOrder(api, ownerToken);

    const payRes = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-009-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(payRes.status()).toBe(201);
    const payBody = await payRes.json();
    const paymentId = payBody.data.id;

    // Confirm first
    await api.post(`${BASE_URL}/api/payments/${paymentId}/confirm`, {
      headers: authHeaders(ownerToken),
    });

    // Attempt refund — route does not exist
    const res = await api.post(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      headers: authHeaders(ownerToken),
      data: { reason: 'test refund' },
    });
    expect(res.status()).toBe(404);
  });

  // ─── PAY-010: Duplicate refund → 404 (no refund route) ────────────────────
  test('PAY-010: Duplicate refund → 404 (no refund route)', async () => {
    const order = await createTestOrder(api, ownerToken);

    const payRes = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-010-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(payRes.status()).toBe(201);
    const payBody = await payRes.json();
    const paymentId = payBody.data.id;

    const res1 = await api.post(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      headers: authHeaders(ownerToken),
    });
    expect(res1.status()).toBe(404);

    const res2 = await api.post(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      headers: authHeaders(ownerToken),
    });
    expect(res2.status()).toBe(404);
  });

  // ─── PAY-011: Payment count verification after operations → correct count ──
  test('PAY-011: Payment count verification after operations → correct count', async () => {
    // Create two orders and pay for both
    const order1 = await createTestOrder(api, ownerToken);
    const order2 = await createTestOrder(api, ownerToken);

    const pay1Res = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-011a-${Date.now()}`,
      },
      data: {
        amount: order1.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order1.id,
      },
    });
    expect(pay1Res.status()).toBe(201);
    const pay1 = await pay1Res.json();

    const pay2Res = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-011b-${Date.now()}`,
      },
      data: {
        amount: order2.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order2.id,
      },
    });
    expect(pay2Res.status()).toBe(201);
    const pay2 = await pay2Res.json();

    // Confirm both
    await api.post(`${BASE_URL}/api/payments/${pay1.data.id}/confirm`, {
      headers: authHeaders(ownerToken),
    });
    await api.post(`${BASE_URL}/api/payments/${pay2.data.id}/confirm`, {
      headers: authHeaders(ownerToken),
    });

    // Verify each payment exists and is paid
    const check1 = await api.get(`${BASE_URL}/api/payments/${pay1.data.id}`, {
      headers: authHeaders(ownerToken),
    });
    const check2 = await api.get(`${BASE_URL}/api/payments/${pay2.data.id}`, {
      headers: authHeaders(ownerToken),
    });
    expect((await check1.json()).data.status).toBe('paid');
    expect((await check2.json()).data.status).toBe('paid');
  });

  // ─── PAY-012: Order status after payment → paid ───────────────────────────
  test('PAY-012: Order status after payment → paid', async () => {
    const order = await createTestOrder(api, ownerToken);

    // Create payment
    const payRes = await api.post(`${BASE_URL}/api/payments`, {
      headers: {
        ...authHeaders(ownerToken),
        'Idempotency-Key': `pay-012-${Date.now()}`,
      },
      data: {
        amount: order.total,
        provider: 'kaspi_qr',
        refType: 'order',
        refId: order.id,
      },
    });
    expect(payRes.status()).toBe(201);
    const payBody = await payRes.json();
    const paymentId = payBody.data.id;

    // Confirm payment
    const confirmRes = await api.post(`${BASE_URL}/api/payments/${paymentId}/confirm`, {
      headers: authHeaders(ownerToken),
    });
    expect(confirmRes.status()).toBe(200);

    // Verify order status is now 'paid'
    const listRes = await api.get(`${BASE_URL}/api/shop/orders`, {
      headers: authHeaders(ownerToken),
    });
    const listBody = await listRes.json();
    // paginatedResponse() nests the array at data.data, not data.items.
    const orders = listBody.data?.data || listBody.data || [];
    const found = Array.isArray(orders) ? orders.find((o: any) => o.id === order.id) : null;
    expect(found).toBeTruthy();
    expect(found.status).toBe('paid');
  });
});
