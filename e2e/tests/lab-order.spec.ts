import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const OWNER_A = { email: 'owner-a@test.com', password: 'Test1234!' };
const DOCTOR_A = { email: 'doctor-a@test.com', password: 'Test1234!' };
const OWNER_B = { email: 'owner-b@test.com', password: 'Test1234!' };

let ownerToken = '';
let ownerBToken = '';
let doctorAId = '';
let patientId = '';

async function login(ctx: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await ctx.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createPatient(ctx: APIRequestContext, token: string): Promise<string> {
  const res = await ctx.post(`${BASE_URL}/api/patients`, {
    headers: auth(token),
    data: { firstName: 'Lab', lastName: 'TestPatient', phone: `+7700${Date.now() % 10000000}` },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return (body.data || body).id;
}

async function createLabOrder(
  ctx: APIRequestContext,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const res = await ctx.post(`${BASE_URL}/api/lab-orders`, {
    headers: auth(token),
    data: {
      patientId,
      patientName: 'Lab TestPatient',
      labType: 'crown',
      material: 'zirconia',
      toothNumber: '14',
      shade: 'A2',
      ...overrides,
    },
  });
  return res;
}

test.describe('Lab Order Workflow', () => {
  let api: APIRequestContext;

  /**
   * `api` is a context this file owns, created here and disposed in `afterAll`
   * — the "Fixture { request } from beforeAll cannot be reused in a test"
   * failure mode every other spec file in this suite already worked around.
   */
  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    ownerToken = await login(api, OWNER_A.email, OWNER_A.password);
    ownerBToken = await login(api, OWNER_B.email, OWNER_B.password);
    const doctorToken = await login(api, DOCTOR_A.email, DOCTOR_A.password);
    const meRes = await api.get(`${BASE_URL}/api/auth/me`, { headers: auth(doctorToken) });
    const meBody = await meRes.json();
    doctorAId = (meBody.data || meBody).user?.id || (meBody.data || meBody).id;
    patientId = await createPatient(api, ownerToken);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('LAB-001: Create lab order → 201 + correct data', async () => {
    const res = await createLabOrder(api, ownerToken);
    expect(res.status()).toBe(201);
    const body = await res.json();
    const order = body.data || body;
    expect(order.id).toBeDefined();
    expect(order.patientId).toBe(patientId);
    expect(order.labType).toBe('crown');
    expect(order.material).toBe('zirconia');
    expect(order.toothNumber).toBe('14');
    expect(order.shade).toBe('A2');
    // No status in the request body → the route's own default.
    expect(order.status).toBe('pending');
  });

  test('LAB-002: List lab orders → 200 + created order present', async () => {
    const created = await (await createLabOrder(api, ownerToken)).json();
    const orderId = (created.data || created).id;

    // No GET /:id route — list-and-find, same pattern as appointments/visits.
    const listRes = await api.get(`${BASE_URL}/api/lab-orders`, { headers: auth(ownerToken) });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const orders = listBody.data || listBody;
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.some((o: any) => o.id === orderId)).toBe(true);
  });

  test('LAB-003: Update lab order via POST with id in body → 201 + changes persisted', async () => {
    const created = await (await createLabOrder(api, ownerToken)).json();
    const orderId = (created.data || created).id;

    const updateRes = await createLabOrder(api, ownerToken, { id: orderId, material: 'e-max', shade: 'B1' });
    expect(updateRes.status()).toBe(201);
    const updated = await updateRes.json();
    const order = updated.data || updated;
    expect(order.id).toBe(orderId);
    expect(order.material).toBe('e-max');
    expect(order.shade).toBe('B1');

    // Persisted, not just echoed back — confirm via a fresh list read.
    const listRes = await api.get(`${BASE_URL}/api/lab-orders`, { headers: auth(ownerToken) });
    const listBody = await listRes.json();
    const orders = listBody.data || listBody;
    const found = orders.find((o: any) => o.id === orderId);
    expect(found.material).toBe('e-max');
  });

  test('LAB-004: doctorId from another clinic → 400', async () => {
    // prepareLabOrderWrite (lab.routes.ts) checks doctorId via isClinicMember —
    // owner-b is real but belongs to Clinic B, not this (Clinic A) order.
    const meRes = await api.get(`${BASE_URL}/api/auth/me`, { headers: auth(ownerBToken) });
    const meBody = await meRes.json();
    const ownerBId = (meBody.data || meBody).user?.id || (meBody.data || meBody).id;

    const res = await createLabOrder(api, ownerToken, { doctorId: ownerBId });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('клинике');
  });

  test('LAB-005: doctorId of a real clinic member → 201 + doctorId set', async () => {
    const res = await createLabOrder(api, ownerToken, { doctorId: doctorAId });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const order = body.data || body;
    expect(order.doctorId).toBe(doctorAId);
  });

  test('LAB-006: Status transitions through the full cycle → 200 each step', async () => {
    const created = await (await createLabOrder(api, ownerToken)).json();
    const orderId = (created.data || created).id;

    const cycle = ['sent', 'in_progress', 'ready', 'delivered'];
    for (const status of cycle) {
      const res = await api.patch(`${BASE_URL}/api/lab-orders/${orderId}/status`, {
        headers: auth(ownerToken),
        data: { status },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect((body.data || body).status).toBe(status);
    }
  });

  test('LAB-007: Invalid status → 400 with the allowed list in the message', async () => {
    const created = await (await createLabOrder(api, ownerToken)).json();
    const orderId = (created.data || created).id;

    const res = await api.patch(`${BASE_URL}/api/lab-orders/${orderId}/status`, {
      headers: auth(ownerToken),
      data: { status: 'completed' }, // not a real status — see IDOR-008's own note on this
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ready');
  });

  test('LAB-008: Delete lab order → 200 {deleted:true}, gone from the list', async () => {
    const created = await (await createLabOrder(api, ownerToken)).json();
    const orderId = (created.data || created).id;

    const delRes = await api.delete(`${BASE_URL}/api/lab-orders/${orderId}`, { headers: auth(ownerToken) });
    expect(delRes.status()).toBe(200);
    const delBody = await delRes.json();
    expect((delBody.data || delBody).deleted).toBe(true);

    const listRes = await api.get(`${BASE_URL}/api/lab-orders`, { headers: auth(ownerToken) });
    const listBody = await listRes.json();
    const orders = listBody.data || listBody;
    expect(orders.some((o: any) => o.id === orderId)).toBe(false);
  });

  test('LAB-009: Status change on own clinic\'s order → 200 (positive counterpart to IDOR-008)', async () => {
    // idor.spec.ts's IDOR-008 already proves a *different* clinic's token is
    // rejected on this same route; this proves the caller's own clinic isn't
    // collaterally blocked by that same ownership check.
    const created = await (await createLabOrder(api, ownerToken)).json();
    const orderId = (created.data || created).id;

    const res = await api.patch(`${BASE_URL}/api/lab-orders/${orderId}/status`, {
      headers: auth(ownerToken),
      data: { status: 'sent' },
    });
    expect(res.status()).toBe(200);
  });

  test('LAB-010: remakeOfId/appointmentId/tryInDate round-trip through files.meta', async () => {
    const created = await (await createLabOrder(api, ownerToken)).json();
    const firstOrderId = (created.data || created).id;

    const res = await createLabOrder(api, ownerToken, {
      remakeOfId: firstOrderId,
      appointmentId: 'appt-does-not-exist-but-is-just-a-label-here',
      tryInDate: '2026-09-01',
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const order = body.data || body;
    expect(order.remakeOfId).toBe(firstOrderId);
    expect(order.appointmentId).toBe('appt-does-not-exist-but-is-just-a-label-here');
    expect(order.tryInDate).toBe('2026-09-01');

    // These fields live in the `files` JSON column, not real columns —
    // confirm they actually persisted, not just echoed on the create response.
    const listRes = await api.get(`${BASE_URL}/api/lab-orders`, { headers: auth(ownerToken) });
    const listBody = await listRes.json();
    const orders = listBody.data || listBody;
    const found = orders.find((o: any) => o.id === order.id);
    expect(found.remakeOfId).toBe(firstOrderId);
    expect(found.tryInDate).toBe('2026-09-01');
  });
});
