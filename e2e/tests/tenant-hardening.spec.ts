import { test, expect, APIRequestContext } from '@playwright/test';
import { makeIin } from '../helpers/iin';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const OWNER_A = { email: 'owner-a@test.com', password: 'Test1234!' };
const OWNER_B = { email: 'owner-b@test.com', password: 'Test1234!' };
const DOCTOR_A = { email: 'doctor-a@test.com', password: 'Test1234!' };

async function login(api: APIRequestContext, credentials: { email: string; password: string }) {
  const res = await api.post('/api/auth/login', { data: credentials });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body.data || body;
  const token = data.accessToken || data.tokens?.accessToken;
  expect(token).toBeTruthy();
  return token as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function me(api: APIRequestContext, token: string) {
  const res = await api.get('/api/auth/me', { headers: auth(token) });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.data || body;
}

async function createPatient(api: APIRequestContext, token: string) {
  const res = await api.post('/api/patients', {
    headers: auth(token),
    data: {
      iin: makeIin(),
      firstName: 'Hardening',
      lastName: 'TenantTest',
      phone: '+77000000004',
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const patient = body.data || body;
  expect(patient.id).toBeTruthy();
  return patient.id as string;
}

async function createInvoice(api: APIRequestContext, token: string, patientId: string) {
  const res = await api.post('/api/billing/invoices', {
    headers: auth(token),
    data: { patientId, amount: 61000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const invoice = body.data || body;
  expect(invoice.id).toBeTruthy();
  return invoice.id as string;
}

async function findProduct(api: APIRequestContext) {
  const res = await api.get('/api/shop/products?limit=1');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const products = body.data || [];
  expect(products.length).toBeGreaterThan(0);
  expect(products[0].id).toBeTruthy();
  return products[0].id as string;
}

test.describe('Strict Tenant Hardening', () => {
  let tokenA: string;
  let tokenB: string;
  let doctorAId: string;

  test.beforeAll(async ({ request }) => {
    tokenA = await login(request, OWNER_A);
    tokenB = await login(request, OWNER_B);
    const doctorToken = await login(request, DOCTOR_A);
    const doctor = await me(request, doctorToken);
    doctorAId = doctor.id || doctor.user?.id;
    expect(doctorAId).toBeTruthy();
  });

  test('HARDEN-001: caller cannot forge clinicId when creating a patient', async ({ request }) => {
    const identityA = await me(request, tokenA);
    const identityB = await me(request, tokenB);
    const clinicAId = identityA.clinicId || identityA.user?.clinicId;
    const clinicBId = identityB.clinicId || identityB.user?.clinicId;

    expect(clinicAId).toBeTruthy();
    expect(clinicBId).toBeTruthy();
    expect(clinicAId).not.toBe(clinicBId);

    const res = await request.post('/api/patients', {
      headers: auth(tokenB),
      data: {
        clinicId: clinicAId,
        iin: makeIin(),
        firstName: 'Forged',
        lastName: 'Clinic',
        phone: '+77000000005',
      },
    });

    // A tenant must never be selected from caller-controlled request data.
    expect(res.ok()).toBeFalsy();
  });

  test('HARDEN-002: appointment creation rejects a doctor from another clinic', async ({ request }) => {
    const patientB = await createPatient(request, tokenB);

    const res = await request.post('/api/appointments', {
      headers: auth(tokenB),
      data: {
        patientId: patientB,
        doctorId: doctorAId,
        date: new Date().toISOString().slice(0, 10),
        time: '15:00',
        duration: 30,
      },
    });

    expect([400, 403, 404]).toContain(res.status());
  });

  test('HARDEN-003: invoice payment cannot be triggered from another clinic', async ({ request }) => {
    const patientA = await createPatient(request, tokenA);
    const invoiceA = await createInvoice(request, tokenA, patientA);

    const res = await request.post(`/api/billing/invoices/${invoiceA}/pay`, {
      headers: auth(tokenB),
      data: { amount: 1000 },
    });

    expect([403, 404]).toContain(res.status());
  });

  test('HARDEN-004: shop order is scoped to the authenticated account/tenant', async ({ request }) => {
    const productId = await findProduct(request);
    const createRes = await request.post('/api/shop/orders', {
      headers: { ...auth(tokenA), 'Idempotency-Key': `hardening-${Date.now()}-${Math.random()}` },
      data: { items: [{ product_id: productId, quantity: 1 }] },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const orderId = (created.data || created).id;
    expect(orderId).toBeTruthy();

    const getRes = await request.get(`/api/shop/orders/${orderId}`, {
      headers: auth(tokenB),
    });

    expect([403, 404]).toContain(getRes.status());
  });
});
