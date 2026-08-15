import { test, expect, APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:3001';

let ownerToken: string;
let doctorToken: string;
let patientId: string;
let doctorId: string;

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken;
}

async function getDoctorId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return body.user?.id || body.id;
}

async function createPatient(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE}/api/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'TP', lastName: 'Patient', phone: '+1555300001' },
  });
  const body = await res.json();
  return body.id;
}

async function cleanupPlan(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/treatment-plans/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function cleanupPatient(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/patients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

test.describe('Treatment Plan Workflow', () => {
  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, 'owner-a@test.com', 'Test1234!');
    doctorToken = await login(request, 'doctor-a@test.com', 'Test1234!');
    patientId = await createPatient(request, ownerToken);
    doctorId = await getDoctorId(request, doctorToken);
  });

  test.afterAll(async ({ request }) => {
    await cleanupPatient(request, ownerToken, patientId);
  });

  test('TP-001: Create treatment plan → 201', async ({ request }) => {
    const res = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        title: 'Full mouth restoration',
        price: 5000,
        notes: 'Phased approach',
        items: [
          { procedure: 'Crown', teeth: [14, 24], price: 1500 },
          { procedure: 'Bridge', teeth: [36, 37], price: 2000 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.title).toBe('Full mouth restoration');
    expect(body.patientId).toBe(patientId);

    await cleanupPlan(request, ownerToken, body.id);
  });

  test('TP-002: Get treatment plan → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Root canal plan', price: 800 },
    });
    const created = await createRes.json();

    const getRes = await request.get(`${BASE}/api/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    expect(body.id).toBe(created.id);
    expect(body.title).toBe('Root canal plan');

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-003: Update treatment plan → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Original plan', price: 1000 },
    });
    const created = await createRes.json();

    const updateRes = await request.put(`${BASE}/api/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { title: 'Updated plan', price: 1500, notes: 'Revised' },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.title).toBe('Updated plan');
    expect(updated.price).toBe(1500);

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-004: Treatment plan linked to correct patient → 200', async ({ request }) => {
    const res = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Patient link check', price: 500 },
    });
    const created = await res.json();

    const getRes = await request.get(`${BASE}/api/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const body = await getRes.json();
    expect(body.patientId).toBe(patientId);

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-005: Treatment plan for non-existent patient → 400/404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId: 'non-existent-patient-000', title: 'Invalid', price: 100 },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('TP-006: Treatment plan status transitions (draft→active→completed) → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Status transition plan', price: 300 },
    });
    const created = await createRes.json();

    const activateRes = await request.patch(`${BASE}/api/treatment-plans/${created.id}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'active' },
    });
    expect(activateRes.status()).toBe(200);
    const activated = await activateRes.json();
    expect(activated.status).toBe('active');

    const completeRes = await request.patch(`${BASE}/api/treatment-plans/${created.id}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'completed' },
    });
    expect(completeRes.status()).toBe(200);
    const completed = await completeRes.json();
    expect(completed.status).toBe('completed');

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-007: Treatment plan with items (JSON) → 201 + items persisted', async ({ request }) => {
    const items = [
      { procedure: 'Extraction', teeth: [18], price: 200 },
      { procedure: 'Implant', teeth: [18], price: 3000 },
      { procedure: 'Crown', teeth: [18], price: 1200 },
    ];

    const createRes = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Implant plan', price: 4400, items },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    const getRes = await request.get(`${BASE}/api/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const body = await getRes.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBeTruthy();
    expect(body.items.length).toBe(3);
    expect(body.items[0].procedure).toBe('Extraction');
    expect(body.items[2].price).toBe(1200);

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-008: Delete treatment plan → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'To be deleted', price: 100 },
    });
    const created = await createRes.json();

    const delRes = await request.delete(`${BASE}/api/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(delRes.status()).toBe(200);

    const getRes = await request.get(`${BASE}/api/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect([404, 410]).toContain(getRes.status());
  });

  test('TP-009: Cannot access other clinic\'s treatment plan → 403/404', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Clinic A only plan', price: 500 },
    });
    const created = await createRes.json();

    const loginOther = await request.post(`${BASE}/api/auth/login`, {
      data: { email: 'owner-b@test.com', password: 'Test1234!' },
    });

    if (loginOther.ok()) {
      const otherBody = await loginOther.json();
      const otherToken = otherBody.accessToken;

      const res = await request.get(`${BASE}/api/treatment-plans/${created.id}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      expect([403, 404]).toContain(res.status());
    }

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-010: Treatment plan price validation → 400 if negative', async ({ request }) => {
    const res = await request.post(`${BASE}/api/treatment-plans`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, title: 'Negative price', price: -100 },
    });
    expect([400, 422]).toContain(res.status());
  });
});
