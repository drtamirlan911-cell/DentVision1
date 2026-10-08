import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { makeIin } from '../helpers/iin';
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/default.js';
import { createTestUser } from '../helpers/factories';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

async function login(api: APIRequestContext, email: string) {
  const res = await api.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken as string;
}
function auth(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }

test.describe('Partner operational lifecycle', () => {
  let api: APIRequestContext;
  let ownerToken = '';
  let superadminToken = '';
  let doctorToken = '';
  let patientId = '';
  let doctorId = '';
  const prisma = new PrismaClient();
  let fixtureCenterId = '';
  let fixtureLabId = '';
  let centerOwnerToken = '';
  let centerRadiologistToken = '';
  let centerRadiologistId = '';
  let labOwnerToken = '';

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    ownerToken = await login(api, 'owner-a@test.com');
    superadminToken = await login(api, 'superadmin@test.com');
    doctorToken = await login(api, 'doctor-a@test.com');

    const me = await api.get(`${BASE}/api/auth/me`, { headers: auth(doctorToken) });
    const body = await me.json();
    const user = body.data?.user || body.data || body.user || body;
    doctorId = user.id;

    const centerOwner = await createTestUser({ email: `diagnostic-owner-${Date.now()}@test.dentvision`, firstName: 'Diagnostic', lastName: 'Owner' });
    centerOwnerToken = await login(api, centerOwner.email);
    const centerOnboard = await api.post(`${BASE}/api/organizations/self-service`, {
      headers: auth(centerOwnerToken),
      data: { type: 'diagnostic_center', name: `E2E Diagnostic ${Date.now()}`, city: 'Тараз' },
    });
    expect(centerOnboard.status()).toBe(201);
    const centerPayload = await centerOnboard.json();
    fixtureCenterId = centerPayload.data?.entityId;
    const centerAccessToken = centerPayload.data?.accessToken || centerPayload.accessToken;
    expect(centerAccessToken).toBeTruthy();
    centerOwnerToken = centerAccessToken;
    const centerTokenPayload = JSON.parse(Buffer.from(centerAccessToken.split('.')[1], 'base64url').toString('utf8')) as {
      role?: string;
      organizationType?: string;
      organizationId?: string;
      branchId?: string;
    };
    expect(centerTokenPayload.role).toBe('DIAGNOSTIC_OWNER');
    expect(centerTokenPayload.organizationType).toBe('DIAGNOSTIC_CENTER');
    expect(centerTokenPayload.organizationId).toBeTruthy();
    expect(centerTokenPayload.branchId).toBeTruthy();

    // Operational referral/result tests start from an approved, visible partner
    // workspace. Self-service onboarding intentionally creates PENDING visibility;
    // this fixture advances only that lifecycle prerequisite without weakening the
    // production fail-closed policy.
    const centerOrgId = centerTokenPayload.organizationId!;
    const centerOrg = await prisma.organization.findUnique({ where: { id: centerOrgId }, select: { settings: true } });
    const centerSettings = centerOrg?.settings && typeof centerOrg.settings === 'object' ? centerOrg.settings as Record<string, unknown> : {};
    await prisma.organization.update({
      where: { id: centerOrgId },
      data: {
        settings: {
          ...centerSettings,
          lifecycle: 'ACTIVE',
          verification: 'VERIFIED',
          ecosystemVisible: true,
          legal: {
            ...((centerSettings.legal && typeof centerSettings.legal === 'object') ? centerSettings.legal as Record<string, unknown> : {}),
            status: 'READY',
          },
        },
      },
    });

    const radiologist = await createTestUser({
      email: `radiologist-${Date.now()}@test.dentvision`,
      firstName: 'E2E',
      lastName: 'Radiologist',
      role: 'STUDENT' as any,
    });
    centerRadiologistId = radiologist.id;
    await prisma.diagnosticCenterMember.create({
      data: { centerId: fixtureCenterId, userId: centerRadiologistId, role: 'radiologist' },
    });
    const radiologistPerson = await prisma.person.create({
      data: {
        id: randomUUID(),
        fullName: 'E2E Radiologist',
        personType: 'RADIOLOGIST',
        organizationId: centerOrgId,
        userId: centerRadiologistId,
      },
    });
    const radiologistRole = await prisma.role.findUnique({ where: { key: 'radiologist' }, select: { id: true } });
    expect(radiologistRole?.id).toBeTruthy();
    await prisma.personRole.create({
      data: {
        id: randomUUID(),
        personId: radiologistPerson.id,
        roleId: radiologistRole!.id,
        scopeType: 'organization',
        scopeId: centerOrgId,
        scopeKey: `organization:${centerOrgId}`,
      },
    });
    const radiologistBaseToken = await login(api, radiologist.email);
    const radiologistContextsRes = await api.get(`${BASE}/api/iam/me/contexts`, { headers: auth(radiologistBaseToken) });
    expect(radiologistContextsRes.status()).toBe(200);
    const radiologistContexts = (await radiologistContextsRes.json()).data?.contexts || [];
    const radiologistContext = radiologistContexts.find((item: any) => item.scopeType === 'DIAGNOSTIC_CENTER' && item.organizationId === centerOrgId);
    expect(radiologistContext).toBeTruthy();
    const switchedRadiologist = await api.post(`${BASE}/api/iam/switch-context`, {
      headers: auth(radiologistBaseToken),
      data: { scopeType: radiologistContext.scopeType, scopeId: radiologistContext.scopeId, branchId: radiologistContext.branchId },
    });
    expect(switchedRadiologist.status()).toBe(200);
    centerRadiologistToken = (await switchedRadiologist.json()).data.accessToken;
    expect(centerRadiologistToken).toBeTruthy();

    const state = await api.storageState();
    const refreshCookie = state.cookies.find((cookie) => cookie.name === 'refreshToken');
    expect(refreshCookie).toBeTruthy();
    const refreshRes = await api.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: refreshCookie!.value },
    });
    expect(refreshRes.status()).toBe(200);
    const refreshedPayload = await refreshRes.json();
    const refreshedAccessToken = refreshedPayload.data?.accessToken || refreshedPayload.accessToken;
    expect(refreshedAccessToken).toBeTruthy();
    centerOwnerToken = refreshedAccessToken;
    const refreshedTokenPayload = JSON.parse(Buffer.from(refreshedAccessToken.split('.')[1], 'base64url').toString('utf8')) as {
      role?: string;
      organizationType?: string;
      organizationId?: string;
    };
    expect(refreshedTokenPayload.role).toBe('DIAGNOSTIC_OWNER');
    expect(refreshedTokenPayload.organizationType).toBe('DIAGNOSTIC_CENTER');
    expect(refreshedTokenPayload.organizationId).toBe(centerTokenPayload.organizationId);

    const centerOrgContext = JSON.parse(Buffer.from(centerOwnerToken.split('.')[1], 'base64url').toString('utf8')) as { organizationId?: string };
    expect(centerOrgContext.organizationId).toBe(centerOrgId);
    const branchList = await api.get(
      `${BASE}/api/organizations/branches?organizationId=${encodeURIComponent(centerOrgId!)}`,
      { headers: auth(centerOwnerToken) },
    );
    expect(branchList.status()).toBe(200);
    const partnerBranches = (await branchList.json()).data || [];
    expect(partnerBranches.length).toBeGreaterThanOrEqual(1);

    const labOwner = await createTestUser({ email: `medical-lab-owner-${Date.now()}@test.dentvision`, firstName: 'Medical Lab', lastName: 'Owner' });
    labOwnerToken = await login(api, labOwner.email);
    const labOnboard = await api.post(`${BASE}/api/organizations/self-service`, {
      headers: auth(labOwnerToken),
      data: { type: 'medical_lab', name: `E2E Medical Lab ${Date.now()}`, city: 'Тараз' },
    });
    expect(labOnboard.status()).toBe(201);
    const labPayload = await labOnboard.json();
    fixtureLabId = labPayload.data?.entityId;
    const labAccessToken = labPayload.data?.accessToken || labPayload.accessToken;
    expect(labAccessToken).toBeTruthy();
    labOwnerToken = labAccessToken;

    const patient = await api.post(`${BASE}/api/patients`, {
      headers: auth(ownerToken),
      data: { iin: makeIin(), firstName: 'Partner', lastName: 'Lifecycle', phone: `+7700${Date.now() % 10000000}` },
    });
    expect(patient.status()).toBe(201);
    patientId = (await patient.json()).data?.id || (await patient.json()).id;
  });

  test.afterAll(async () => {
    if (centerRadiologistId) {
      await prisma.diagnosticCenterMember.deleteMany({ where: { userId: centerRadiologistId } }).catch(() => {});
      await prisma.personRole.deleteMany({ where: { person: { userId: centerRadiologistId } } }).catch(() => {});
      await prisma.person.deleteMany({ where: { userId: centerRadiologistId } }).catch(() => {});
      await prisma.user.delete({ where: { id: centerRadiologistId } }).catch(() => {});
    }
    await api.dispose();
    await prisma.$disconnect();
  });

  test('PARTNER-001: diagnostic center referral → accept → process → result → clinic visibility', async () => {
    const centerId = fixtureCenterId;
    expect(centerId).toBeTruthy();

    const clinic = await prisma.clinic.findFirst({ where: { name: 'E2E Clinic A' }, select: { id: true } });
    const clinicId = clinic?.id;
    const branchRows = clinicId ? await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM branches WHERE clinic_id = ${clinicId} AND "isDefault" = true LIMIT 1` : [];
    const branchId = branchRows[0]?.id;
    expect(clinicId).toBeTruthy();
    expect(branchId).toBeTruthy();

    const referralRes = await api.post(`${BASE}/api/diagnostics/referrals`, {
      headers: auth(ownerToken),
      data: {
        clinicId,
        branchId,
        patientId,
        doctorId,
        patientName: 'Partner Lifecycle',
        category: 'CBCT',
        studyType: 'Конусно-лучевая КТ (КЛКТ)',
        centerId,
        complaints: 'E2E diagnostic workflow',
      },
    });
    expect(referralRes.status()).toBe(201);
    const referral = (await referralRes.json()).data;
    expect(referral.status).toBe('SENT');

    for (const [status, actor] of [['ACCEPTED', centerOwnerToken], ['IN_PROGRESS', centerOwnerToken], ['COMPLETED', centerOwnerToken]] as const) {
      const res = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
        headers: auth(actor),
        data: { status, cost: 10000 },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).data.status).toBe(status);
    }

    const visitCountBefore = await prisma.visit.count({ where: { patientId } });
    const result = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/results/sign`, {
      headers: auth(centerRadiologistToken),
      data: { reportText: 'E2E diagnostic report', conclusion: 'No acute findings' },
    });
    expect(result.status()).toBe(200);
    const signed = (await result.json()).data;
    expect(signed.patientRecordUpdated).toBe(false);
    expect(await prisma.visit.count({ where: { patientId } })).toBe(visitCountBefore);

    const clinicRead = await api.get(`${BASE}/api/diagnostics/referrals/${referral.id}`, {
      headers: auth(ownerToken),
    });
    expect(clinicRead.status()).toBe(200);
    const clinicReferral = (await clinicRead.json()).data;
    expect(clinicReferral.id).toBe(referral.id);
    expect(clinicReferral.result || clinicReferral.results || clinicReferral.reportText).toBeTruthy();
  });

  test('PARTNER-002: medical laboratory order → full lifecycle → result → delivered', async () => {
    const lab = { id: fixtureLabId };
    expect(lab.id).toBeTruthy();

    const clinic = await prisma.clinic.findFirst({ where: { name: 'E2E Clinic A' }, select: { id: true } });
    const clinicId = clinic?.id;

    const orderRes = await api.post(`${BASE}/api/lab-orders/medical-laboratory/orders`, {
      headers: auth(ownerToken),
      data: { clinicId, patientId, labId: lab.id, priority: 'routine', specimenType: 'blood' },
    });
    expect(orderRes.status()).toBe(201);
    const order = (await orderRes.json()).data;
    expect(order.status).toBe('ordered');

    const cycle = ['sample_collected', 'received', 'processing', 'result_ready', 'verified'];
    for (const status of cycle) {
      const res = await api.post(`${BASE}/api/lab-orders/medical-laboratory/orders/${order.id}/status`, {
        headers: auth(labOwnerToken),
        data: { status },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).data.status).toBe(status);
    }

    const read = await api.get(`${BASE}/api/lab-orders/medical-laboratory/orders/${order.id}`, { headers: auth(ownerToken) });
    expect(read.status()).toBe(200);
    expect((await read.json()).data.order.status).toBe('verified');
  });
});
