import { test, expect, APIRequestContext } from '@playwright/test';
import { payload as apiPayload } from '../helpers/api';
import { makeIin } from '../helpers/iin';

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
    data: { iin: makeIin(), firstName: 'Appt', lastName: 'Patient', phone: '+1555100001' },
  });
  const body = await apiPayload(res);
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
    const body = await apiPayload(res);
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
    const created = await apiPayload(createRes);

    const listRes = await request.get(`${BASE}/api/appointments?from=${futureDate(0)}&to=${futureDate(30)}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.status()).toBe(200);
    const listBody = await apiPayload(listRes);
    const rows = listBody.data || listBody;
    const found = Array.isArray(rows) ? rows.find((a: any) => a.id === created.id) : null;
    expect(found).toBeTruthy();
    expect(found.patientId).toBe(patientId);

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-003: Update appointment → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(9), time: '09:00' },
    });
    const created = await apiPayload(createRes);

    const updateRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { id: created.id, patientId, doctorId, date: futureDate(9), time: '09:00', notes: 'Updated notes', duration: 60 },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await apiPayload(updateRes);
    expect(updated.notes).toBe('Updated notes');
    expect(updated.duration).toBe(60);

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-004: Reschedule appointment (change date/time) → 200', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(10), time: '14:00' },
    });
    const created = await apiPayload(createRes);

    const newDate = futureDate(15);
    const rescheduleRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { id: created.id, patientId, doctorId, date: newDate, time: '16:00' },
    });
    expect(rescheduleRes.status()).toBe(200);
    const rescheduled = await apiPayload(rescheduleRes);
    expect(rescheduled.date).toContain(newDate);
    expect(rescheduled.time).toContain('16:00');

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-005: Cancel appointment → 200 + status=cancelled', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(11), time: '10:00' },
    });
    const created = await apiPayload(createRes);

    const cancelRes = await request.patch(`${BASE}/api/appointments/${created.id}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'cancelled' },
    });
    expect(cancelRes.status()).toBe(200);
    const cancelled = await apiPayload(cancelRes);
    expect(cancelled.status).toBe('cancelled');

    await cleanupAppointment(request, ownerToken, created.id);
  });

  test('APPT-006: Complete appointment → 200 + status=done', async ({ request }) => {
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: futureDate(12), time: '11:00' },
    });
    const createBody = await createRes.text();
    expect(createRes.status(), `APPT-006 appointment creation response: ${createBody}`).toBe(201);

    const parsedCreate = JSON.parse(createBody);
    const created = parsedCreate?.data;
    expect(created, `APPT-006 appointment creation payload: ${createBody}`).toBeTruthy();
    expect(created?.id, `APPT-006 missing created.id in: ${createBody}`).toEqual(expect.any(String));
    expect(created.id.length, `APPT-006 empty created.id in: ${createBody}`).toBeGreaterThan(0);

    const listRes = await request.get(
      `${BASE}/api/appointments?from=${futureDate(12)}&to=${futureDate(12)}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const listBodyText = await listRes.text();
    expect(listRes.status(), `APPT-006 precondition list response: ${listBodyText}`).toBe(200);
    const listParsed = JSON.parse(listBodyText);
    const rows = Array.isArray(listParsed?.data?.data)
      ? listParsed.data.data
      : Array.isArray(listParsed?.data)
        ? listParsed.data
        : [];
    expect(rows.some((appointment: any) => appointment.id === created.id),
      `APPT-006 created.id ${created.id} was not returned by the appointment list: ${listBodyText}`,
    ).toBeTruthy();

    const completeRes = await request.patch(`${BASE}/api/appointments/${created.id}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'completed' },
    });
    const completeBody = await completeRes.text();
    expect(completeRes.status(), `APPT-006 status mutation response: ${completeBody}`).toBe(200);
    const completed = JSON.parse(completeBody)?.data;
    expect(completed?.status).toBe('done');

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
    const a1 = await apiPayload(r1);

    const r2 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: payload,
    });
    expect([201, 409]).toContain(r2.status());

    await cleanupAppointment(request, ownerToken, a1.id);
    if (r2.status() === 201) {
      const a2 = await apiPayload(r2);
      await cleanupAppointment(request, ownerToken, a2.id);
    }
  });

  test('APPT-008: Create appointment with past date → 201 (allowed for records)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: pastDate(30), time: '10:00' },
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);

    await cleanupAppointment(request, ownerToken, body.id);
  });

  test('APPT-009: List appointments for date range → 200', async ({ request }) => {
    const from = futureDate(20);
    const to = futureDate(21);
    const a1 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: from, time: '09:00' },
    });
    const appt1 = await apiPayload(a1);

    const a2 = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId, doctorId, date: to, time: '10:00' },
    });
    const appt2 = await apiPayload(a2);

    const listRes = await request.get(
      `${BASE}/api/appointments?from=${from}&to=${to}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    expect(listRes.status()).toBe(200);
    const body = await apiPayload(listRes);
    const list = body.data || body.appointments || body;
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.some((appointment: any) => appointment.id === appt1.id)).toBeTruthy();
    expect(list.some((appointment: any) => appointment.id === appt2.id)).toBeTruthy();

    await cleanupAppointment(request, ownerToken, appt1.id);
    await cleanupAppointment(request, ownerToken, appt2.id);
  });


  test('RB-030: offline appointment edit queues locally and persists after reconnect', async ({ request, page, context }) => {
    const date = futureDate(1);
    const createRes = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        id: `rb030-${Date.now()}`,
        patientId,
        doctorId,
        date,
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled',
        // The edit form requires a catalog service; keep the service unchanged
        // so the E2E exercises time-only offline sync rather than service edits.
        service: 's1',
        serviceId: 's1',
        serviceName: 'Первичная консультация',
        servicePrice: 3000,
        reason: 'Первичная консультация',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await apiPayload(createRes);
    const appointmentId = created.id as string;

    try {
      const loginRes = await request.post(`${BASE}/api/auth/login`, {
        data: { email: 'owner-a@test.com', password: 'Test1234!' },
      });
      expect(loginRes.status()).toBe(200);
      const loginBody = await apiPayload(loginRes);
      const tokens = loginBody.tokens || loginBody;
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();

      await page.addInitScript(({ access, refresh }) => {
        sessionStorage.setItem('dv_tokens', JSON.stringify({ access, refresh }));
      }, { access: tokens.accessToken, refresh: tokens.refreshToken });

      await page.goto(`${process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000'}/crm/schedule`);
      await expect(page.getByRole('heading', { name: 'Расписание' })).toBeVisible({ timeout: 60_000 });
      await page.getByLabel('Дата').fill(date);
      await expect(page.getByText('Appt Patient', { exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByText('Appt Patient', { exact: true }).last().click();
      await expect(page.getByRole('heading', { name: 'Редактировать запись' })).toBeVisible();
      await expect(page.getByLabel('Услуга из прайса')).toHaveValue('s1');

      await page.getByLabel('Время').selectOption('11:30');
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await expect(page.getByText('Запись сохранена на устройстве и отправится после восстановления сети')).toBeVisible();
      const queued = await page.evaluate(() => {
        const rows = JSON.parse(localStorage.getItem('dv_schedule_sync_queue_v1') || '[]');
        return rows;
      });
      expect(queued).toHaveLength(1);
      expect(queued[0].kind).toBe('upsert');
      expect(queued[0].payload.id).toBe(appointmentId);
      expect(queued[0].payload.time).toBe('11:30');
      expect(queued[0].payload.clinicId).toBeTruthy();
      expect(queued[0].payload.serviceId).toBe('s1');
      expect(JSON.stringify(queued)).not.toContain('Appt Patient');
      expect(JSON.stringify(queued)).not.toContain('Первичная консультация');

      await context.setOffline(false);
      await expect.poll(async () => page.evaluate(() => {
        return JSON.parse(localStorage.getItem('dv_schedule_sync_queue_v1') || '[]').length;
      }), { timeout: 30_000 }).toBe(0);

      const listRes = await request.get(
        `${BASE}/api/appointments?from=${date}&to=${date}`,
        { headers: { Authorization: `Bearer ${ownerToken}` } },
      );
      expect(listRes.status()).toBe(200);
      const listBody = await apiPayload(listRes);
      const rows = listBody.data || listBody;
      const persisted = Array.isArray(rows)
        ? rows.find((appointment: any) => appointment.id === appointmentId)
        : null;
      expect(persisted?.time).toContain('11:30');
      expect(persisted?.serviceId).toBe('s1');
    } finally {
      await context.setOffline(false).catch(() => {});
      await cleanupAppointment(request, ownerToken, appointmentId);
    }
  });

  test('APPT-010: Appointment for non-existent patient → 400/404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { patientId: 'non-existent-id-000', doctorId, date: futureDate(25), time: '10:00' },
    });
    expect([400, 404]).toContain(res.status());
  });
});
