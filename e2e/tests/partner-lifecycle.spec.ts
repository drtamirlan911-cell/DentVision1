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
  let crossClinicDoctorToken = '';
  let patientId = '';
  let doctorId = '';
  const prisma = new PrismaClient();
  let fixtureCenterId = '';
  let fixtureLabId = '';
  let centerOwnerToken = '';
  let centerRadiologistToken = '';
  let centerRadiologistId = '';
  let labOwnerToken = '';
  let dentalLabOwnerToken = '';
  let fixtureDentalLabId = '';
  let fixtureAlternativeDentalLabId = '';
  let dentalTechnicianId = '';
  let dentalTechnicianToken = '';
  const rb037UserIds: string[] = [];
  const rb037ReferralIds: string[] = [];
  const rb037VisitIds: string[] = [];
  const rb037PersonRoleIds: string[] = [];
  const rb037PersonIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    ownerToken = await login(api, 'owner-a@test.com');
    superadminToken = await login(api, 'superadmin@test.com');
    doctorToken = await login(api, 'doctor-a@test.com');
    crossClinicDoctorToken = await login(api, 'doctor-b@test.com');

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
    const centerOwnerRefreshToken = centerPayload.data?.refreshToken || centerPayload.refreshToken ||
      (await api.storageState()).cookies.find((cookie) => cookie.name === 'refreshToken')?.value;
    expect(centerOwnerRefreshToken).toBeTruthy();
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

    await prisma.branchMember.create({
      data: {
        personId: radiologistPerson.id,
        branchId: centerTokenPayload.branchId!,
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
    const radiologistTokenPayload = JSON.parse(Buffer.from(centerRadiologistToken.split('.')[1], 'base64url').toString('utf8')) as { role?: string; personType?: string; organizationType?: string };
    expect(radiologistTokenPayload.role).toBe('DOCTOR');
    expect(radiologistTokenPayload.personType).toBe('RADIOLOGIST');
    expect(radiologistTokenPayload.organizationType).toBe('DIAGNOSTIC_CENTER');

    // Refresh the diagnostic-center owner's scoped token captured at onboarding.
    // The shared APIRequestContext has since logged in the radiologist and its cookie
    // jar now belongs to that second user.
    const refreshRes = await api.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: centerOwnerRefreshToken },
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

    expect(centerOrgId).toBeTruthy();
    const branchList = await api.get(
      `${BASE}/api/organizations/branches?organizationId=${encodeURIComponent(centerOrgId)}`,
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

    const dentalLabOwner = await createTestUser({ email: `dental-lab-owner-${Date.now()}@test.dentvision`, firstName: 'Dental Lab', lastName: 'Owner' });
    const dentalLabBaseToken = await login(api, dentalLabOwner.email);
    const dentalLabOnboard = await api.post(`${BASE}/api/organizations/self-service`, {
      headers: auth(dentalLabBaseToken),
      data: { type: 'dental_lab', name: `E2E Dental Lab ${Date.now()}`, city: 'Тараз' },
    });
    expect(dentalLabOnboard.status()).toBe(201);
    const dentalLabPayload = await dentalLabOnboard.json();
    fixtureDentalLabId = dentalLabPayload.data?.entityId;
    dentalLabOwnerToken = dentalLabPayload.data?.accessToken || dentalLabPayload.accessToken;
    expect(fixtureDentalLabId).toBeTruthy();
    expect(dentalLabOwnerToken).toBeTruthy();
    const dentalLabClaims = JSON.parse(Buffer.from(dentalLabOwnerToken.split('.')[1], 'base64url').toString('utf8')) as { role?: string; organizationType?: string; organizationId?: string };
    expect(dentalLabClaims.role).toBe('DENTAL_LAB_OWNER');
    expect(dentalLabClaims.organizationType).toBe('LABORATORY');
    expect(dentalLabClaims.organizationId).toBeTruthy();
    const approveDentalPartner = async (organizationId: string) => {
      const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
      const settings = org?.settings && typeof org.settings === 'object' ? org.settings as Record<string, unknown> : {};
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          settings: {
            ...settings,
            laboratoryType: 'DENTAL_LAB',
            selfServiceType: 'dental_lab',
            lifecycle: 'ACTIVE',
            verification: 'VERIFIED',
            ecosystemVisible: true,
            legal: {
              ...((settings.legal && typeof settings.legal === 'object') ? settings.legal as Record<string, unknown> : {}),
              status: 'READY',
            },
          },
        },
      });
    };
    await approveDentalPartner(dentalLabClaims.organizationId);

    const alternativeDentalOwner = await createTestUser({ email: `dental-lab-alt-${Date.now()}@test.dentvision`, firstName: 'Alternative', lastName: 'Dental Lab' });
    const alternativeDentalBaseToken = await login(api, alternativeDentalOwner.email);
    const alternativeDentalOnboard = await api.post(`${BASE}/api/organizations/self-service`, {
      headers: auth(alternativeDentalBaseToken),
      data: { type: 'dental_lab', name: `E2E Alternative Dental Lab ${Date.now()}`, city: 'Тараз' },
    });
    expect(alternativeDentalOnboard.status()).toBe(201);
    const alternativeDentalPayload = await alternativeDentalOnboard.json();
    fixtureAlternativeDentalLabId = alternativeDentalPayload.data?.entityId;
    const alternativeDentalToken = alternativeDentalPayload.data?.accessToken || alternativeDentalPayload.accessToken;
    expect(fixtureAlternativeDentalLabId).toBeTruthy();
    expect(alternativeDentalToken).toBeTruthy();
    const alternativeDentalClaims = JSON.parse(Buffer.from(alternativeDentalToken.split('.')[1], 'base64url').toString('utf8')) as { organizationId?: string };
    expect(alternativeDentalClaims.organizationId).toBeTruthy();
    await approveDentalPartner(alternativeDentalClaims.organizationId);

    const dentalTechnician = await createTestUser({ email: `dental-technician-${Date.now()}@test.dentvision`, firstName: 'Dental', lastName: 'Technician', role: 'STUDENT' as any });
    dentalTechnicianId = dentalTechnician.id;
    await prisma.laboratoryMember.upsert({
      where: { labId_userId: { labId: fixtureDentalLabId, userId: dentalTechnicianId } },
      update: { role: 'technician' },
      create: { id: randomUUID(), labId: fixtureDentalLabId, userId: dentalTechnicianId, role: 'technician' },
    });
    const technicianPerson = await prisma.person.upsert({
      where: { userId_organizationId: { userId: dentalTechnicianId, organizationId: dentalLabClaims.organizationId! } },
      update: { fullName: 'Dental Technician', personType: 'STAFF', email: dentalTechnician.email },
      create: {
        id: randomUUID(), fullName: 'Dental Technician', personType: 'STAFF',
        organizationId: dentalLabClaims.organizationId!, userId: dentalTechnicianId, email: dentalTechnician.email,
      },
    });
    const technicianRole = await prisma.role.findUnique({ where: { key: 'dental_technician' }, select: { id: true } });
    expect(technicianRole?.id).toBeTruthy();
    const technicianScopeKey = `organization:${dentalLabClaims.organizationId}`;
    await prisma.personRole.upsert({
      where: { personId_roleId_scopeKey: { personId: technicianPerson.id, roleId: technicianRole!.id, scopeKey: technicianScopeKey } },
      update: { scopeType: 'organization', scopeId: dentalLabClaims.organizationId },
      create: {
        id: randomUUID(), personId: technicianPerson.id, roleId: technicianRole!.id,
        scopeType: 'organization', scopeId: dentalLabClaims.organizationId, scopeKey: technicianScopeKey,
      },
    });
    const dentalTechnicianBaseToken = await login(api, dentalTechnician.email);
    const technicianContextsRes = await api.get(`${BASE}/api/iam/me/contexts`, { headers: auth(dentalTechnicianBaseToken) });
    expect(technicianContextsRes.status()).toBe(200);
    const technicianContexts = (await technicianContextsRes.json()).data?.contexts || [];
    const technicianContext = technicianContexts.find((item: any) => item.scopeType === 'LABORATORY' && item.organizationId === dentalLabClaims.organizationId);
    expect(technicianContext).toBeTruthy();
    const technicianBranch = technicianContext.branchId || (await prisma.branch.findFirst({
      where: { organizationId: dentalLabClaims.organizationId!, active: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    }))?.id;
    expect(technicianBranch).toBeTruthy();
    // Context switching validates branch membership independently from the
    // organization-scoped PersonRole. Grant this technician the actual branch
    // assignment; the route must continue to reject unrelated branches.
    await prisma.branchMember.upsert({
      where: { personId_branchId: { personId: technicianPerson.id, branchId: technicianBranch! } },
      update: { active: true },
      create: { id: randomUUID(), personId: technicianPerson.id, branchId: technicianBranch!, active: true },
    });
    const switchedTechnician = await api.post(`${BASE}/api/iam/switch-context`, {
      headers: auth(dentalTechnicianBaseToken),
      data: { scopeType: technicianContext.scopeType, scopeId: technicianContext.scopeId, branchId: technicianBranch },
    });
    const switchedTechnicianBody = await switchedTechnician.json();
    expect(switchedTechnician.status(), JSON.stringify(switchedTechnicianBody)).toBe(200);
    dentalTechnicianToken = switchedTechnicianBody.data.accessToken;
    const dentalTechnicianClaims = JSON.parse(Buffer.from(dentalTechnicianToken.split('.')[1], 'base64url').toString('utf8')) as { role?: string; organizationType?: string; organizationId?: string };
    // The canonical PersonRole remains dental_technician; the legacy JWT enum
    // compatibility claim is LAB and must never be used as the partner role key.
    expect(dentalTechnicianClaims.role).toBe('LAB');
    expect(dentalTechnicianClaims.organizationType).toBe('LABORATORY');
    expect(dentalTechnicianClaims.organizationId).toBe(dentalLabClaims.organizationId);

    const patient = await api.post(`${BASE}/api/patients`, {
      headers: auth(ownerToken),
      data: { iin: makeIin(), firstName: 'Partner', lastName: 'Lifecycle', phone: `+7700${Date.now() % 10000000}` },
    });
    expect(patient.status()).toBe(201);
    patientId = (await patient.json()).data?.id || (await patient.json()).id;
  });

  test.afterAll(async () => {
    if (rb037VisitIds.length) {
      await prisma.visit.deleteMany({ where: { id: { in: rb037VisitIds } } }).catch(() => {});
    }
    if (rb037ReferralIds.length) {
      await prisma.referral.deleteMany({ where: { id: { in: rb037ReferralIds } } }).catch(() => {});
    }
    if (rb037PersonRoleIds.length) {
      await prisma.personRole.deleteMany({ where: { id: { in: rb037PersonRoleIds } } }).catch(() => {});
    }
    if (rb037PersonIds.length) {
      await prisma.person.deleteMany({ where: { id: { in: rb037PersonIds } } }).catch(() => {});
    }
    for (const userId of rb037UserIds) {
      await prisma.clinicMember.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.personRole.deleteMany({ where: { person: { userId } } }).catch(() => {});
      await prisma.person.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (dentalTechnicianId) {
      await prisma.personRole.deleteMany({ where: { person: { userId: dentalTechnicianId } } }).catch(() => {});
      await prisma.person.deleteMany({ where: { userId: dentalTechnicianId } }).catch(() => {});
      await prisma.laboratoryMember.deleteMany({ where: { userId: dentalTechnicianId } }).catch(() => {});
      await prisma.user.delete({ where: { id: dentalTechnicianId } }).catch(() => {});
    }
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
    const resultBody = await result.json();
    expect(result.status(), JSON.stringify(resultBody)).toBe(200);
    const signed = resultBody.data;
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

  test('RB-037: clinic diagnostic confirmation and signing are doctor-only', async () => {
    const clinic = await prisma.clinic.findFirst({ where: { name: 'E2E Clinic A' }, select: { id: true } });
    expect(clinic?.id).toBeTruthy();
    const clinicId = clinic!.id;
    const branchRows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM branches WHERE clinic_id = ${clinicId} AND "isDefault" = true LIMIT 1`;
    const branchId = branchRows[0]?.id;
    expect(branchId).toBeTruthy();

    const operationalRoles = [
      { role: 'ADMIN', roleKey: 'admin' },
      { role: 'MANAGER', roleKey: 'manager' },
      { role: 'ASSISTANT', roleKey: 'assistant' },
    ] as const;
    const operationalTokens: string[] = [];
    const organization = await prisma.organization.findFirst({
      where: { originalType: 'Clinic', originalId: clinicId },
      select: { id: true },
    });

    for (const entry of operationalRoles) {
      const email = `rb037-${entry.role.toLowerCase()}-${randomUUID()}@test.dentvision`;
      const user = await createTestUser({ email, firstName: 'RB037', lastName: entry.role, role: entry.role as any });
      rb037UserIds.push(user.id);
      await prisma.clinicMember.create({
        data: { userId: user.id, clinicId, role: entry.role as any },
      });
      await prisma.$executeRaw`UPDATE "clinic_members" SET branch_id = ${branchId} WHERE "userId" = ${user.id} AND "clinicId" = ${clinicId}`;

      if (organization) {
        const person = await prisma.person.create({
          data: {
            id: randomUUID(),
            fullName: `RB037 ${entry.role}`,
            personType: 'CLINIC_STAFF',
            organizationId: organization.id,
            userId: user.id,
          },
        });
        const role = await prisma.role.findUnique({ where: { key: entry.roleKey }, select: { id: true } });
        expect(role?.id, `missing seeded clinic role ${entry.roleKey}`).toBeTruthy();
        await prisma.personRole.create({
          data: {
            id: randomUUID(),
            personId: person.id,
            roleId: role!.id,
            scopeType: 'organization',
            scopeId: organization.id,
            scopeKey: `organization:${organization.id}`,
          },
        });
      }
      operationalTokens.push(await login(api, email));
    }

    const createReferral = async (suffix: string, assignedDoctorId = doctorId) => {
      const referral = await prisma.referral.create({
        data: {
          clinicId,
          branchId,
          patientId,
          doctorId: assignedDoctorId,
          patientName: `RB037 ${suffix}`,
          category: 'CBCT',
          studyType: 'CBCT',
          status: 'DRAFT',
        },
      });
      rb037ReferralIds.push(referral.id);
      return referral;
    };

    // AI confirmation: operational users and SUPERADMIN cannot acknowledge
    // an AI draft or move the referral into COMPLETED.
    const aiReferral = await createReferral('AI confirmation');
    await prisma.diagnosticResult.create({
      data: { referralId: aiReferral.id, reportText: 'RB037 AI draft', aiGenerated: true },
    });
    for (const token of [ownerToken, ...operationalTokens, superadminToken, crossClinicDoctorToken]) {
      const denied = await api.post(`${BASE}/api/diagnostics/referrals/${aiReferral.id}/confirm-ai-result`, {
        headers: auth(token),
      });
      expect(denied.status(), `non-doctor token must be denied AI confirmation`).toBe(403);
    }
    const unsignedAi = await prisma.diagnosticResult.findUnique({ where: { referralId: aiReferral.id } });
    const unchangedAiReferral = await prisma.referral.findUnique({ where: { id: aiReferral.id } });
    expect(unsignedAi?.signedAt).toBeNull();
    expect(unchangedAiReferral?.status).toBe('DRAFT');

    const confirmed = await api.post(`${BASE}/api/diagnostics/referrals/${aiReferral.id}/confirm-ai-result`, {
      headers: auth(doctorToken),
    });
    expect(confirmed.status(), JSON.stringify(await confirmed.json())).toBe(200);
    const confirmedResult = await prisma.diagnosticResult.findUnique({ where: { referralId: aiReferral.id } });
    expect(confirmedResult?.signedBy).toBe(doctorId);
    expect(confirmedResult?.signedAt).toBeTruthy();

    // Clinical chart signing: denied actors must not create a DiagnosticResult,
    // complete the referral, or insert a Visit. The assigned clinic doctor can.
    const signReferral = await createReferral('result signing');
    const visitsBefore = await prisma.visit.count({ where: { patientId } });
    for (const token of [ownerToken, ...operationalTokens, superadminToken, crossClinicDoctorToken]) {
      const denied = await api.post(`${BASE}/api/diagnostics/referrals/${signReferral.id}/results/sign`, {
        headers: auth(token),
        data: { reportText: 'Unauthorized RB037 report', conclusion: 'Must not be stored' },
      });
      expect(denied.status(), `non-doctor token must be denied result signing`).toBe(403);
    }
    expect(await prisma.diagnosticResult.findUnique({ where: { referralId: signReferral.id } })).toBeNull();
    expect((await prisma.referral.findUnique({ where: { id: signReferral.id } }))?.status).toBe('DRAFT');
    expect(await prisma.visit.count({ where: { patientId } })).toBe(visitsBefore);

    const signedConclusion = `RB037 doctor verified ${randomUUID()}`;
    const signed = await api.post(`${BASE}/api/diagnostics/referrals/${signReferral.id}/results/sign`, {
      headers: auth(doctorToken),
      data: { reportText: 'Authorized RB037 report', conclusion: signedConclusion },
    });
    const signedBody = await signed.json();
    expect(signed.status(), JSON.stringify(signedBody)).toBe(200);
    expect(signedBody.data.patientRecordUpdated).toBe(true);
    const storedResult = await prisma.diagnosticResult.findUnique({ where: { referralId: signReferral.id } });
    expect(storedResult?.signedBy).toBe(doctorId);
    expect(storedResult?.signedAt).toBeTruthy();
    expect(await prisma.visit.count({ where: { patientId } })).toBe(visitsBefore + 1);
    const createdVisit = await prisma.visit.findFirst({
      where: { patientId, doctorId, notes: { contains: signReferral.id.slice(0, 8) } },
      select: { id: true },
    });
    expect(createdVisit?.id).toBeTruthy();
    if (createdVisit?.id) rb037VisitIds.push(createdVisit.id);

    // Master Spec 5.0 allows OWNER + DOCTOR in the same clinic context.
    // A management-primary user must retain clinical actions only when a
    // separate scoped DOCTOR PersonRole and branch assignment exist.
    expect(organization?.id).toBeTruthy();
    const ownerUser = await prisma.user.findUnique({
      where: { email: 'owner-a@test.com' },
      select: { id: true },
    });
    expect(ownerUser?.id).toBeTruthy();
    let ownerPerson = await prisma.person.findFirst({
      where: { userId: ownerUser!.id, organizationId: organization!.id },
      select: { id: true },
    });
    if (!ownerPerson) {
      ownerPerson = await prisma.person.create({
        data: {
          id: randomUUID(),
          fullName: 'RB037 Owner Doctor',
          personType: 'DOCTOR',
          organizationId: organization!.id,
          userId: ownerUser!.id,
        },
        select: { id: true },
      });
      rb037PersonIds.push(ownerPerson.id);
    }
    const doctorRole = await prisma.role.findUnique({ where: { key: 'doctor' }, select: { id: true } });
    expect(doctorRole?.id).toBeTruthy();
    const ownerDoctorRole = await prisma.personRole.findFirst({
      where: {
        personId: ownerPerson!.id,
        roleId: doctorRole!.id,
        scopeType: 'organization',
        scopeId: organization!.id,
      },
      select: { id: true },
    });
    if (!ownerDoctorRole) {
      const createdRole = await prisma.personRole.create({
        data: {
          id: randomUUID(),
          personId: ownerPerson!.id,
          roleId: doctorRole!.id,
          scopeType: 'organization',
          scopeId: organization!.id,
          scopeKey: `organization:${organization!.id}`,
        },
        select: { id: true },
      });
      rb037PersonRoleIds.push(createdRole.id);
    }

    const ownerDoctorAiReferral = await createReferral('owner plus doctor AI confirmation', ownerUser!.id);
    await prisma.diagnosticResult.create({
      data: { referralId: ownerDoctorAiReferral.id, reportText: 'RB037 owner-doctor AI draft', aiGenerated: true },
    });
    const ownerDoctorConfirmation = await api.post(`${BASE}/api/diagnostics/referrals/${ownerDoctorAiReferral.id}/confirm-ai-result`, {
      headers: auth(ownerToken),
    });
    expect(ownerDoctorConfirmation.status(), JSON.stringify(await ownerDoctorConfirmation.json())).toBe(200);
    const ownerDoctorAiResult = await prisma.diagnosticResult.findUnique({ where: { referralId: ownerDoctorAiReferral.id } });
    expect(ownerDoctorAiResult?.signedBy).toBe(ownerUser!.id);

    const ownerDoctorSignReferral = await createReferral('owner plus doctor clinical signing', ownerUser!.id);
    const ownerVisitsBefore = await prisma.visit.count({ where: { patientId } });
    const ownerDoctorSign = await api.post(`${BASE}/api/diagnostics/referrals/${ownerDoctorSignReferral.id}/results/sign`, {
      headers: auth(ownerToken),
      data: { reportText: 'Authorized owner-doctor report', conclusion: 'Owner with scoped doctor role' },
    });
    const ownerDoctorSignBody = await ownerDoctorSign.json();
    expect(ownerDoctorSign.status(), JSON.stringify(ownerDoctorSignBody)).toBe(200);
    expect(ownerDoctorSignBody.data.patientRecordUpdated).toBe(true);
    const ownerDoctorResult = await prisma.diagnosticResult.findUnique({ where: { referralId: ownerDoctorSignReferral.id } });
    expect(ownerDoctorResult?.signedBy).toBe(ownerUser!.id);
    expect(await prisma.visit.count({ where: { patientId } })).toBe(ownerVisitsBefore + 1);
    const ownerDoctorVisit = await prisma.visit.findFirst({
      where: { patientId, doctorId: ownerUser!.id, notes: { contains: ownerDoctorSignReferral.id.slice(0, 8) } },
      select: { id: true },
    });
    expect(ownerDoctorVisit?.id).toBeTruthy();
    if (ownerDoctorVisit?.id) rb037VisitIds.push(ownerDoctorVisit.id);
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
  test('PARTNER-003: dental lab owner → clinic assignment → technician → production → delivery → tenant isolation', async () => {
    expect(fixtureDentalLabId).toBeTruthy();
    expect(dentalLabOwnerToken).toBeTruthy();

    const createOrder = await api.post(`${BASE}/api/lab-orders`, {
      headers: auth(ownerToken),
      data: {
        patientId,
        patientName: 'Dental Lab Partner Lifecycle',
        labType: 'crown',
        material: 'zirconia',
        toothNumber: '36',
        shade: 'A2',
        price: 45000,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(createOrder.status()).toBe(201);
    const order = (await createOrder.json()).data;
    expect(order.status).toBe('pending');

    const availablePartners = await api.get(`${BASE}/api/lab-orders/platform/available-laboratories`, { headers: auth(ownerToken) });
    expect(availablePartners.status()).toBe(200);
    const availablePartnerIds = ((await availablePartners.json()).data || []).map((lab: any) => lab.id);
    expect(availablePartnerIds).toContain(fixtureDentalLabId);
    expect(availablePartnerIds).toContain(fixtureAlternativeDentalLabId);
    expect(availablePartnerIds).not.toContain(fixtureLabId);

    const assignment = await api.post(`${BASE}/api/lab-orders/platform/assign`, {
      headers: auth(ownerToken),
      data: { orderId: order.id, laboratoryId: fixtureDentalLabId },
    });
    expect(assignment.status()).toBe(200);

    const assignedLifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, { headers: auth(dentalLabOwnerToken) });
    expect(assignedLifecycle.status()).toBe(200);
    const initialEventCount = (await assignedLifecycle.json()).data.events.length;
    const repeatedAssignment = await api.post(`${BASE}/api/lab-orders/platform/assign`, {
      headers: auth(ownerToken),
      data: { orderId: order.id, laboratoryId: fixtureDentalLabId },
    });
    expect(repeatedAssignment.status()).toBe(200);
    expect((await repeatedAssignment.json()).data.assignmentIdempotent).toBe(true);
    const repeatedLifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, { headers: auth(dentalLabOwnerToken) });
    expect((await repeatedLifecycle.json()).data.events.length).toBe(initialEventCount);

    const reassignment = await api.post(`${BASE}/api/lab-orders/platform/assign`, {
      headers: auth(ownerToken),
      data: { orderId: order.id, laboratoryId: fixtureAlternativeDentalLabId },
    });
    const reassignmentBody = await reassignment.json();
    expect(reassignment.status(), JSON.stringify(reassignmentBody)).toBe(409);
    expect(reassignmentBody.code).toBe('LAB_ORDER_ALREADY_ASSIGNED');

    const clinicCannotEditPartnerOrder = await api.post(`${BASE}/api/lab-orders`, {
      headers: auth(ownerToken),
      data: { id: order.id, notes: 'clinic must not change delegated work', status: 'delivered' },
    });
    const clinicEditBody = await clinicCannotEditPartnerOrder.json();
    expect(clinicCannotEditPartnerOrder.status(), JSON.stringify(clinicEditBody)).toBe(409);
    expect(clinicEditBody.code).toBe('LAB_PARTNER_WORKFLOW_OWNED');

    const clinicCannotDeletePartnerOrder = await api.delete(`${BASE}/api/lab-orders/${order.id}`, { headers: auth(ownerToken) });
    const clinicDeleteBody = await clinicCannotDeletePartnerOrder.json();
    expect(clinicCannotDeletePartnerOrder.status(), JSON.stringify(clinicDeleteBody)).toBe(409);
    expect(clinicDeleteBody.code).toBe('LAB_PARTNER_WORKFLOW_OWNED');

    const clinicCannotDirectlyAssign = await api.post(`${BASE}/api/lab-orders`, {
      headers: auth(ownerToken),
      data: { patientId, patientName: 'Direct assignment must fail', laboratoryId: fixtureDentalLabId },
    });
    const directAssignBody = await clinicCannotDirectlyAssign.json();
    expect(clinicCannotDirectlyAssign.status(), JSON.stringify(directAssignBody)).toBe(400);
    expect(directAssignBody.code).toBe('LAB_ASSIGNMENT_REQUIRED');

    const clinicCannotAdvancePartnerOrder = await api.patch(`${BASE}/api/lab-orders/${order.id}/status`, {
      headers: auth(ownerToken), data: { status: 'sent' },
    });
    const clinicBlockedBody = await clinicCannotAdvancePartnerOrder.json();
    expect(clinicCannotAdvancePartnerOrder.status(), JSON.stringify(clinicBlockedBody)).toBe(409);
    expect(clinicBlockedBody.code).toBe('LAB_PARTNER_WORKFLOW_OWNED');

    const unrelatedOrderRes = await api.post(`${BASE}/api/lab-orders`, {
      headers: auth(ownerToken),
      data: { patientId, patientName: 'Unassigned to technician', labType: 'inlay', material: 'ceramic', toothNumber: '16', price: 25000 },
    });
    expect(unrelatedOrderRes.status()).toBe(201);
    const unrelatedOrder = (await unrelatedOrderRes.json()).data;
    const unrelatedAssignment = await api.post(`${BASE}/api/lab-orders/platform/assign`, {
      headers: auth(ownerToken), data: { orderId: unrelatedOrder.id, laboratoryId: fixtureDentalLabId },
    });
    expect(unrelatedAssignment.status()).toBe(200);

    const dashboard = await api.get(`${BASE}/api/lab-orders/platform/dashboard`, { headers: auth(dentalLabOwnerToken) });
    expect(dashboard.status()).toBe(200);
    const dashboardData = (await dashboard.json()).data;
    expect(dashboardData.lab.id).toBe(fixtureDentalLabId);
    expect(dashboardData.totals.all).toBeGreaterThanOrEqual(2);

    const team = await api.get(`${BASE}/api/lab-orders/platform/team`, { headers: auth(dentalLabOwnerToken) });
    expect(team.status()).toBe(200);
    expect((await team.json()).data.some((member: any) => member.id === dentalTechnicianId)).toBe(true);

    const technician = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/technician`, {
      headers: auth(dentalLabOwnerToken),
      data: { technicianId: dentalTechnicianId },
    });
    expect(technician.status()).toBe(200);
    expect((await technician.json()).data.technicianId).toBe(dentalTechnicianId);

    const technicianOrders = await api.get(`${BASE}/api/lab-orders/platform/orders`, { headers: auth(dentalTechnicianToken) });
    expect(technicianOrders.status()).toBe(200);
    const technicianOrderRows = (await technicianOrders.json()).data || [];
    expect(technicianOrderRows.map((item: any) => item.id)).toEqual([order.id]);
    const technicianDashboard = await api.get(`${BASE}/api/lab-orders/platform/dashboard`, { headers: auth(dentalTechnicianToken) });
    expect(technicianDashboard.status()).toBe(200);
    expect((await technicianDashboard.json()).data.totals.all).toBe(1);
    const technicianTeam = await api.get(`${BASE}/api/lab-orders/platform/team`, { headers: auth(dentalTechnicianToken) });
    expect(technicianTeam.status()).toBe(403);
    const technicianCannotReadOtherLifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/lifecycle`, { headers: auth(dentalTechnicianToken) });
    expect(technicianCannotReadOtherLifecycle.status()).toBe(404);

    const sent = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/status`, {
      headers: auth(dentalLabOwnerToken), data: { status: 'sent', note: 'PARTNER-003 accepted by manager' },
    });
    expect(sent.status()).toBe(200);
    for (const status of ['in_progress', 'try_in', 'adjustment', 'qc']) {
      const res = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/status`, {
        headers: auth(dentalTechnicianToken),
        data: { status, note: `PARTNER-003 technician ${status}` },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).data.status).toBe(status);
    }
    const technicianCannotDeliver = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/status`, {
      headers: auth(dentalTechnicianToken), data: { status: 'delivered' },
    });
    expect(technicianCannotDeliver.status()).toBe(403);
    const technicianCannotApproveQc = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/qc`, {
      headers: auth(dentalTechnicianToken),
      data: { checks: { fit: true, margins: true, shade: true, occlusion: true, surface: true, documentation: true }, note: 'technician cannot approve QC' },
    });
    expect(technicianCannotApproveQc.status()).toBe(403);
    const qcBypass = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/status`, {
      headers: auth(dentalLabOwnerToken), data: { status: 'ready' },
    });
    expect(qcBypass.status()).toBe(409);

    const qc = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/qc`, {
      headers: auth(dentalLabOwnerToken),
      data: { checks: { fit: true, margins: true, shade: true, occlusion: true, surface: true, documentation: true }, note: 'PARTNER-003 QC approved' },
    });
    expect(qc.status()).toBe(200);
    expect((await qc.json()).data.status).toBe('ready');
    const clinicOwnerMember = await prisma.clinicMember.findFirst({
      where: { clinicId: order.clinicId, role: 'OWNER' },
      select: { userId: true },
    });
    expect(clinicOwnerMember?.userId).toBeTruthy();
    await expect.poll(
      () => prisma.notification.count({
        where: {
          userId: clinicOwnerMember!.userId,
          title: 'Лабораторный заказ готов',
          link: `/lab?order=${order.id}`,
        },
      }),
      { timeout: 10_000, interval: 250 },
    ).toBeGreaterThan(0);

    const delivered = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/status`, {
      headers: auth(dentalLabOwnerToken),
      data: { status: 'delivered', note: 'PARTNER-003 delivered after QC' },
    });
    expect(delivered.status()).toBe(200);
    expect((await delivered.json()).data.status).toBe('delivered');

    // Delivery confirms operational completion, not a commercial settlement.
    // Allow the in-process event queue to drain, then assert there is no partner
    // economics transaction (and therefore no delivery-triggered ledger snapshot).
    await new Promise((resolve) => setTimeout(resolve, 500));
    const deliveryEconomics = await prisma.transaction.findMany({
      where: { type: 'partner_economics', refType: 'DENTAL_LAB', refId: order.id },
      include: { ledgerEntries: true },
    });
    expect(deliveryEconomics, 'delivered dental-lab orders must not create economics before settlement').toHaveLength(0);

    const lifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, {
      headers: auth(dentalLabOwnerToken),
    });
    expect(lifecycle.status()).toBe(200);
    const lifecycleData = (await lifecycle.json()).data;
    expect(lifecycleData.events.length).toBeGreaterThanOrEqual(8);
    expect(lifecycleData.events[0].fromStatus).toBeNull();
    expect(lifecycleData.events[0].note).toContain('Передан в лабораторию');

    const clinicRead = await api.get(`${BASE}/api/lab-orders`, { headers: auth(ownerToken) });
    expect(clinicRead.status()).toBe(200);
    const clinicOrder = ((await clinicRead.json()).data || []).find((item: any) => item.id === order.id);
    expect(clinicOrder).toBeTruthy();
    expect(clinicOrder.status).toBe('delivered');
    expect(clinicOrder.laboratoryId).toBe(fixtureDentalLabId);

    const otherLabRead = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, {
      headers: auth(labOwnerToken),
    });
    expect(otherLabRead.status()).toBe(404);
  });

});
