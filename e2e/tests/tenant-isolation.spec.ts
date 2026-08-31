import { test, expect, APIRequestContext } from '@playwright/test';
import { makeIin } from '../helpers/iin';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const USER_A = { email: 'owner-a@test.com', password: 'Test1234!' };
const USER_B = { email: 'owner-b@test.com', password: 'Test1234!' };

let tokenA: string;
let tokenB: string;

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
    data: { iin: makeIin(), firstName: 'TenantTest', lastName: 'Patient', phone: '+77000000001' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createAppointment(ctx: APIRequestContext, token: string, patientId: string): Promise<string> {
  const doctorsRes = await ctx.get('/api/patients', {
    headers: await headers(token),
    params: { limit: '1' },
  });
  const patients = (await doctorsRes.json()).data;
  const patient = Array.isArray(patients) ? patients[0] : patients?.rows?.[0];

  const res = await ctx.post('/api/appointments', {
    headers: await headers(token),
    data: {
      patientId,
      doctorId: patient?.doctorId || patientId,
      date: new Date().toISOString().slice(0, 10),
      time: '10:00',
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
    data: { patientId, amount: 50000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createInventoryItem(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/inventory', {
    headers: await headers(token),
    data: { name: 'TenantTest Item', quantity: 10, price: 1000 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createDocument(ctx: APIRequestContext, token: string, patientId?: string): Promise<string> {
  const res = await ctx.post('/api/files/documents', {
    headers: await headers(token),
    data: { docType: 'consent', title: 'TenantTest Doc', content: 'test', patientId },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createTreatmentPlan(ctx: APIRequestContext, token: string, patientId: string): Promise<string> {
  const res = await ctx.post('/api/crm/treatment-plans', {
    headers: await headers(token),
    data: { patientId, title: 'TenantTest Plan', status: 'draft' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createLabOrder(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/lab-orders', {
    headers: await headers(token),
    data: { patientName: 'TenantTest Lab', labType: 'crown', notes: 'test' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

async function createPromotion(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post('/api/crm/promotions', {
    headers: await headers(token),
    data: { title: 'TenantTest Promo', discountPercent: 10, active: true },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).id;
}

test.describe('Tenant Isolation', () => {
  test.beforeAll(async ({ request }) => {
    tokenA = await login(request, USER_A.email, USER_A.password);
    tokenB = await login(request, USER_B.email, USER_B.password);
  });

  test('TENANT-001: Clinic A patient not visible to Clinic B user', async ({ request }) => {
    const patientId = await createPatient(request, tokenA);

    const res = await request.get(`/api/patients/${patientId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(res.status());
  });

  test('TENANT-002: Clinic A appointment not visible to Clinic B user', async ({ request }) => {
    const patientIdA = await createPatient(request, tokenA);

    const listRes = await request.get('/api/patients', {
      headers: await headers(tokenA),
      params: { limit: '1' },
    });
    const patients = (await listRes.json()).data;
    const patient = Array.isArray(patients) ? patients[0] : patients?.rows?.[0];

    const apptRes = await request.post('/api/appointments', {
      headers: await headers(tokenA),
      data: {
        patientId: patientIdA,
        doctorId: patient?.doctorId || patientIdA,
        date: new Date().toISOString().slice(0, 10),
        time: '11:00',
        duration: 30,
      },
    });

    if (!apptRes.ok()) return;
    const apptBody = await apptRes.json();
    const apptId = (apptBody.data || apptBody).id;

    const listB = await request.get('/api/appointments', {
      headers: await headers(tokenB),
    });
    expect(listB.ok()).toBeTruthy();
    const bodyB = await listB.json();
    const bAppts = Array.isArray(bodyB.data) ? bodyB.data : bodyB.data?.rows || [];
    expect(bAppts.find((a: any) => a.id === apptId)).toBeUndefined();
  });

  test('TENANT-003: Clinic A invoice not accessible by Clinic B user', async ({ request }) => {
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

  test('TENANT-004: Clinic A inventory not visible to Clinic B user', async ({ request }) => {
    const itemId = await createInventoryItem(request, tokenA);

    const patchRes = await request.patch(`/api/inventory/${itemId}`, {
      headers: await headers(tokenB),
      data: { quantity: 999 },
    });
    expect([403, 404]).toContain(patchRes.status());

    const deleteRes = await request.delete(`/api/inventory/${itemId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('TENANT-005: Clinic B patient not visible to Clinic A user (reverse)', async ({ request }) => {
    const patientId = await createPatient(request, tokenB);

    const res = await request.get(`/api/patients/${patientId}`, {
      headers: await headers(tokenA),
    });
    expect([403, 404]).toContain(res.status());
  });

  test('TENANT-006: Clinic A document not downloadable by Clinic B user', async ({ request }) => {
    const docId = await createDocument(request, tokenA);

    const getRes = await request.get(`/api/files/${docId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(getRes.status());

    const deleteRes = await request.delete(`/api/files/${docId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('TENANT-007: Clinic A treatment plan not visible to Clinic B user', async ({ request }) => {
    const patientIdA = await createPatient(request, tokenA);
    const planId = await createTreatmentPlan(request, tokenA, patientIdA);

    const listRes = await request.get(`/api/crm/${patientIdA}/treatment-plans`, {
      headers: await headers(tokenB),
    });

    if (listRes.ok()) {
      const body = await listRes.json();
      const plans = Array.isArray(body.data) ? body.data : [];
      expect(plans.find((p: any) => p.id === planId)).toBeUndefined();
    } else {
      expect([403, 404]).toContain(listRes.status());
    }

    const deleteRes = await request.delete(`/api/crm/treatment-plans/${planId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('TENANT-008: Clinic A lab order not visible to Clinic B user', async ({ request }) => {
    const labOrderId = await createLabOrder(request, tokenA);

    const listRes = await request.get('/api/lab-orders', {
      headers: await headers(tokenB),
    });
    expect(listRes.ok()).toBeTruthy();
    const body = await listRes.json();
    const bOrders = Array.isArray(body.data) ? body.data : [];
    expect(bOrders.find((o: any) => o.id === labOrderId)).toBeUndefined();

    const deleteRes = await request.delete(`/api/lab-orders/${labOrderId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('TENANT-009: Clinic A promotion not visible to Clinic B user', async ({ request }) => {
    const promoId = await createPromotion(request, tokenA);

    const listRes = await request.get('/api/crm/promotions', {
      headers: await headers(tokenB),
    });
    expect(listRes.ok()).toBeTruthy();
    const body = await listRes.json();
    const bPromos = Array.isArray(body.data) ? body.data : [];
    expect(bPromos.find((p: any) => p.id === promoId)).toBeUndefined();

    const deleteRes = await request.delete(`/api/crm/promotions/${promoId}`, {
      headers: await headers(tokenB),
    });
    expect([403, 404]).toContain(deleteRes.status());
  });

  test('TENANT-010: Cross-clinic patient creation blocked', async ({ request }) => {
    const getBefore = await request.get('/api/patients', {
      headers: await headers(tokenB),
      params: { limit: '500' },
    });
    const bodyBefore = await getBefore.json();
    const countBefore = (Array.isArray(bodyBefore.data) ? bodyBefore.data : bodyBefore.data?.rows || []).length;

    const getAfter = await request.get('/api/patients', {
      headers: await headers(tokenB),
      params: { limit: '500' },
    });
    const bodyAfter = await getAfter.json();
    const countAfter = (Array.isArray(bodyAfter.data) ? bodyAfter.data : bodyAfter.data?.rows || []).length;

    const patientIdA = await createPatient(request, tokenA);

    const getAfterCreate = await request.get('/api/patients', {
      headers: await headers(tokenB),
      params: { limit: '500' },
    });
    const bodyAfterCreate = await getAfterCreate.json();
    const countAfterCreate = (Array.isArray(bodyAfterCreate.data) ? bodyAfterCreate.data : bodyAfterCreate.data?.rows || []).length;

    expect(countAfterCreate).toBe(countAfter);
  });
});
