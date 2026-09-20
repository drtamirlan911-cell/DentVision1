import { test, expect } from '@playwright/test';
import { makeIin } from '../helpers/iin';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

async function login(request: any, email: string) {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}
function headers(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }

test.describe('Core clinical workflow', () => {
  test('CLIN-001: patient → treatment case → appointment → close → patient summary', async ({ request }) => {
    const owner = await login(request, 'owner-a@test.com');
    const doctor = await login(request, 'doctor-a@test.com');

    const me = await request.get(`${BASE}/api/auth/me`, { headers: headers(owner) });
    expect(me.ok()).toBeTruthy();
    const meBody = await me.json();
    const ownerUser = meBody.data?.user || meBody.data || meBody.user || meBody;
    const clinicId = ownerUser.clinicId;
    expect(clinicId).toBeTruthy();

    const patient = await request.post(`${BASE}/api/patients`, {
      headers: headers(owner),
      data: {
        firstName: 'Clinical', lastName: `E2E ${Date.now()}`,
        iin: makeIin(), phone: '+77000000031',
        medicalHistory: { allergies: 'none', chiefComplaint: 'tooth pain' },
      },
    });
    expect(patient.status()).toBe(201);
    const patientId = (await patient.json()).data.id;

    const treatmentCase = await request.post(`${BASE}/api/crm/cases`, {
      headers: headers(owner),
      data: {
        patientId, title: 'E2E treatment case',
        chiefComplaint: 'tooth pain', diagnosisCodes: ['K02.9'],
      },
    });
    expect(treatmentCase.status()).toBe(201);
    const caseId = (await treatmentCase.json()).data.id;

    const doctorMe = await request.get(`${BASE}/api/auth/me`, { headers: headers(doctor) });
    const doctorBody = await doctorMe.json();
    const doctorUser = doctorBody.data?.user || doctorBody.data || doctorBody.user || doctorBody;

    const appointment = await request.post(`${BASE}/api/appointments`, {
      headers: headers(owner),
      data: {
        patientId, doctorId: doctorUser.id,
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        time: '10:00', duration: 30, type: 'E2E consultation',
        treatmentCaseId: caseId,
      },
    });
    expect(appointment.status()).toBe(201);
    const appointmentId = (await appointment.json()).data.id;

    const closed = await request.post(`${BASE}/api/appointments/${appointmentId}/close`, {
      headers: headers(owner),
      data: { diagnosis: 'K02.9', notes: 'E2E completed visit' },
    });
    expect(closed.status()).toBe(200);
    expect((await closed.json()).data.appointment.status).toBe('completed');

    const summary = await request.get(`${BASE}/api/patients/${patientId}/summary`, { headers: headers(owner) });
    expect(summary.status()).toBe(200);
    const summaryData = (await summary.json()).data;
    expect(summaryData.patient.id).toBe(patientId);
    expect(summaryData.openPlans).toBeGreaterThanOrEqual(0);

    const caseRead = await request.get(`${BASE}/api/crm/cases/${caseId}`, { headers: headers(owner) });
    expect(caseRead.status()).toBe(200);
    expect((await caseRead.json()).data.case.id).toBe(caseId);
  });
});
