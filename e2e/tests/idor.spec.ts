import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const USER_A = { email: 'owner-a@test.com', password: 'Test1234!' };
const USER_B = { email: 'owner-b@test.com', password: 'Test1234!' };
const DOCTOR_A = { email: 'doctor-a@test.com', password: 'Test1234!' };

let tokenA: string;
let tokenB: string;
let doctorAId: string;

async function login(ctx: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await ctx.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body.data || body;
  return data.accessToken || data.tokens?.accessToken;
}

async function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createPatient(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/patients', {
    headers: await headers(token),
    data: { firstName: 'IDOR', lastName: 'TestPatient', phone: '+77000000002' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createAppointment(ctx: APIRequestContext, token: string, patientId: string, doctorId: string): Promise<string> {
  const res = await ctx.post('/api/appointments', {
    headers: await headers(token),
    data: {
      patientId,
      doctorId,
      date: new Date().toISOString().slice(0, 10),
      time: '14:00',
      duration: 30,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createInvoice(ctx: APIRequestContext, token: string, patientId: string): Promise<string> {
  const res = await ctx.post('/api/billing/invoices', {
    headers: await headers(token),
    data: { patientId, amount: 75000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createInventoryItem(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/inventory', {
    headers: await headers(token),
    data: { name: 'IDOR InvItem', quantity: 5, price: 2000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createDocument(ctx: APIRequestContext, token: string, patientId?: string): Promise<string> {
  const res = await ctx.post('/api/files/documents', {
    headers: await headers(token),
    data: { docType: 'consent', title: 'IDOR Doc', content: 'idor test', patientId },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createTreatmentPlan(ctx: APIRequestContext, token: string, patientId: string): Promise<string> {
  const res = await ctx.post('/api/crm/treatment-plans', {
    headers: await headers(token),
    data: { patientId, title: 'IDOR Plan', status: 'draft' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createLabOrder(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/lab-orders', {
    headers: await headers(token),
    data: { patientName: 'IDOR Lab', labType: 'bridge', notes: 'idor test' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createExpense(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/crm/expenses', {
    headers: await headers(token),
    data: { amount: 5000, category: 'supplies', description: 'IDOR expense' },
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
    const meRes = await request.get('/api/auth/me', { headers: await headers(doctorToken) });
    const meBody = await meRes.json();
    doctorAId = (meBody.data || meBody).id || (meBody.data || meBody).user?.id;
  });

  test('IDOR-001: Access other clinic patient by ID', async ({ request }) => {
    const patientId = await createPatient(request, tokenA);

    const getRes = await request.get(`/api/patients/${patientId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(getRes.status());

    const patchRes = await request.patch(`/api/patients/${patientId}`, {
      headers: await headers(tokenB),
      data: { firstName: 'Hacked' },
    });
    expect([403, 404]).toContain(patchRes.status());

    const deleteRes = await request.delete(`/api/patients/${patientId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-002: Access other clinic appointment by ID', async ({ request }) => {
    const patientIdA = await createPatient(request, tokenA);
    const apptId = await createAppointment(request, tokenA, patientIdA, doctorAId);

    const patchRes = await request.patch(`/api/appointments/${apptId}/status`, {
      headers: await headers(tokenB),
      data: { status: 'completed' },
    });
    expect([403, 404]).toContain(patchRes.status());

    const deleteRes = await request.delete(`/api/appointments/${apptId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-003: Access other clinic invoice by ID', async ({ request }) => {
    const patientIdA = await createPatient(request, tokenA);
    const invoiceId = await createInvoice(request, tokenA, patientIdA);

    const getRes = await request.get(`/api/billing/invoices/${invoiceId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(getRes.status());

    const patchRes = await request.patch(`/api/billing/invoices/${invoiceId}`, {
      headers: await headers(tokenB),
      data: { status: 'paid' },
    });
    expect([403, 404]).toContain(patchRes.status());

    const deleteRes = await request.delete(`/api/billing/invoices/${invoiceId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-004: Access other clinic inventory item by ID', async ({ request }) => {
    const itemId = await createInventoryItem(request, tokenA);

    const patchRes = await request.patch(`/api/inventory/${itemId}`, {
      headers: await headers(tokenB),
      data: { quantity: 0 },
    });
    expect([403, 404]).toContain(patchRes.status());

    const deleteRes = await request.delete(`/api/inventory/${itemId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-005: Access other user order by ID', async ({ request }) => {
    const listRes = await request.get('/api/shop/orders', {
      headers: await headers(tokenA),
    });

    if (!listRes.ok()) return;
    const listBody = await listRes.json();
    const orders = Array.isArray(listBody.data) ? listBody.data : listBody.data?.rows || [];

    if (orders.length === 0) return;

    const orderId = orders[0].id;

    const getRes = await request.get(`/api/shop/orders/${orderId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(getRes.status());
  });

  test('IDOR-006: Access other clinic document by ID', async ({ request }) => {
    const docId = await createDocument(request, tokenA);

    const getRes = await request.get(`/api/files/${docId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(getRes.status());

    const contentRes = await request.get(`/api/files/${docId}/content`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(contentRes.status());

    const deleteRes = await request.delete(`/api/files/${docId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-007: Access other clinic treatment plan by ID', async ({ request }) => {
    const patientIdA = await createPatient(request, tokenA);
    const planId = await createTreatmentPlan(request, tokenA, patientIdA);

    const deleteRes = await request.delete(`/api/crm/treatment-plans/${planId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-008: Access other clinic lab order by ID', async ({ request }) => {
    const labOrderId = await createLabOrder(request, tokenA);

    // 'completed' isn't a lab-order status (see lab.routes.ts's VALID_STATUSES
    // — labs use 'ready'/'delivered'); status validation runs before the
    // tenant-ownership check, so an invalid status always got 400 regardless
    // of whose token was used, and this never actually exercised IDOR.
    const patchRes = await request.patch(`/api/lab-orders/${labOrderId}/status`, {
      headers: await headers(tokenB),
      data: { status: 'ready' },
    });
    expect([403, 404]).toContain(patchRes.status());

    const deleteRes = await request.delete(`/api/lab-orders/${labOrderId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('IDOR-009: Access other user payment by ID', async ({ request }) => {
    const listRes = await request.get('/api/billing/invoices', {
      headers: await headers(tokenA),
      params: { status: 'paid' },
    });

    if (!listRes.ok()) return;
    const listBody = await listRes.json();
    const invoices = Array.isArray(listBody.data) ? listBody.data : listBody.data?.rows || [];

    if (invoices.length === 0) return;

    const invoiceId = invoices[0].id;

    const payRes = await request.post(`/api/billing/invoices/${invoiceId}/pay`, {
      headers: await headers(tokenB),
      data: { amount: 1000 },
    });
    expect([403, 404]).toContain(payRes.status());
  });

  test('IDOR-010: Access other clinic expense by ID', async ({ request }) => {
    const expenseId = await createExpense(request, tokenA);

    const deleteRes = await request.delete(`/api/crm/expenses/${expenseId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });
});
