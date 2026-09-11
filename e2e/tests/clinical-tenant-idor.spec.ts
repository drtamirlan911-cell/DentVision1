import { test, expect, APIRequestContext } from '@playwright/test';
import {
  createTestClinic,
  createTestDoctor,
  createTestPatient,
  createTestAppointment,
  createTestDiagnosticCenter,
  createTestDiagnosticReferral,
} from '../helpers/factories';

/**
 * Clinical tenant boundary tests.
 *
 * These are deliberately IDOR-oriented: the attacker has a valid account and
 * only swaps object IDs belonging to another clinic. A passing test therefore
 * requires authorization at the object boundary, not merely at route level.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

async function login(ctx: APIRequestContext, email: string) {
  const res = await ctx.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body.data || body;
  return data.accessToken || data.tokens?.accessToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test.describe('Clinical tenant isolation / IDOR', () => {
  test('patient, appointment and referral IDs cannot cross clinic boundary', async ({ request }) => {
    const clinicA = await createTestClinic({ name: `IDOR A ${Date.now()}` });
    const clinicB = await createTestClinic({ name: `IDOR B ${Date.now()}` });
    const doctorA = await createTestDoctor(clinicA.id, { email: `idor-a-${Date.now()}@test.dentvision` });
    const doctorB = await createTestDoctor(clinicB.id, { email: `idor-b-${Date.now()}@test.dentvision` });
    const patientA = await createTestPatient(clinicA.id);
    const patientB = await createTestPatient(clinicB.id);
    const appointmentA = await createTestAppointment(clinicA.id, patientA.id, doctorA.id);
    const center = await createTestDiagnosticCenter({ name: `IDOR Center ${Date.now()}` });
    const referralA = await createTestDiagnosticReferral(clinicA.id, doctorA.id, center.id, { patientName: 'Clinic A' });

    const tokenA = await login(request, doctorA.email);
    const tokenB = await login(request, doctorB.email);

    // Cross-clinic reads must fail, even though the object IDs are valid.
    for (const [token, id] of [[tokenB, patientA.id], [tokenB, appointmentA.id]] as const) {
      const path = id === patientA.id ? `/api/patients/${id}` : `/api/appointments/${id}`;
      const res = await request.get(path, { headers: auth(token) });
      expect([403, 404]).toContain(res.status());
    }

    const referralRead = await request.get(`/api/diagnostics/referrals/${referralA.id}`, { headers: auth(tokenB) });
    expect([403, 404]).toContain(referralRead.status());

    // Cross-clinic mutations must also fail.
    const patientPatch = await request.patch(`/api/patients/${patientA.id}`, {
      headers: auth(tokenB), data: { firstName: 'SHOULD_NOT_CHANGE' },
    });
    expect([403, 404]).toContain(patientPatch.status());

    const appointmentStatus = await request.patch(`/api/appointments/${appointmentA.id}/status`, {
      headers: auth(tokenB), data: { status: 'completed' },
    });
    expect([403, 404]).toContain(appointmentStatus.status());

    const referralStatus = await request.post(`/api/diagnostics/referrals/${referralA.id}/status`, {
      headers: auth(tokenB), data: { status: 'ACCEPTED' },
    });
    expect([403, 404]).toContain(referralStatus.status());

    // The other tenant remains independently addressable by its own user.
    const ownPatient = await request.get(`/api/patients/${patientB.id}`, { headers: auth(tokenB) });
    expect(ownPatient.ok()).toBeTruthy();
  });

  test('appointment cannot attach a patient from one clinic to a doctor from another', async ({ request }) => {
    const clinicA = await createTestClinic({ name: `APPT A ${Date.now()}` });
    const clinicB = await createTestClinic({ name: `APPT B ${Date.now()}` });
    const doctorA = await createTestDoctor(clinicA.id, { email: `appt-a-${Date.now()}@test.dentvision` });
    const doctorB = await createTestDoctor(clinicB.id, { email: `appt-b-${Date.now()}@test.dentvision` });
    const patientA = await createTestPatient(clinicA.id);
    const tokenA = await login(request, doctorA.email);

    const res = await request.post('/api/appointments', {
      headers: auth(tokenA),
      data: {
        patientId: patientA.id,
        doctorId: doctorB.id,
        date: new Date().toISOString().slice(0, 10),
        time: '11:30',
        duration: 30,
      },
    });

    expect([400, 403, 404]).toContain(res.status());
  });

  test('referral clinic context cannot be spoofed by replacing clinicId', async ({ request }) => {
    const clinicA = await createTestClinic({ name: `REF A ${Date.now()}` });
    const clinicB = await createTestClinic({ name: `REF B ${Date.now()}` });
    const doctorA = await createTestDoctor(clinicA.id, { email: `ref-a-${Date.now()}@test.dentvision` });
    const center = await createTestDiagnosticCenter({ name: `REF Center ${Date.now()}` });
    const patientA = await createTestPatient(clinicA.id);
    const tokenA = await login(request, doctorA.email);

    const res = await request.post('/api/diagnostics/referrals', {
      headers: auth(tokenA),
      data: {
        clinicId: clinicB.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        patientName: `${patientA.firstName} ${patientA.lastName}`,
        category: 'DIGITAL_XRAY',
        studyType: 'OPG',
        centerId: center.id,
      },
    });

    if (res.ok()) {
      const body = await res.json();
      const referral = body.data || body;
      expect(referral.clinicId).toBe(clinicA.id);
    } else {
      expect([400, 403, 404]).toContain(res.status());
    }
  });
});
