import { test, expect, APIRequestContext } from '@playwright/test';
import { makeIin } from '../helpers/iin';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const USER_A = { email: 'owner-a@test.com', password: 'Test1234!' };
const USER_B = { email: 'owner-b@test.com', password: 'Test1234!' };
const DOCTOR_A = { email: 'doctor-a@test.com', password: 'Test1234!' };

let tokenA: string;
let tokenB: string;
let doctorAId: string;

async function login(ctx: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body.data || body;
  return data.accessToken || data.tokens?.accessToken;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createPatient(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/patients', {
    headers: headers(token),
    data: { iin: makeIin(), firstName: 'IDOR', lastName: 'TestPatient', phone: '+77000000002' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createAppointment(ctx: APIRequestContext, token: string, patientId: string, doctorId: string): Promise<string> {
  const res = await ctx.post('/api/appointments', {
    headers: headers(token),
    data: { patientId, doctorId, date: new Date().toISOString().slice(0, 10), time: '14:00', duration: 30 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createInvoice(ctx: APIRequestContext, token: string, patientId: string): Promise<string> {
  const res = await ctx.post('/api/billing/invoices', {
    headers: headers(token),
    data: { patientId, amount: 75000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createInventoryItem(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/inventory', {
    headers: headers(token),
    data: { name: 'IDOR InvItem', quantity: 5, price: 2000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createDocument(ctx: APIRequestContext, token: string, patientId?: string): Promise<string> {
  const res = await ctx.post('/api/files/documents', {
    headers: headers(token),
    data: { docType: 'consent', title: 'IDOR Doc', content: 'idor test', patientId },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createTreatmentPlan(ctx: APIRequestContext, token: string, patientId: string): Promise<string> {
  const res = await ctx.post('/api/crm/treatment-plans', {
    headers: headers(token),
    data: { patientId, title: 'IDOR Plan', status: 'draft' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createLabOrder(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/lab-orders', {
    headers: headers(token),
    data: { patientName: 'IDOR Lab', labType: 'bridge', notes: 'idor test' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createExpense(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/crm/expenses', {
    headers: headers(token),
    data: { amount: 5000, category: 'supplies', description: 'IDOR expense' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createOrder(ctx: APIRequestContext, token: string): Promise<string> {
  const productsRes = await ctx.get('/api/shop/products?limit=1');
  expect(productsRes.ok()).toBeTruthy();
  const productsBody = await productsRes.json();
  const products = Array.isArray(productsBody.data) ? productsBody.data : [];
  expect(products.length).toBeGreaterThan(0);
  const product = products[0];
  const res = await ctx.post('/api/shop/orders', {
    headers: { ...headers(token), 'Idempotency-Key': `idor-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    data: { items: [{ product_id: product.id, quantity: 1 }] },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

test.describe('IDOR Protection', () => {
  test.beforeAll(async ({ request }) => {
    tokenA = await login(request, USER_A.email, USER_A.password);
    tokenB = await login(request, USER_B.email, USER_B.password);
    const doctorToken = await login(request, DOCTOR_A.email, DOCTOR_A.password);
    const meRes = await request.get('/api/auth/me', { headers: headers(doctorToken) });
    expect(meRes.ok()).toBeTruthy();
    const meBody = await meRes.json();
    doctorAId = (meBody.data || meBody).id || (meBody.data || meBody).user?.id;
    expect(doctorAId).toBeTruthy();
  });

  test('IDOR-001: Access other clinic patient by ID', async ({ request }) => {
    const patientId = await createPatient(request, tokenA);
    expect([403, 404]).toContain((await request.get(`/api/patients/${patientId}`, { headers: headers(tokenB) })).status());
    expect([403, 404]).toContain((await request.patch(`/api/patients/${patientId}`, { headers: headers(tokenB), data: { firstName: 'Hacked' } })).status());
    expect([403, 404]).toContain((await request.delete(`/api/patients/${patientId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-002: Access other clinic appointment by ID', async ({ request }) => {
    const apptId = await createAppointment(request, tokenA, await createPatient(request, tokenA), doctorAId);
    expect([403, 404]).toContain((await request.patch(`/api/appointments/${apptId}/status`, { headers: headers(tokenB), data: { status: 'completed' } })).status());
    expect([403, 404]).toContain((await request.delete(`/api/appointments/${apptId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-003: Access other clinic invoice by ID', async ({ request }) => {
    const invoiceId = await createInvoice(request, tokenA, await createPatient(request, tokenA));
    expect([403, 404]).toContain((await request.get(`/api/billing/invoices/${invoiceId}`, { headers: headers(tokenB) })).status());
    expect([403, 404]).toContain((await request.patch(`/api/billing/invoices/${invoiceId}`, { headers: headers(tokenB), data: { status: 'paid' } })).status());
    expect([403, 404]).toContain((await request.delete(`/api/billing/invoices/${invoiceId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-004: Access other clinic inventory item by ID', async ({ request }) => {
    const itemId = await createInventoryItem(request, tokenA);
    expect([403, 404]).toContain((await request.patch(`/api/inventory/${itemId}`, { headers: headers(tokenB), data: { quantity: 0 } })).status());
    expect([403, 404]).toContain((await request.delete(`/api/inventory/${itemId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-005: Access other user order by ID', async ({ request }) => {
    const orderId = await createOrder(request, tokenA);
    const getRes = await request.get(`/api/shop/orders/${orderId}`, { headers: headers(tokenB) });
    expect([403, 404]).toContain(getRes.status());
  });

  test('IDOR-006: Access other clinic document by ID', async ({ request }) => {
    const docId = await createDocument(request, tokenA);
    expect([403, 404]).toContain((await request.get(`/api/files/${docId}`, { headers: headers(tokenB) })).status());
    expect([403, 404]).toContain((await request.get(`/api/files/${docId}/content`, { headers: headers(tokenB) })).status());
    expect([403, 404]).toContain((await request.delete(`/api/files/${docId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-007: Access other clinic treatment plan by ID', async ({ request }) => {
    const planId = await createTreatmentPlan(request, tokenA, await createPatient(request, tokenA));
    expect([403, 404]).toContain((await request.delete(`/api/crm/treatment-plans/${planId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-008: Access other clinic lab order by ID', async ({ request }) => {
    const labOrderId = await createLabOrder(request, tokenA);
    expect([403, 404]).toContain((await request.patch(`/api/lab-orders/${labOrderId}/status`, { headers: headers(tokenB), data: { status: 'ready' } })).status());
    expect([403, 404]).toContain((await request.delete(`/api/lab-orders/${labOrderId}`, { headers: headers(tokenB) })).status());
  });

  test('IDOR-009: Access other user payment by ID', async ({ request }) => {
    const invoiceId = await createInvoice(request, tokenA, await createPatient(request, tokenA));
    const payRes = await request.post(`/api/billing/invoices/${invoiceId}/pay`, {
      headers: headers(tokenB),
      data: { amount: 1000 },
    });
    expect([403, 404]).toContain(payRes.status());
  });

  test('IDOR-010: Access other clinic expense by ID', async ({ request }) => {
    const expenseId = await createExpense(request, tokenA);
    expect([403, 404]).toContain((await request.delete(`/api/crm/expenses/${expenseId}`, { headers: headers(tokenB) })).status());
  });
});
