import { test, expect, APIRequestContext } from '@playwright/test';
import {
  createTestClinic,
  createTestDoctor,
  createTestPatient,
  createTestAppointment,
  createTestDiagnosticCenter,
} from '../helpers/factories';
import { prisma } from '../helpers/db';

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
    const referralA = await prisma.referral.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        patientName: `${patientA.firstName} ${patientA.lastName}`,
        doctorId: doctorA.id,
        centerId: center.id,
        category: 'OPG',
        studyType: 'OPG',
        status: 'DRAFT',
      },
    });
    const tokenA = await login(request, doctorA.email);
    const tokenB = await login(request, doctorB.email);

    const patientRead = await request.get(`/api/patients/${patientA.id}`, { headers: auth(tokenB) });
    expect([403, 404]).toContain(patientRead.status());
    const patientPatch = await request.patch(`/api/patients/${patientA.id}`, { headers: auth(tokenB), data: { firstName: 'SHOULD_NOT_CHANGE' } });
    expect([403, 404]).toContain(patientPatch.status());
    const appointmentStatus = await request.patch(`/api/appointments/${appointmentA.id}/status`, { headers: auth(tokenB), data: { status: 'completed' } });
    expect([403, 404]).toContain(appointmentStatus.status());
    const appointmentClose = await request.post(`/api/appointments/${appointmentA.id}/close`, { headers: auth(tokenB), data: {} });
    expect([403, 404]).toContain(appointmentClose.status());
    const referralRead = await request.get(`/api/diagnostics/referrals/${referralA.id}`, { headers: auth(tokenB) });
    expect([403, 404]).toContain(referralRead.status());
    const referralStatus = await request.post(`/api/diagnostics/referrals/${referralA.id}/status`, { headers: auth(tokenB), data: { status: 'ACCEPTED' } });
    expect([400, 403, 404]).toContain(referralStatus.status());
    const ownPatient = await request.get(`/api/patients/${patientB.id}`, { headers: auth(tokenB) });
    expect(ownPatient.ok()).toBeTruthy();

    await prisma.referral.delete({ where: { id: referralA.id } }).catch(() => {});
    await prisma.appointment.delete({ where: { id: appointmentA.id } }).catch(() => {});
    await prisma.patient.deleteMany({ where: { id: { in: [patientA.id, patientB.id] } } }).catch(() => {});
    await prisma.clinicMember.deleteMany({ where: { userId: { in: [doctorA.id, doctorB.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [doctorA.id, doctorB.id] } } }).catch(() => {});
    await prisma.diagnosticCenter.delete({ where: { id: center.id } }).catch(() => {});
    await prisma.clinic.deleteMany({ where: { id: { in: [clinicA.id, clinicB.id] } } }).catch(() => {});
  });

  test('appointment cannot attach a patient from one clinic to a doctor from another', async ({ request }) => {
    const clinicA = await createTestClinic({ name: `APPT A ${Date.now()}` });
    const clinicB = await createTestClinic({ name: `APPT B ${Date.now()}` });
    const doctorA = await createTestDoctor(clinicA.id, { email: `appt-a-${Date.now()}@test.dentvision` });
    const doctorB = await createTestDoctor(clinicB.id, { email: `appt-b-${Date.now()}@test.dentvision` });
    const patientA = await createTestPatient(clinicA.id);
    const tokenA = await login(request, doctorA.email);
    const res = await request.post('/api/appointments', { headers: auth(tokenA), data: { patientId: patientA.id, doctorId: doctorB.id, date: new Date().toISOString().slice(0, 10), time: '11:30', duration: 30 } });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('referral clinic context cannot be spoofed by replacing clinicId', async ({ request }) => {
    const clinicA = await createTestClinic({ name: `REF A ${Date.now()}` });
    const clinicB = await createTestClinic({ name: `REF B ${Date.now()}` });
    const doctorA = await createTestDoctor(clinicA.id, { email: `ref-a-${Date.now()}@test.dentvision` });
    const center = await createTestDiagnosticCenter({ name: `REF Center ${Date.now()}` });
    const patientA = await createTestPatient(clinicA.id);
    const tokenA = await login(request, doctorA.email);
    const res = await request.post('/api/diagnostics/referrals', { headers: auth(tokenA), data: { clinicId: clinicB.id, doctorId: doctorA.id, patientId: patientA.id, patientName: `${patientA.firstName} ${patientA.lastName}`, category: 'OPG', studyType: 'OPG', centerId: center.id } });
    expect([400, 403, 404]).toContain(res.status());
  });
});
