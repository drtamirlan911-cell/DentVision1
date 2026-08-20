import { test, expect, APIRequestContext } from '@playwright/test';
import { payload as apiPayload } from '../helpers/api';

const BASE = 'http://localhost:3001';

let ownerToken: string;
let doctorToken: string;
let assistantToken: string;

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await apiPayload(res);
  return body.accessToken;
}

async function cleanupPatient(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/patients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('Patient Workflow', () => {
  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, 'owner-a@test.com', 'Test1234!');
    doctorToken = await login(request, 'doctor-a@test.com', 'Test1234!');
    assistantToken = await login(request, 'assistant-a@test.com', 'Test1234!');
  });

  test('PATIENT-001: Create patient → 201 + data persisted', async ({ request }) => {
    const payload = {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1555000001',
      email: 'john.doe@test.com',
      birthDate: '1990-05-15',
      gender: 'male',
    };

    const res = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: payload,
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);
    expect(body).toHaveProperty('id');
    expect(body.firstName).toBe('John');
    expect(body.lastName).toBe('Doe');
    expect(body.phone).toBe('+1555000001');

    await cleanupPatient(request, ownerToken, body.id);
  });

  test('PATIENT-002: Search patients → 200 + results include created patient', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'Searchable', lastName: 'Patient', phone: '+1555000002' },
    });
    const created = await apiPayload(createRes);

    const searchRes = await request.get(`${BASE}/api/patients?search=Searchable`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(searchRes.status()).toBe(200);
    const body = await apiPayload(searchRes);
    const patients = body.data || body.patients || body;
    expect(Array.isArray(patients)).toBeTruthy();
    const found = patients.some((p: any) => p.id === created.id);
    expect(found).toBeTruthy();

    await cleanupPatient(request, ownerToken, created.id);
  });

  test('PATIENT-003: Get patient by ID → 200 + correct data', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'GetMe', lastName: 'ByID', phone: '+1555000003' },
    });
    const created = await apiPayload(createRes);

    const getRes = await request.get(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(getRes.status()).toBe(200);
    const body = await apiPayload(getRes);
    expect(body.id).toBe(created.id);
    expect(body.firstName).toBe('GetMe');
    expect(body.lastName).toBe('ByID');

    await cleanupPatient(request, ownerToken, created.id);
  });

  test('PATIENT-004: Update patient → 200 + changes persisted after refresh', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'Original', lastName: 'Name', phone: '+1555000004' },
    });
    const created = await apiPayload(createRes);

    const updateRes = await request.put(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'Updated', phone: '+1999000004' },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await apiPayload(updateRes);
    expect(updated.firstName).toBe('Updated');

    const refreshRes = await request.get(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const refreshed = await apiPayload(refreshRes);
    expect(refreshed.firstName).toBe('Updated');
    expect(refreshed.phone).toBe('+1999000004');

    await cleanupPatient(request, ownerToken, created.id);
  });

  test('PATIENT-005: Create duplicate patient (same name, different phone) → 201', async ({ request }) => {
    const p1 = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'Dupe', lastName: 'Patient', phone: '+1555000005a' },
    });
    expect(p1.status()).toBe(201);
    const d1 = await apiPayload(p1);

    const p2 = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'Dupe', lastName: 'Patient', phone: '+1555000005b' },
    });
    expect(p2.status()).toBe(201);
    const d2 = await apiPayload(p2);

    expect(d1.id).not.toBe(d2.id);

    await cleanupPatient(request, ownerToken, d1.id);
    await cleanupPatient(request, ownerToken, d2.id);
  });

  test('PATIENT-006: Create patient with invalid data → 400/422', async ({ request }) => {
    const res = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: '', lastName: '', phone: '' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('PATIENT-007: Create patient with special characters in name → 201', async ({ request }) => {
    const res = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        firstName: "O'Brien-Smith",
        lastName: 'García-López',
        phone: '+1555000007',
      },
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);
    expect(body.firstName).toBe("O'Brien-Smith");
    expect(body.lastName).toBe('García-López');

    await cleanupPatient(request, ownerToken, body.id);
  });

  test('PATIENT-008: Delete patient → 200 + patient no longer accessible', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'ToDelete', lastName: 'Patient', phone: '+1555000008' },
    });
    const created = await apiPayload(createRes);

    const delRes = await request.delete(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(delRes.status()).toBe(200);

    const getRes = await request.get(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect([404, 410]).toContain(getRes.status());
  });

  test('PATIENT-009: Patient list pagination → 200 + correct page', async ({ request }) => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request.post(`${BASE}/api/patients`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { firstName: `PageTest${i}`, lastName: 'Patient', phone: `+15550090${i}` },
      });
      const b = await apiPayload(r);
      ids.push(b.id);
    }

    const page1 = await request.get(`${BASE}/api/patients?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(page1.status()).toBe(200);
    const p1Body = await apiPayload(page1);
    const p1Data = p1Body.data || p1Body.patients || p1Body;
    expect(Array.isArray(p1Data)).toBeTruthy();
    expect(p1Data.length).toBeLessThanOrEqual(2);

    if (p1Body.totalPages !== undefined) {
      expect(p1Body.totalPages).toBeGreaterThanOrEqual(3);
    }

    for (const id of ids) {
      await cleanupPatient(request, ownerToken, id);
    }
  });

  test('PATIENT-010: Refresh does not lose patient data → 200 + same data', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { firstName: 'Stable', lastName: 'Data', phone: '+1555000010', email: 'stable@test.com' },
    });
    const created = await apiPayload(createRes);

    const r1 = await request.get(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const r2 = await request.get(`${BASE}/api/patients/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const d1 = await apiPayload(r1);
    const d2 = await apiPayload(r2);

    expect(d1.firstName).toBe(d2.firstName);
    expect(d1.lastName).toBe(d2.lastName);
    expect(d1.phone).toBe(d2.phone);

    await cleanupPatient(request, ownerToken, created.id);
  });
});
