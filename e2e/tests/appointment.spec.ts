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
  return body.data?.accessToken || body.accessToken;
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
    data: { firstName: 'Appt', lastName: 'Patient', phone: '+1555100001' },
  });
  const body = await res.json();
  return body.id;
}

async function cleanupAppointment(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/appointments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function cleanupPatient(request: APIRequestContext, token: string, id: string) {
  await request.delete(`${BASE}/api/patients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function pastDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split('T')[0];
}

test.describe('Appointment Workflow', () => {
  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, 'owner-a@test.com', 'Test1234!');
    doctorToken = await login(request, 'doctor-a@test.com', 'Test1234!');
    patientId = await createPatient(request, ownerToken);
    doctorId = await getDoctorId(request, doctorToken);
  });

  test.afterAll(async ({ request }) => {
    await cleanupPatient(request, ownerToken, patientId);
  });

  test('APPT-001: Create appointment → 201', async ({ request }) => {
    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        patientId,
        doctorId,
        date: futureDate(7),
        time: '10:00',
        duration: 30,
        type: 'checkup',
        notes: 'Regular checkup',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.patientId).toBe(patientId);
    expect(body.doctorId).toBe(doctorId);

    await cleanupAppointment(request, ownerToken, body.id);
  });

  test('APPT-002: Get appointment → 200 + correct data', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(8), time: '11:00', duration: 45 },
    });
    const created = await createRes.json();

    const getRes = await request.get(`${BASE}/api/appointments/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    expect(body.id).toBe(created.id);
    expect(body.patientId).toBe(patientId);

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-003: Update appointment → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(9), time: '09:00' },
    });
    const created = await createRes.json();

    const updateRes = await request.put(`${BASE}/api/appointments/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { notes: 'Updated notes', duration: 60 },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.notes).toBe('Updated notes');
    expect(updated.duration).toBe(60);

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-004: Reschedule appointment (change date/time) → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(10), time: '14:00' },
    });
    const created = await createRes.json();

    const newDate = futureDate(15);
    const rescheduleRes = await request.put(`${BASE}/api/appointments/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { date: newDate, time: '16:00' },
    });
    expect(rescheduleRes.status()).toBe(200);
    const rescheduled = await rescheduleRes.json();
    expect(rescheduled.date).toContain(newDate);
    expect(rescheduled.time).toContain('16:00');

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-005: Cancel appointment → 200 + status=cancelled', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(11), time: '10:00' },
    });
    const created = await createRes.json();

    const cancelRes = await request.patch(`${BASE}/api/appointments/${created.id}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'cancelled' },
    });
    expect(cancelRes.status()).toBe(200);
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe('cancelled');

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-006: Complete appointment → 200 + status=completed', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(12), time: '11:00' },
    });
    const created = await createRes.json();

    const completeRes = await request.patch(`${BASE}/api/appointments/${created.id}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'completed' },
    });
    expect(completeRes.status()).toBe(200);
    const completed = await completeRes.json();
    expect(completed.status).toBe('completed');

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-007: Double-submit same appointment → 409 or idempotent', async ({ request }) => {
    const payload = {
      patientId,
      doctorId,
      date: futureDate(13),
      time: '15:00',
      duration: 30,
    };

    const r1 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: payload,
    });
    expect(r1.status()).toBe(201);
    const a1 = await r1.json();

    const r2 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: payload,
    });
    expect([201, 409]).toContain(r2.status());

    await cleanupAppointment(request, ownerToken, a1.id);
    if (r2.status() === 201) {
      const a2 = await r2.json();
      await cleanupAppointment(request, ownerToken, a2.id);
    }
  });

  test('APPT-008: Create appointment with past date → 201 (allowed for records)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: pastDate(30), time: '10:00' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();

    await cleanupAppointment(request, ownerToken, body.id);
  });

  test('APPT-009: List appointments for date range → 200', async ({ request }) => {
    const a1 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(20), time: '09:00' },
    });
    const appt1 = await a1.json();

    const a2 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(21), time: '10:00' },
    });
    const appt2 = await a2.json();

    const listRes = await request.get(
      `${BASE}/api/appointments?date=${futureDate(20)}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    const list = body.data || body.appointments || body;
    expect(Array.isArray(list)).toBeTruthy();

    await cleanupAppointment(request, ownerToken, appt1.id);
    await cleanupAppointment(request, ownerToken, appt2.id);
  });

  test('APPT-010: Appointment for non-existent patient → 400/404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId: 'non-existent-id-000', doctorId, date: futureDate(25), time: '10:00' },
    });
    expect([400, 404]).toContain(res.status());
  });
});
