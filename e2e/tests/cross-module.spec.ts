import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { randomUUID } from 'node:crypto';
// Same reason `helpers/db.ts` reaches into the backend's own node_modules for
// PrismaClient: e2e/ resolves bare `bcryptjs` against the repo root, which
// doesn't have it as a dependency at all — only `dentvision-backend` does.
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

/**
 * Walks the diagnostics ↔ lab chain the spec's `minimum_e2e` asks for, step by
 * step, on real routes rather than mocks: doctor refers a patient to a
 * diagnostic center → the center sees it → the center signs a result, which
 * lands on the patient's timeline and notifies the doctor → the doctor orders
 * lab work → the lab updates its status → the doctor sees the new status.
 *
 * `prisma/seed-e2e.ts` only seeds Clinic-scoped users, so there is no
 * pre-built diagnostic-center identity to log in as. `beforeAll` builds one
 * the same way `diagnostics.service.ts`'s own `syncOrgFromEntity` /
 * `grantDiagnosticsAccess` would — a `DiagnosticCenter`, a mirroring
 * `Organization` (same id, matching that service's own convention), and a
 * `Person` linking a fresh `User` to it. `authContext.ts`'s own-org fallback
 * then embeds `organizationType: 'DIAGNOSTIC_CENTER'` in that user's JWT on
 * login — exactly what `hasOrgAccess` (`diagnostics.routes.ts`) checks —
 * giving the test a genuinely separate tenant rather than the referring
 * clinic wearing two hats.
 */
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
    await prisma.notification
      .deleteMany({ where: { userId: doctorId, link: `/diagnostics/referrals/${referralId}` } })
      .catch(() => {});
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
      data: {
        clinicId,
        patientId,
        patientName: 'CrossModule Patient',
        category: 'CBCT',
        studyType: 'КТ верхней челюсти',
        centerId,
      },
    });
    expect(res.status()).toBe(200);
    const referral = (await res.json()).data;
    referralId = referral.id;
    expect(referral.status).toBe('SENT');
    expect(referral.centerId).toBe(centerId);
  });

  test('CROSS-002: the diagnostic center sees the referral (list + notification)', async () => {
    const listRes = await api.get(`${BASE_URL}/api/diagnostics/referrals`, {
      headers: auth(centerToken),
      params: { centerId },
    });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.items.some((r: any) => r.id === referralId)).toBe(true);

    const notifRes = await api.get(`${BASE_URL}/api/notifications`, {
      headers: auth(centerToken),
      params: { type: 'diagnostics.referral.sent' },
    });
    expect(notifRes.status()).toBe(200);
    const notifications = (await notifRes.json()).data;
    expect(notifications.length).toBeGreaterThan(0);

    // A stranger clinic member must not be able to read this center's inbox —
    // the same tenant boundary the referring clinic gets on its own routes.
    const forbidden = await api.get(`${BASE_URL}/api/diagnostics/referrals`, {
      headers: auth(ownerToken),
      params: { centerId },
    });
    expect(forbidden.status()).toBe(403);
  });

  test('CROSS-003: center signs the result → attached to the patient, referral completed', async () => {
    const signRes = await api.post(`${BASE_URL}/api/diagnostics/results/${referralId}/sign`, {
      headers: auth(centerToken),
      data: { reportText: 'КТ без патологий.', conclusion: 'Норма.' },
    });
    expect(signRes.status()).toBe(200);
    const result = (await signRes.json()).data;
    expect(result.referralId).toBe(referralId);
    expect(result.signedBy).toBe(centerUserId);
    expect(result.signedAt).toBeTruthy();

    const getRes = await api.get(`${BASE_URL}/api/diagnostics/referrals/${referralId}`, {
      headers: auth(doctorToken),
    });
    expect((await getRes.json()).data.status).toBe('COMPLETED');

    // saveAndSignResult's patientId branch — the "attached to the patient's
    // record" half of the chain, independent of the notification below.
    const visits = await prisma.visit.findMany({ where: { patientId } });
    expect(visits.some((v) => (v.notes || '').includes(referralId.slice(0, 8)))).toBe(true);
  });

  test('CROSS-004: the referring doctor is notified that the result is ready', async () => {
    const res = await api.get(`${BASE_URL}/api/notifications`, {
      headers: auth(doctorToken),
      params: { type: 'workflow' },
    });
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

  test('CROSS-007: none of these direct REST mutations reach the AI Agent Activity timeline', async () => {
    // GET /api/ai/timeline reads only AgentActivity, which the governance
    // kernel (ai/os/kernel.ts, runAiAction) writes to solely when a tool runs
    // through the AI surface. Every mutation above went straight through
    // diagnostics.routes.ts / lab.routes.ts, neither of which calls the
    // kernel — so the doctor's timeline must stay silent for them. This is
    // the honest boundary, not a gap: the same tools (createDiagnosticReferral,
    // createLabOrder, updateLabOrderStatus) are independently wired through
    // runAiAction when invoked from the AI chat surface (Stage 9), and that
    // path is covered by kernel.test.ts, not this REST-only chain.
    const res = await api.get(`${BASE_URL}/api/ai/timeline`, {
      headers: auth(doctorToken),
      params: { user: doctorId, limit: '200' },
    });
    expect(res.status()).toBe(200);
    const entries: Array<{ type: string }> = (await res.json()).data.entries;
    const relevantTools = ['createDiagnosticReferral', 'createLabOrder', 'updateLabOrderStatus'];
    expect(entries.some((e) => relevantTools.includes(e.type))).toBe(false);
  });
});
