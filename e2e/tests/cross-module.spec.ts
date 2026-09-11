import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import bcrypt from '../../dentvision-backend/node_modules/bcryptjs/index.js';
import { prisma } from '../helpers/db';
import { makeIin } from '../helpers/iin';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const E2E_PASSWORD = 'Test1234!';

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function login(ctx: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await ctx.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}

test.describe('Cross-Module Workflow: referral → center → result → lab → timeline', () => {
  let api: APIRequestContext;
  let doctorToken: string;
  let ownerToken: string;
  let doctorId: string;
  let clinicId: string;
  let patientId: string;
  let centerId: string;
  let centerUserId: string;
  let centerToken: string;
  let referralId: string;
  let labOrderId: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    ownerToken = await login(api, 'owner-a@test.com', E2E_PASSWORD);
    doctorToken = await login(api, 'doctor-a@test.com', E2E_PASSWORD);

    const meRes = await api.get(`${BASE_URL}/api/auth/me`, { headers: auth(doctorToken) });
    const me = (await meRes.json()).data;
    doctorId = me.user?.id || me.id;
    clinicId = me.memberships?.[0]?.clinicId;

    const center = await prisma.diagnosticCenter.create({
      data: { id: randomUUID(), name: 'E2E Cross-Module Center', city: 'Almaty', active: true },
    });
    centerId = center.id;
    await prisma.organization.create({
      data: {
        id: centerId,
        name: center.name,
        type: 'DIAGNOSTIC_CENTER',
        originalType: 'DiagnosticCenter',
        originalId: centerId,
      },
    });
    const centerUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `e2e-cross-center-${Date.now()}@test.com`,
        password: await bcrypt.hash(E2E_PASSWORD, 10),
        firstName: 'Center',
        lastName: 'Operator',
        role: 'ADMIN',
      },
    });
    centerUserId = centerUser.id;
    await prisma.person.create({
      data: {
        id: randomUUID(),
        fullName: `${centerUser.firstName} ${centerUser.lastName}`,
        personType: 'OPERATOR',
        organizationId: centerId,
        userId: centerUserId,
      },
    });
    centerToken = await login(api, centerUser.email, E2E_PASSWORD);

    const patientRes = await api.post(`${BASE_URL}/api/patients`, {
      headers: auth(ownerToken),
      data: { iin: makeIin(), firstName: 'CrossModule', lastName: 'Patient', phone: `+7700${Date.now() % 10000000}` },
    });
    expect(patientRes.status()).toBe(201);
    patientId = (await patientRes.json()).data.id;
  });

  test.afterAll(async () => {
    await prisma.diagnosticResult.deleteMany({ where: { referralId } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: centerUserId } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: doctorId, link: `/diagnostics/referrals/${referralId}` } }).catch(() => {});
    await prisma.referral.deleteMany({ where: { id: referralId } }).catch(() => {});
    await prisma.labOrder.deleteMany({ where: { id: labOrderId } }).catch(() => {});
    await prisma.visit.deleteMany({ where: { patientId } }).catch(() => {});
    await prisma.person.deleteMany({ where: { organizationId: centerId } }).catch(() => {});
    await prisma.user.delete({ where: { id: centerUserId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: centerId } }).catch(() => {});
    await prisma.diagnosticCenter.delete({ where: { id: centerId } }).catch(() => {});
    await prisma.patient.delete({ where: { id: patientId } }).catch(() => {});
    await api.dispose();
  });

  test('CROSS-001: doctor creates a referral to the diagnostic center → SENT', async () => {
    const res = await api.post(`${BASE_URL}/api/diagnostics/referrals`, {
      headers: auth(doctorToken),
      data: { clinicId, patientId, patientName: 'CrossModule Patient', category: 'CBCT', studyType: 'КТ верхней челюсти', centerId },
    });
    expect(res.status()).toBe(201);
    const referral = (await res.json()).data;
    referralId = referral.id;
    expect(referral.status).toBe('SENT');
    expect(referral.centerId).toBe(centerId);
  });

  test('CROSS-002: the diagnostic center sees the referral (list + notification)', async () => {
    const listRes = await api.get(`${BASE_URL}/api/diagnostics/referrals`, { headers: auth(centerToken), params: { centerId } });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.items.some((r: any) => r.id === referralId)).toBe(true);

    const notifRes = await api.get(`${BASE_URL}/api/notifications`, {
      headers: auth(centerToken),
      params: { type: 'diagnostics.referral.sent' },
    });
    expect(notifRes.status()).toBe(200);
    const notifications = (await notifRes.json()).data;
    expect(notifications.length).toBeGreaterThan(0);

    const forbidden = await api.get(`${BASE_URL}/api/diagnostics/referrals`, { headers: auth(ownerToken), params: { centerId } });
    expect(forbidden.status()).toBe(403);
  });

  test('CROSS-003: center completes the performed study, then doctor signs the result → patient record', async () => {
    const completeRes = await api.post(`${BASE_URL}/api/diagnostics/referrals/${referralId}/status`, {
      headers: auth(centerToken),
      data: { status: 'COMPLETED' },
    });
    expect(completeRes.status()).toBe(200);
    expect((await completeRes.json()).data.status).toBe('COMPLETED');

    const signRes = await api.post(`${BASE_URL}/api/diagnostics/referrals/${referralId}/results/sign`, {
      headers: auth(doctorToken),
      data: { reportText: 'КТ без патологий.', conclusion: 'Норма.' },
    });
    expect(signRes.status()).toBe(200);
    const result = (await signRes.json()).data.result;
    expect(result.referralId).toBe(referralId);
    expect(result.signedBy).toBe(doctorId);
    expect(result.signedAt).toBeTruthy();

    const visits = await prisma.visit.findMany({ where: { patientId } });
    expect(visits.some((v) => (v.notes || '').includes(referralId.slice(0, 8)))).toBe(true);
  });

  test('CROSS-004: the referring doctor is notified that the result is ready', async () => {
    const res = await api.get(`${BASE_URL}/api/notifications`, { headers: auth(doctorToken), params: { type: 'workflow' } });
    expect(res.status()).toBe(200);
    const notifications = (await res.json()).data;
    expect(notifications.some((n: any) => n.link === `/diagnostics/referrals/${referralId}`)).toBe(true);
  });

  test('CROSS-005: doctor orders lab work for the same patient', async () => {
    const res = await api.post(`${BASE_URL}/api/lab-orders`, {
      headers: auth(doctorToken),
      data: { patientId, patientName: 'CrossModule Patient', labType: 'crown', material: 'zirconia', doctorId },
    });
    expect(res.status()).toBe(201);
    const order = (await res.json()).data;
    labOrderId = order.id;
    expect(order.status).toBe('pending');
  });

  test('CROSS-006: lab updates the order status → doctor sees the new status', async () => {
    const statusRes = await api.patch(`${BASE_URL}/api/lab-orders/${labOrderId}/status`, {
      headers: auth(doctorToken),
      data: { status: 'ready' },
    });
    expect(statusRes.status()).toBe(200);
    const listRes = await api.get(`${BASE_URL}/api/lab-orders`, { headers: auth(doctorToken) });
    const orders = (await listRes.json()).data;
    expect(orders.find((o: any) => o.id === labOrderId)?.status).toBe('ready');
  });

  test('CROSS-007: direct REST mutations do not enter the AI Agent Activity timeline', async () => {
    const res = await api.get(`${BASE_URL}/api/ai/timeline`, { headers: auth(doctorToken), params: { user: doctorId, limit: '200' } });
    expect(res.status()).toBe(200);
    const entries: Array<{ type: string }> = (await res.json()).data.entries;
    const relevantTools = ['createDiagnosticReferral', 'createLabOrder', 'updateLabOrderStatus'];
    expect(entries.some((e) => relevantTools.includes(e.type))).toBe(false);
  });
});
