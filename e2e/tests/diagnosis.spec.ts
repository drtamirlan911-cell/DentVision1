import { test, expect, APIRequestContext } from '@playwright/test';
import { payload as apiPayload } from '../helpers/api';

const BASE = 'http://localhost:3001';

let ownerToken: string;
let doctorToken: string;
let patientId: string;
let doctorId: string;

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await apiPayload(res);
  return body.accessToken;
}

async function getDoctorId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await apiPayload(res);
  return body.user?.id || body.id;
}

async function createPatient(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE}/api/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'Diag', lastName: 'Patient', phone: '+1555200001' },
  });
  const body = await apiPayload(res);
  return body.id;
}

async function cleanupVisit(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/medical/visits/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function cleanupPatient(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/patients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

test.describe('Diagnosis Workflow', () => {
  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, 'owner-a@test.com', 'Test1234!');
    doctorToken = await login(request, 'doctor-a@test.com', 'Test1234!');
    patientId = await createPatient(request, ownerToken);
    doctorId = await getDoctorId(request, doctorToken);
  });

  test.afterAll(async ({ request }) => {
    await cleanupPatient(request, ownerToken, patientId);
  });

  test('DIAG-001: Create diagnosis (visit) → 201', async ({ request }) => {
    const res = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Acute pulpitis',
        complaints: 'Severe toothache',
        treatment: 'Root canal therapy',
        notes: 'Lower right molar',
      },
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);
    expect(body).toHaveProperty('id');
    expect(body.diagnosis).toBe('Acute pulpitis');

    await cleanupVisit(request, ownerToken, body.id);
  });

  test('DIAG-002: Get diagnosis → 200 + correct data', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Gingivitis',
        complaints: 'Bleeding gums',
      },
    });
    const created = await apiPayload(createRes);

    const getRes = await request.get(`${BASE}/api/medical/visits/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(getRes.status()).toBe(200);
    const body = await apiPayload(getRes);
    expect(body.id).toBe(created.id);
    expect(body.diagnosis).toBe('Gingivitis');

    await cleanupVisit(request, ownerToken, created.id);
  });

  test('DIAG-003: Update diagnosis → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Initial diagnosis',
      },
    });
    const created = await apiPayload(createRes);

    const updateRes = await request.put(`${BASE}/api/medical/visits/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { diagnosis: 'Updated diagnosis', treatment: 'New treatment plan' },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await apiPayload(updateRes);
    expect(updated.diagnosis).toBe('Updated diagnosis');

    await cleanupVisit(request, ownerToken, created.id);
  });

  test('DIAG-004: Diagnosis with long text → 201', async ({ request }) => {
    const longDiagnosis = 'A'.repeat(2000);
    const longComplaints = 'B'.repeat(2000);
    const longTreatment = 'C'.repeat(2000);

    const res = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: longDiagnosis,
        complaints: longComplaints,
        treatment: longTreatment,
      },
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);
    expect(body.diagnosis).toBe(longDiagnosis);

    await cleanupVisit(request, ownerToken, body.id);
  });

  test('DIAG-005: Diagnosis with special characters → 201', async ({ request }) => {
    const res = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Caries: teeth #14, #24 — "<b>acute</b>" & sensitivity',
        complaints: 'Pain when drinking cold/hot liquids',
        treatment: 'Composite filling (3M™ Z250)',
      },
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);
    expect(body.diagnosis).toContain('#14');
    expect(body.diagnosis).toContain('™');

    await cleanupVisit(request, ownerToken, body.id);
  });

  test('DIAG-006: Diagnosis without required fields → 400/422', async ({ request }) => {
    const res = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('DIAG-007: List diagnoses for patient → 200', async ({ request }) => {
    const v1 = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Visit A',
      },
    });
    const visit1 = await apiPayload(v1);

    const v2 = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Visit B',
      },
    });
    const visit2 = await apiPayload(v2);

    const listRes = await request.get(`${BASE}/api/medical/visits?patientId=${patientId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.status()).toBe(200);
    const body = await apiPayload(listRes);
    const visits = body.data || body.visits || body;
    expect(Array.isArray(visits)).toBeTruthy();
    const ids = visits.map((v: any) => v.id);
    expect(ids).toContain(visit1.id);
    expect(ids).toContain(visit2.id);

    await cleanupVisit(request, ownerToken, visit1.id);
    await cleanupVisit(request, ownerToken, visit2.id);
  });

  test('DIAG-008: Duplicate diagnosis submission → idempotent or 409', async ({ request }) => {
    const payload = {
      patientId,
      doctorId,
      date: new Date().toISOString().split('T')[0],
      diagnosis: 'Duplicate test',
      complaints: 'Test complaint',
    };

    const r1 = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: payload,
    });
    expect(r1.status()).toBe(201);
    const v1 = await apiPayload(r1);

    const r2 = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: payload,
    });
    expect([201, 409]).toContain(r2.status());

    await cleanupVisit(request, ownerToken, v1.id);
    if (r2.status() === 201) {
      const v2 = await apiPayload(r2);
      await cleanupVisit(request, ownerToken, v2.id);
    }
  });

  test('DIAG-009: Unauthorized diagnosis access → 401', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Auth test',
      },
    });
    const created = await apiPayload(createRes);

    const res = await request.get(`${BASE}/api/medical/visits/${created.id}`);
    expect(res.status()).toBe(401);

    await cleanupVisit(request, ownerToken, created.id);
  });

  test('DIAG-010: Diagnosis links to correct patient → 200', async ({ request }) => {
    const res = await request.post(`${BASE}/api/medical/visits`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: new Date().toISOString().split('T')[0],
        diagnosis: 'Patient link test',
      },
    });
    const created = await apiPayload(res);

    const getRes = await request.get(`${BASE}/api/medical/visits/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const body = await apiPayload(getRes);
    expect(body.patientId).toBe(patientId);

    await cleanupVisit(request, ownerToken, created.id);
  });
});
