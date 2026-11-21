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
  let labOwnerId = '';
  let fixtureLabOrganizationId = '';
  let medicalLabTechnicianId = '';
  let medicalLabQualityId = '';
  let medicalLabValidatorId = '';
  let medicalLabDoctorId = '';
  let medicalLabTechnicianToken = '';
  let medicalLabQualityToken = '';
  let medicalLabValidatorToken = '';
  let medicalLabDoctorToken = '';
  const medicalLabUserIds: string[] = [];
  const medicalLabOrderIds: string[] = [];
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
    const radiologistInvite = await api.post(`${BASE}/api/iam/invitations`, {
      headers: auth(centerOwnerToken),
      data: { organizationId: centerOrgId, role: 'radiologist', email: radiologist.email },
    });
    expect(radiologistInvite.status(), await radiologistInvite.text()).toBe(201);
    const radiologistInviteCode = (await radiologistInvite.json()).data.code;
    expect(radiologistInviteCode).toMatch(/^[0-9A-F]{8}$/);

    const radiologistBaseToken = await login(api, radiologist.email);
    const radiologistJoin = await api.post(`${BASE}/api/iam/join-by-invite`, {
      headers: auth(radiologistBaseToken),
      data: { code: radiologistInviteCode },
    });
    expect(radiologistJoin.status(), await radiologistJoin.text()).toBe(201);
    const radiologistContextsRes = await api.get(`${BASE}/api/iam/me/contexts`, { headers: auth(radiologistBaseToken) });
    expect(radiologistContextsRes.status()).toBe(200);
    const radiologistContexts = (await radiologistContextsRes.json()).data?.contexts || [];
    const radiologistContext = radiologistContexts.find((item: any) => item.scopeType === 'DIAGNOSTIC_CENTER' && item.organizationId === centerOrgId);
    expect(radiologistContext).toBeTruthy();
    expect(radiologistContext.roleKey).toBe('diagnostic_radiologist');
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

    const labOwner = await createTestUser({ email: `medical-lab-owner-${Date.now()}@test.dentvision`, firstName: 'Medical Lab', lastName: 'Owner', role: 'STUDENT' as any });
    labOwnerId = labOwner.id;
    medicalLabUserIds.push(labOwner.id);
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
    const labOwnerClaims = JSON.parse(Buffer.from(labOwnerToken.split('.')[1], 'base64url').toString('utf8')) as { organizationId?: string; organizationType?: string };
    fixtureLabOrganizationId = String(labOwnerClaims.organizationId || '');
    expect(labOwnerClaims.organizationType).toBe('LABORATORY');
    expect(fixtureLabOrganizationId).toBeTruthy();

    const createMedicalLabRole = async (label: string, roleKey: string) => {
      const user = await createTestUser({
        email: 'medical-lab-' + label + '-' + Date.now() + '@test.dentvision',
        firstName: 'Medical Lab',
        lastName: label,
        role: 'STUDENT' as any,
      });
      medicalLabUserIds.push(user.id);
      const person = await prisma.person.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: fixtureLabOrganizationId } },
        update: { fullName: 'Medical Lab ' + label, personType: 'STAFF', email: user.email },
        create: {
          id: randomUUID(), fullName: 'Medical Lab ' + label, personType: 'STAFF',
          organizationId: fixtureLabOrganizationId, userId: user.id, email: user.email,
        },
      });
      const role = await prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });
      expect(role?.id, 'canonical partner role ' + roleKey).toBeTruthy();
      const scopeKey = 'organization:' + fixtureLabOrganizationId;
      await prisma.personRole.upsert({
        where: { personId_roleId_scopeKey: { personId: person.id, roleId: role!.id, scopeKey } },
        update: { scopeType: 'organization', scopeId: fixtureLabOrganizationId },
        create: {
          id: randomUUID(), personId: person.id, roleId: role!.id,
          scopeType: 'organization', scopeId: fixtureLabOrganizationId, scopeKey,
        },
      });
      await prisma.laboratoryMember.upsert({
        where: { labId_userId: { labId: fixtureLabId, userId: user.id } },
        update: { role: 'technician' },
        create: { id: randomUUID(), labId: fixtureLabId, userId: user.id, role: 'technician' },
      });
      const baseToken = await login(api, user.email);
      const contextsResponse = await api.get(BASE + '/api/iam/me/contexts', { headers: auth(baseToken) });
      expect(contextsResponse.status()).toBe(200);
      const contexts = (await contextsResponse.json()).data?.contexts || [];
      const context = contexts.find((item: any) => item.scopeType === 'LABORATORY' && item.organizationId === fixtureLabOrganizationId);
      expect(context, 'medical lab context for ' + roleKey).toBeTruthy();
      const switched = await api.post(BASE + '/api/iam/switch-context', {
        headers: auth(baseToken),
        data: { scopeType: 'LABORATORY', scopeId: fixtureLabId },
      });
      expect(switched.status()).toBe(200);
      const token = (await switched.json()).data.accessToken as string;
      expect(token).toBeTruthy();
      return { id: user.id, token };
    };

    const medicalTechnician = await createMedicalLabRole('technician', 'medical_lab_technician');
    medicalLabTechnicianId = medicalTechnician.id;
    medicalLabTechnicianToken = medicalTechnician.token;
    const medicalQuality = await createMedicalLabRole('quality', 'medical_lab_quality');
    medicalLabQualityId = medicalQuality.id;
    medicalLabQualityToken = medicalQuality.token;
    const medicalValidator = await createMedicalLabRole('validator', 'medical_lab_validator');
    medicalLabValidatorId = medicalValidator.id;
    medicalLabValidatorToken = medicalValidator.token;
    const medicalDoctor = await createMedicalLabRole('doctor', 'medical_lab_doctor');
    medicalLabDoctorId = medicalDoctor.id;
    medicalLabDoctorToken = medicalDoctor.token;

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
    if (medicalLabOrderIds.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "medical_lab_orders" WHERE "id" = ANY($1::text[])`,
        medicalLabOrderIds,
      ).catch(() => {});
    }
    for (const userId of medicalLabUserIds) {
      await prisma.laboratoryMember.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.personRole.deleteMany({ where: { person: { userId } } }).catch(() => {});
      await prisma.person.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
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

    // Diagnostic-center equipment is owned by the center, assigned only to its
    // own active equipment, and unavailable to clinics or non-manager staff.
    const modalityCreate = await api.post(`${BASE}/api/diagnostics/centers/${centerId}/modalities`, {
      headers: auth(centerOwnerToken),
      data: {
        name: 'E2E CBCT room 1',
        kind: 'CBCT',
        manufacturer: 'E2E Manufacturer',
        model: 'CBCT-1',
        serialNumber: `CBCT-${randomUUID()}`,
        room: 'Кабинет 1',
        aeTitle: 'DVE2ECBCT',
      },
    });
    expect(modalityCreate.status(), await modalityCreate.text()).toBe(201);
    const modality = (await modalityCreate.json()).data;
    expect(modality.centerId).toBe(centerId);
    expect(modality.status).toBe('active');

    const worklist = await api.get(`${BASE}/api/diagnostics/centers/${centerId}/worklist`, {
      headers: auth(centerOwnerToken),
    });
    expect(worklist.status()).toBe(200);
    const worklistItems = (await worklist.json()).data.items;
    const worklistReferral = worklistItems.find((item: any) => item.id === referral.id);
    expect(worklistReferral).toBeTruthy();
    expect(worklistReferral.patientIin).toBeUndefined();
    expect(worklistReferral.patientPhone).toBeUndefined();
    expect(worklistReferral.patientEmail).toBeUndefined();

    const assignModality = await api.patch(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}/modality`,
      { headers: auth(centerOwnerToken), data: { modalityId: modality.id } },
    );
    expect(assignModality.status()).toBe(200);
    expect((await assignModality.json()).data.modalityId).toBe(modality.id);

    const refreshedWorklist = await api.get(`${BASE}/api/diagnostics/centers/${centerId}/worklist`, {
      headers: auth(centerOwnerToken),
    });
    const assignedItem = (await refreshedWorklist.json()).data.items.find((item: any) => item.id === referral.id);
    expect(assignedItem.modality?.id).toBe(modality.id);

    const workItemDetail = await api.get(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}`,
      { headers: auth(centerOwnerToken) },
    );
    expect(workItemDetail.status()).toBe(200);
    const detailBody = (await workItemDetail.json()).data;
    expect(detailBody.referral).toMatchObject({
      id: referral.id,
      patientName: 'Partner Lifecycle',
      status: 'SENT',
    });
    expect(Array.isArray(detailBody.events)).toBe(true);

    const centerOrganization = await prisma.organization.findFirst({
      where: { originalType: 'DiagnosticCenter', originalId: centerId },
      select: { id: true },
    });
    expect(centerOrganization?.id).toBeTruthy();
    const operatorUser = await createTestUser({
      email: `diagnostic-operator-${randomUUID()}@test.dentvision`,
      firstName: 'E2E',
      lastName: 'Operator',
      role: 'STUDENT' as any,
    });
    const operatorInvite = await api.post(`${BASE}/api/iam/invitations`, {
      headers: auth(centerOwnerToken),
      data: { organizationId: centerOrganization!.id, role: 'operator', email: operatorUser.email },
    });
    expect(operatorInvite.status(), await operatorInvite.text()).toBe(201);
    const operatorInviteCode = (await operatorInvite.json()).data.code;
    expect(operatorInviteCode).toMatch(/^[0-9A-F]{8}$/);
    const operatorBaseToken = await login(api, operatorUser.email);
    const operatorJoin = await api.post(`${BASE}/api/iam/join-by-invite`, {
      headers: auth(operatorBaseToken),
      data: { code: operatorInviteCode },
    });
    expect(operatorJoin.status(), await operatorJoin.text()).toBe(201);
    const operatorContextsRes = await api.get(`${BASE}/api/iam/me/contexts`, { headers: auth(operatorBaseToken) });
    expect(operatorContextsRes.status()).toBe(200);
    const operatorContexts = (await operatorContextsRes.json()).data?.contexts || [];
    const operatorContext = operatorContexts.find((item: any) => item.scopeType === 'DIAGNOSTIC_CENTER' && item.organizationId === centerOrganization!.id);
    expect(operatorContext?.roleKey).toBe('diagnostic_operator');
    const switchedOperator = await api.post(`${BASE}/api/iam/switch-context`, {
      headers: auth(operatorBaseToken),
      data: { scopeType: operatorContext.scopeType, scopeId: operatorContext.scopeId, branchId: operatorContext.branchId },
    });
    expect(switchedOperator.status(), await switchedOperator.text()).toBe(200);
    const operatorScopedToken = (await switchedOperator.json()).data.accessToken;
    expect(operatorScopedToken).toBeTruthy();
    const operatorTokenClaims = JSON.parse(Buffer.from(operatorScopedToken.split('.')[1], 'base64url').toString('utf8')) as { role?: string; organizationType?: string };
    expect(operatorTokenClaims.role).toBe('ASSISTANT');
    expect(operatorTokenClaims.organizationType).toBe('DIAGNOSTIC_CENTER');

    const staffList = await api.get(`${BASE}/api/diagnostics/centers/${centerId}/worklist/staff`, {
      headers: auth(centerOwnerToken),
    });
    expect(staffList.status()).toBe(200);
    const staffRows = (await staffList.json()).data;
    expect(staffRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: operatorUser.id, role: 'operator' }),
      expect.objectContaining({ userId: centerRadiologistId, role: 'radiologist' }),
    ]));

    const radiologistCannotReadFullStaffList = await api.get(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/staff`,
      { headers: auth(centerRadiologistToken) },
    );
    expect(radiologistCannotReadFullStaffList.status()).toBe(403);

    const radiologistCannotAssignStaff = await api.patch(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}/assignees`,
      { headers: auth(centerRadiologistToken), data: { operatorUserId: operatorUser.id } },
    );
    expect(radiologistCannotAssignStaff.status()).toBe(403);

    const assignees = await api.patch(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}/assignees`,
      {
        headers: auth(centerOwnerToken),
        data: { operatorUserId: operatorUser.id, radiologistUserId: centerRadiologistId },
      },
    );
    expect(assignees.status(), await assignees.text()).toBe(200);
    expect((await assignees.json()).data).toMatchObject({
      operatorId: expect.any(String),
      radiologistId: expect.any(String),
    });

    const refreshedAssignedDetail = await api.get(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}`,
      { headers: auth(centerOwnerToken) },
    );
    expect(refreshedAssignedDetail.status()).toBe(200);
    expect((await refreshedAssignedDetail.json()).data.referral).toMatchObject({
      operator: { user: { id: operatorUser.id } },
      radiologist: { user: { id: centerRadiologistId } },
    });

    const foreignAssignee = await api.patch(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}/assignees`,
      { headers: auth(centerOwnerToken), data: { operatorUserId: doctorId } },
    );
    expect(foreignAssignee.status()).toBe(400);

    const clinicCannotReadCenterDetail = await api.get(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}`,
      { headers: auth(ownerToken) },
    );
    expect(clinicCannotReadCenterDetail.status()).toBe(403);

    const clinicCannotReadEquipment = await api.get(
      `${BASE}/api/diagnostics/centers/${centerId}/modalities`,
      { headers: auth(ownerToken) },
    );
    expect(clinicCannotReadEquipment.status()).toBe(403);
    const clinicCannotCreateEquipment = await api.post(
      `${BASE}/api/diagnostics/centers/${centerId}/modalities`,
      { headers: auth(ownerToken), data: { name: 'Foreign device', kind: 'CBCT' } },
    );
    expect(clinicCannotCreateEquipment.status()).toBe(403);
    const radiologistCannotAssignEquipment = await api.patch(
      `${BASE}/api/diagnostics/centers/${centerId}/worklist/${referral.id}/modality`,
      { headers: auth(centerRadiologistToken), data: { modalityId: null } },
    );
    expect(radiologistCannotAssignEquipment.status()).toBe(403);

    await prisma.diagnosticStudy.create({
      data: {
        id: randomUUID(),
        centerId,
        name: 'Конусно-лучевая КТ (КЛКТ)',
        category: 'CBCT',
        price: 10000,
        durationMin: 30,
      },
    });

    const clinicCannotControlCenterWorkflow = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(ownerToken),
      data: { status: 'ACCEPTED' },
    });
    expect(clinicCannotControlCenterWorkflow.status()).toBe(409);
    expect((await clinicCannotControlCenterWorkflow.json()).code).toBe('DIAGNOSTIC_CENTER_OWNS_WORKFLOW');

    const radiologistCannotAccept = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerRadiologistToken),
      data: { status: 'ACCEPTED', cost: 10000 },
    });
    expect(radiologistCannotAccept.status()).toBe(403);
    expect((await radiologistCannotAccept.json()).code).toBe('DIAGNOSTIC_ACCEPT_FORBIDDEN');

    const centerCannotSkipToAcquisition = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'IN_PROGRESS' },
    });
    expect(centerCannotSkipToAcquisition.status()).toBe(409);
    expect((await centerCannotSkipToAcquisition.json()).code).toBe('DIAGNOSTIC_STATUS_TRANSITION_INVALID');

    const accepted = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'ACCEPTED', cost: 1 },
    });
    expect(accepted.status()).toBe(200);
    // Client-submitted cost is ignored for a center acceptance; the canonical
    // center catalogue remains the only source of the accepted price snapshot.
    expect((await accepted.json()).data).toMatchObject({ status: 'ACCEPTED', cost: 10000 });

    const missingSchedule = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'SCHEDULED' },
    });
    expect(missingSchedule.status()).toBe(400);
    expect((await missingSchedule.json()).code).toBe('DIAGNOSTIC_SCHEDULE_REQUIRED');

    const scheduledDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const scheduled = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'SCHEDULED', scheduledDate, scheduledTime: '10:30' },
    });
    expect(scheduled.status()).toBe(200);
    expect((await scheduled.json()).data).toMatchObject({ status: 'SCHEDULED', scheduledTime: '10:30' });

    const arrived = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'PATIENT_ARRIVED' },
    });
    expect(arrived.status()).toBe(200);
    expect((await arrived.json()).data.status).toBe('PATIENT_ARRIVED');

    const acquisition = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'IN_PROGRESS' },
    });
    expect(acquisition.status()).toBe(200);
    expect((await acquisition.json()).data.status).toBe('IN_PROGRESS');

    const unsignedCompletion = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'COMPLETED' },
    });
    expect(unsignedCompletion.status()).toBe(409);
    expect((await unsignedCompletion.json()).code).toBe('DIAGNOSTIC_RESULT_SIGN_REQUIRED');

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

    const delivered = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
      headers: auth(centerOwnerToken),
      data: { status: 'DELIVERED' },
    });
    expect(delivered.status()).toBe(200);
    expect((await delivered.json()).data.status).toBe('DELIVERED');

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

  test('PARTNER-002: medical laboratory chain → results → independent QC → rework → validator release → doctor interpretation', async () => {
    expect(fixtureLabId).toBeTruthy();
    expect(labOwnerToken).toBeTruthy();
    expect(medicalLabTechnicianToken).toBeTruthy();
    expect(medicalLabQualityToken).toBeTruthy();
    expect(medicalLabValidatorToken).toBeTruthy();
    expect(medicalLabDoctorToken).toBeTruthy();

    const clinic = await prisma.clinic.findFirst({ where: { name: 'E2E Clinic A' }, select: { id: true } });
    const clinicId = clinic?.id;
    expect(clinicId).toBeTruthy();

    const clinicPatient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: clinicId! },
      select: { id: true },
    });
    expect(clinicPatient?.id, 'the test patient must belong to E2E Clinic A').toBe(patientId);
    const activeMedicalLab = await prisma.laboratory.findUnique({
      where: { id: fixtureLabId },
      select: { id: true, active: true },
    });
    expect(activeMedicalLab, 'self-service onboarding must return the canonical laboratory entity ID').toMatchObject({
      id: fixtureLabId,
      active: true,
    });

    const orderResponse = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders', {
      headers: auth(ownerToken),
      data: {
        clinicId,
        patientId,
        labId: fixtureLabId,
        priority: 'routine',
        specimenType: 'blood',
        tests: [{ name: 'Глюкоза' }],
      },
    });
    const orderPayload = await orderResponse.json();
    expect(orderResponse.status(), JSON.stringify(orderPayload)).toBe(201);
    const order = orderPayload.data;
    const orderId = order.id as string;
    medicalLabOrderIds.push(orderId);
    expect(order.status).toBe('ordered');

    expect(order.accessionRequired).toBe(true);
    const moveTo = async (token: string, status: string) => api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/status', {
      headers: auth(token),
      data: { status },
    });

    const clinicCannotAccession = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens', {
      headers: auth(ownerToken),
      data: { specimenType: 'blood' },
    });
    expect(clinicCannotAccession.status()).toBe(403);
    const statusOnlyCollection = await moveTo(labOwnerToken, 'sample_collected');
    expect(statusOnlyCollection.status()).toBe(409);

    const accession = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens', {
      headers: auth(medicalLabTechnicianToken),
      data: { specimenType: 'blood', containerType: 'EDTA tube', volume: 5, volumeUnit: 'mL', location: 'Accession desk' },
    });
    const accessionBody = await accession.json();
    expect(accession.status(), JSON.stringify(accessionBody)).toBe(201);
    const specimen = accessionBody.data;
    expect(specimen.accessionNumber).toMatch(/^DVL-[A-Z0-9]{12,16}$/);
    expect(specimen.status).toBe('collected');

    const statusOnlyReceipt = await moveTo(labOwnerToken, 'received');
    expect(statusOnlyReceipt.status()).toBe(409);
    const unknownBarcode = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens/scan', {
      headers: auth(medicalLabTechnicianToken),
      data: { barcode: 'DVL-UNKNOWN0000', action: 'received' },
    });
    expect(unknownBarcode.status()).toBe(404);

    const scannedReceipt = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens/scan', {
      headers: auth(medicalLabTechnicianToken),
      data: { barcode: specimen.accessionNumber, action: 'received', location: 'Intake rack A' },
    });
    const scannedBody = await scannedReceipt.json();
    expect(scannedReceipt.status(), JSON.stringify(scannedBody)).toBe(200);
    expect(scannedBody.data.orderAdvanced).toBe(true);
    expect(scannedBody.data.order.status).toBe('received');

    const duplicateScan = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens/scan', {
      headers: auth(medicalLabTechnicianToken),
      data: { barcode: specimen.accessionNumber, action: 'received' },
    });
    expect(duplicateScan.status()).toBe(409);

    const oversizedAliquot = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens/' + specimen.id + '/aliquots', {
      headers: auth(medicalLabTechnicianToken),
      data: { volume: 6, volumeUnit: 'mL', containerType: 'Aliquot tube' },
    });
    expect(oversizedAliquot.status()).toBe(400);

    const aliquotResponse = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/specimens/' + specimen.id + '/aliquots', {
      headers: auth(medicalLabTechnicianToken),
      data: { volume: 1, volumeUnit: 'mL', containerType: 'Aliquot tube' },
    });
    const aliquotBody = await aliquotResponse.json();
    expect(aliquotResponse.status(), JSON.stringify(aliquotBody)).toBe(201);
    expect(aliquotBody.data.parentSpecimenId).toBe(specimen.id);
    expect(aliquotBody.data.accessionNumber).not.toBe(specimen.accessionNumber);

    const custodyDetail = await api.get(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId, {
      headers: auth(medicalLabTechnicianToken),
    });
    const custodyPayload = (await custodyDetail.json()).data;
    expect(custodyPayload.specimens).toHaveLength(2);
    expect(custodyPayload.specimenEvents.map((event: any) => event.eventType)).toEqual(expect.arrayContaining(['COLLECTED', 'RECEIVED', 'ALIQUOT_CREATED']));

    const processing = await moveTo(labOwnerToken, 'processing');
    expect(processing.status()).toBe(200);
    expect((await processing.json()).data.status).toBe('processing');
    const processingDetail = await api.get(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId, {
      headers: auth(medicalLabTechnicianToken),
    });
    const processingPayload = (await processingDetail.json()).data;
    expect(processingPayload.specimens.every((item: any) => item.status === 'processing')).toBe(true);
    expect(processingPayload.specimenEvents.map((event: any) => event.eventType)).toContain('PROCESSING_STARTED');

    const technicianDetail = await api.get(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId, {
      headers: auth(medicalLabTechnicianToken),
    });
    expect(technicianDetail.status()).toBe(200);
    const testId = (await technicianDetail.json()).data.tests[0]?.id as string;
    expect(testId).toBeTruthy();

    const ownerCannotEnterResults = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/results', {
      headers: auth(labOwnerToken),
      data: { results: [{ id: testId, result: '6.3' }] },
    });
    expect(ownerCannotEnterResults.status()).toBe(403);

    const missingResults = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/results', {
      headers: auth(medicalLabTechnicianToken),
      data: { results: [] },
    });
    expect(missingResults.status()).toBe(400);

    const firstResults = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/results', {
      headers: auth(medicalLabTechnicianToken),
      data: { results: [{ id: testId, result: '6.3', unit: 'mmol/L', referenceRange: '3.9–6.1', flag: 'high' }] },
    });
    expect(firstResults.status()).toBe(200);
    expect((await firstResults.json()).data.status).toBe('result_ready');

    const genericReady = await moveTo(labOwnerToken, 'result_ready');
    expect(genericReady.status()).toBe(409);
    const genericVerify = await moveTo(labOwnerToken, 'verified');
    expect(genericVerify.status()).toBe(409);

    const prematureVerify = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/verify', {
      headers: auth(medicalLabValidatorToken),
    });
    expect(prematureVerify.status()).toBe(409);

    const missingQcReason = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/quality-control', {
      headers: auth(medicalLabQualityToken),
      data: { decision: 'failed' },
    });
    expect(missingQcReason.status()).toBe(400);

    const failedQc = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/quality-control', {
      headers: auth(medicalLabQualityToken),
      data: { decision: 'failed', note: 'Контрольный диапазон требует повторной проверки.' },
    });
    expect(failedQc.status()).toBe(200);
    expect((await failedQc.json()).data.metadata.qualityControl.decision).toBe('failed');

    const duplicateQc = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/quality-control', {
      headers: auth(medicalLabQualityToken),
      data: { decision: 'passed', note: 'Attempted override without re-analysis.' },
    });
    expect(duplicateQc.status()).toBe(409);

    const rework = await moveTo(labOwnerToken, 'processing');
    expect(rework.status()).toBe(200);
    const reworkedDetail = await api.get(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId, {
      headers: auth(medicalLabTechnicianToken),
    });
    expect(reworkedDetail.status()).toBe(200);
    const reworkedTest = (await reworkedDetail.json()).data.tests[0];
    expect(reworkedTest.result).toBeNull();
    expect(reworkedTest.metadata.resultHistory).toHaveLength(1);
    expect(reworkedTest.metadata.resultHistory[0]).toMatchObject({
      result: '6.3',
      recordedByUserId: medicalLabTechnicianId,
      archivedByUserId: expect.any(String),
    });

    const secondResults = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/results', {
      headers: auth(medicalLabTechnicianToken),
      data: { results: [{ id: testId, result: '5.4', unit: 'mmol/L', referenceRange: '3.9–6.1', flag: 'normal' }] },
    });
    expect(secondResults.status()).toBe(200);

    const passedQc = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/quality-control', {
      headers: auth(medicalLabQualityToken),
      data: { decision: 'passed', note: 'Повторный результат соответствует QC.' },
    });
    expect(passedQc.status()).toBe(200);

    const qualityCannotRelease = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/verify', {
      headers: auth(medicalLabQualityToken),
    });
    expect(qualityCannotRelease.status()).toBe(403);
    const technicianCannotRelease = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/verify', {
      headers: auth(medicalLabTechnicianToken),
    });
    expect(technicianCannotRelease.status()).toBe(403);

    const verified = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/verify', {
      headers: auth(medicalLabValidatorToken),
    });
    expect(verified.status()).toBe(200);
    expect((await verified.json()).data.status).toBe('verified');

    const interpretation = await api.post(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId + '/interpretation', {
      headers: auth(medicalLabDoctorToken),
      data: { interpretation: 'Результат после повторного анализа находится в референсном диапазоне.' },
    });
    expect(interpretation.status()).toBe(200);

    const clinicRead = await api.get(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId, {
      headers: auth(ownerToken),
    });
    expect(clinicRead.status()).toBe(200);
    expect((await clinicRead.json()).data.order).toMatchObject({
      id: orderId,
      status: 'verified',
      interpretation: 'Результат после повторного анализа находится в референсном диапазоне.',
    });

    const otherPartnerRead = await api.get(BASE + '/api/lab-orders/medical-laboratory/orders/' + orderId, {
      headers: auth(dentalLabOwnerToken),
    });
    expect(otherPartnerRead.status()).toBe(403);
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

    const createService = await api.post(`${BASE}/api/lab-orders/platform/services`, {
      headers: auth(dentalLabOwnerToken),
      data: { code: 'CROWN-ZR', name: 'Коронка из диоксида циркония', category: 'crown', material: 'zirconia', description: 'Полноанатомическая циркониевая коронка', defaultPrice: 52000, turnaroundDays: 7 },
    });
    const createdServiceBody = await createService.json();
    expect(createService.status(), JSON.stringify(createdServiceBody)).toBe(201);
    const dentalService = createdServiceBody.data;
    const partnerServiceList = await api.get(`${BASE}/api/lab-orders/platform/services`, { headers: auth(dentalLabOwnerToken) });
    expect(partnerServiceList.status()).toBe(200);
    expect((await partnerServiceList.json()).data.some((item: any) => item.id === dentalService.id)).toBe(true);
    const buyerServiceList = await api.get(`${BASE}/api/lab-orders/platform/available-laboratories/${fixtureDentalLabId}/services`, { headers: auth(ownerToken) });
    expect(buyerServiceList.status()).toBe(200);
    expect((await buyerServiceList.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: dentalService.id, defaultPrice: 52000 })]));
    const clinicCannotReadPrivatePartnerCatalog = await api.get(`${BASE}/api/lab-orders/platform/services`, { headers: auth(ownerToken) });
    expect(clinicCannotReadPrivatePartnerCatalog.status()).toBe(403);
    const clinicCannotCreatePartnerService = await api.post(`${BASE}/api/lab-orders/platform/services`, {
      headers: auth(ownerToken), data: { code: 'FOREIGN', name: 'Foreign service', category: 'crown', defaultPrice: 1 },
    });
    expect(clinicCannotCreatePartnerService.status()).toBe(403);

    const assignment = await api.post(`${BASE}/api/lab-orders/platform/assign`, {
      headers: auth(ownerToken),
      data: { orderId: order.id, laboratoryId: fixtureDentalLabId, serviceId: dentalService.id },
    });
    expect(assignment.status()).toBe(200);

    const assignedLifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, { headers: auth(dentalLabOwnerToken) });
    expect(assignedLifecycle.status()).toBe(200);
    const assignedOrder = (await assignedLifecycle.json()).data.order;
    expect(assignedOrder).toMatchObject({ serviceId: dentalService.id, serviceName: 'Коронка из диоксида циркония', servicePriceSnapshot: 52000, price: 52000 });
    const initialEventCount = (await assignedLifecycle.json()).data.events.length;
    const priceChange = await api.patch(`${BASE}/api/lab-orders/platform/services/${dentalService.id}`, { headers: auth(dentalLabOwnerToken), data: { defaultPrice: 61000 } });
    expect(priceChange.status()).toBe(200);
    const immutableSnapshot = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, { headers: auth(dentalLabOwnerToken) });
    expect((await immutableSnapshot.json()).data.order).toMatchObject({ servicePriceSnapshot: 52000, price: 52000 });
    const repeatedAssignment = await api.post(`${BASE}/api/lab-orders/platform/assign`, {
      headers: auth(ownerToken),
      data: { orderId: order.id, laboratoryId: fixtureDentalLabId, serviceId: dentalService.id },
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

    const deliveryBypass = await api.patch(`${BASE}/api/lab-orders/platform/orders/${order.id}/status`, {
      headers: auth(dentalLabOwnerToken),
      data: { status: 'delivered', note: 'PARTNER-003 must not bypass shipment' },
    });
    expect(deliveryBypass.status()).toBe(409);
    expect((await deliveryBypass.json()).code).toBe('LAB_SHIPMENT_REQUIRED');

    const invalidShipment = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment`, {
      headers: auth(dentalLabOwnerToken),
      data: { method: 'COURIER', carrier: 'Test Carrier', trackingNumber: 'TRACK-003', trackingUrl: 'http://tracking.example/003' },
    });
    expect(invalidShipment.status()).toBe(400);

    const clinicCannotDispatch = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment`, {
      headers: auth(ownerToken),
      data: { method: 'PICKUP' },
    });
    expect(clinicCannotDispatch.status()).toBe(403);

    const crossTenantDispatch = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment`, {
      headers: auth(labOwnerToken),
      data: { method: 'PICKUP' },
    });
    expect(crossTenantDispatch.status()).toBe(404);

    const shipment = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment`, {
      headers: auth(dentalLabOwnerToken),
      data: {
        method: 'COURIER',
        carrier: 'E2E Courier',
        trackingNumber: 'DV-PARTNER-003',
        trackingUrl: 'https://tracking.example/dv-partner-003',
        note: 'PARTNER-003 handed to courier',
      },
    });
    expect(shipment.status()).toBe(201);
    const shipmentBody = (await shipment.json()).data;
    expect(shipmentBody.shipment).toMatchObject({
      method: 'COURIER',
      carrier: 'E2E Courier',
      trackingNumber: 'DV-PARTNER-003',
      status: 'dispatched',
    });
    expect(shipmentBody.order.status).toBe('ready');

    const repeatedShipment = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment`, {
      headers: auth(dentalLabOwnerToken),
      data: {
        method: 'COURIER',
        carrier: 'E2E Courier',
        trackingNumber: 'DV-PARTNER-003',
        trackingUrl: 'https://tracking.example/dv-partner-003',
        note: 'PARTNER-003 handed to courier',
      },
    });
    expect(repeatedShipment.status()).toBe(200);
    expect((await repeatedShipment.json()).data.idempotent).toBe(true);

    const invalidProof = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment/delivery-confirmation`, {
      headers: auth(dentalLabOwnerToken),
      data: { proofUrl: 'http://proof.example/receipt', recipientName: 'Clinic Reception' },
    });
    expect(invalidProof.status()).toBe(400);

    const delivered = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment/delivery-confirmation`, {
      headers: auth(dentalLabOwnerToken),
      data: {
        proofUrl: 'https://proof.example/receipts/partner-003',
        recipientName: 'Clinic Reception',
        note: 'PARTNER-003 delivery accepted by clinic',
      },
    });
    expect(delivered.status()).toBe(200);
    const deliveryBody = (await delivered.json()).data;
    expect(deliveryBody.order.status).toBe('delivered');
    expect(deliveryBody.shipment).toMatchObject({
      status: 'delivered',
      recipientName: 'Clinic Reception',
      proofUrl: 'https://proof.example/receipts/partner-003',
    });

    const repeatedDelivery = await api.post(`${BASE}/api/lab-orders/platform/orders/${order.id}/shipment/delivery-confirmation`, {
      headers: auth(dentalLabOwnerToken),
      data: {
        proofUrl: 'https://proof.example/receipts/partner-003',
        recipientName: 'Clinic Reception',
        note: 'PARTNER-003 delivery accepted by clinic',
      },
    });
    expect(repeatedDelivery.status()).toBe(200);
    expect((await repeatedDelivery.json()).data.idempotent).toBe(true);

    // Delivery confirms operational completion, not a commercial settlement.
    // Allow the in-process event queue to drain, then assert there is no partner
    // economics transaction (and therefore no delivery-triggered ledger snapshot).
    await new Promise((resolve) => setTimeout(resolve, 500));
    const deliveryEconomics = await prisma.transaction.findMany({
      where: { type: 'partner_economics', refType: 'DENTAL_LAB', refId: order.id },
      include: { ledgerEntries: true },
    });
    expect(deliveryEconomics, 'delivered dental-lab orders must not create economics before settlement').toHaveLength(0);

    const labFinance = await api.get(`${BASE}/api/lab-orders/platform/finance`, { headers: auth(dentalLabOwnerToken) });
    expect(labFinance.status()).toBe(200);
    const labFinanceData = (await labFinance.json()).data;
    expect(labFinanceData.wallet).toMatchObject({ ownerType: 'PARTNER', ownerId: fixtureDentalLabId, balance: '0' });
    expect(labFinanceData.availableBalanceMinor).toBe('0');
    expect(labFinanceData.economics.totals.operations).toBe(0);

    const technicianCannotReadLabFinance = await api.get(`${BASE}/api/lab-orders/platform/finance`, { headers: auth(dentalTechnicianToken) });
    expect(technicianCannotReadLabFinance.status()).toBe(403);
    const clinicCannotReadLabFinance = await api.get(`${BASE}/api/lab-orders/platform/finance`, { headers: auth(ownerToken) });
    expect(clinicCannotReadLabFinance.status()).toBe(403);

    const insufficientPartnerPayout = await api.post(`${BASE}/api/lab-orders/platform/payouts`, {
      headers: auth(dentalLabOwnerToken),
      data: { amount: '1.00' },
    });
    expect(insufficientPartnerPayout.status()).toBe(409);
    expect((await insufficientPartnerPayout.json()).code).toBe('INSUFFICIENT_FUNDS');

    const lifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${order.id}/lifecycle`, {
      headers: auth(dentalLabOwnerToken),
    });
    expect(lifecycle.status()).toBe(200);
    const lifecycleData = (await lifecycle.json()).data;
    expect(lifecycleData.events.length).toBeGreaterThanOrEqual(8);
    expect(lifecycleData.events[0].fromStatus).toBeNull();
    expect(lifecycleData.events[0].note).toContain('Передан в лабораторию');
    expect(lifecycleData.order.shipment).toMatchObject({ status: 'delivered', method: 'COURIER' });
    expect(lifecycleData.shipmentEvents).toHaveLength(2);
    expect(lifecycleData.shipmentEvents.map((event: any) => event.eventType)).toEqual(['DISPATCHED', 'DELIVERED']);

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

    for (const status of ['sent', 'in_progress', 'qc']) {
      const step = await api.patch(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/status`, {
        headers: auth(dentalLabOwnerToken),
        data: { status, note: `PARTNER-003 pickup preparation ${status}` },
      });
      expect(step.status()).toBe(200);
    }
    const pickupQc = await api.patch(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/qc`, {
      headers: auth(dentalLabOwnerToken),
      data: { checks: { fit: true, margins: true, shade: true, occlusion: true, surface: true, documentation: true }, note: 'PARTNER-003 pickup QC approved' },
    });
    expect(pickupQc.status()).toBe(200);

    const pickup = await api.post(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/shipment`, {
      headers: auth(dentalLabOwnerToken),
      data: { method: 'PICKUP', note: 'PARTNER-003 ready for clinic pickup' },
    });
    expect(pickup.status()).toBe(201);
    expect((await pickup.json()).data.shipment).toMatchObject({ method: 'PICKUP', status: 'ready_for_pickup', carrier: null, trackingNumber: null });

    const pickupDelivery = await api.post(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/shipment/delivery-confirmation`, {
      headers: auth(dentalLabOwnerToken),
      data: { proofUrl: 'https://proof.example/receipts/partner-003-pickup', recipientName: 'Clinic Courier', note: 'PARTNER-003 pickup handed to clinic courier' },
    });
    expect(pickupDelivery.status()).toBe(200);
    expect((await pickupDelivery.json()).data.order.status).toBe('delivered');
    const pickupLifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/lifecycle`, { headers: auth(dentalLabOwnerToken) });
    expect(pickupLifecycle.status()).toBe(200);
    expect((await pickupLifecycle.json()).data.shipmentEvents.map((event: any) => event.eventType)).toEqual(['READY_FOR_PICKUP', 'DELIVERED']);

    const remakeRequest = await api.post(`${BASE}/api/lab-orders/${unrelatedOrder.id}/remake-request`, {
      headers: auth(ownerToken),
      data: { reason: 'Clinic requested correction after fitting review.' },
    });
    expect(remakeRequest.status()).toBe(201);
    expect((await remakeRequest.json()).data.remakeRequest.status).toBe('requested');

    const acceptedRemake = await api.patch(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/remake-request`, {
      headers: auth(dentalLabOwnerToken),
      data: { decision: 'accept', note: 'Remake accepted under laboratory quality review.' },
    });
    expect(acceptedRemake.status()).toBe(200);
    expect((await acceptedRemake.json()).data.status).toBe('remake');

    const remakeStarted = await api.patch(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/status`, {
      headers: auth(dentalLabOwnerToken),
      data: { status: 'in_progress', note: 'Remake production started.' },
    });
    expect(remakeStarted.status()).toBe(200);
    const remakeAtQc = await api.patch(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/status`, {
      headers: auth(dentalLabOwnerToken),
      data: { status: 'qc', note: 'Remake completed and submitted to QC.' },
    });
    expect(remakeAtQc.status()).toBe(200);
    const remakeQc = await api.patch(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/qc`, {
      headers: auth(dentalLabOwnerToken),
      data: { checks: { fit: true, margins: true, shade: true, occlusion: true, surface: true, documentation: true }, note: 'Remake passed final QC.' },
    });
    expect(remakeQc.status()).toBe(200);
    expect((await remakeQc.json()).data.status).toBe('ready');

    const remakePickup = await api.post(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/shipment`, {
      headers: auth(dentalLabOwnerToken),
      data: { method: 'PICKUP', note: 'Corrected case is ready for the second pickup.' },
    });
    expect(remakePickup.status()).toBe(201);
    expect((await remakePickup.json()).data.shipment.status).toBe('ready_for_pickup');

    const remakeDelivery = await api.post(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/shipment/delivery-confirmation`, {
      headers: auth(dentalLabOwnerToken),
      data: {
        proofUrl: 'https://proof.example/receipts/partner-003-remake',
        recipientName: 'Clinic Reception',
        note: 'Corrected case received by clinic.',
      },
    });
    expect(remakeDelivery.status()).toBe(200);
    expect((await remakeDelivery.json()).data.order.status).toBe('delivered');

    const remakeLifecycle = await api.get(`${BASE}/api/lab-orders/platform/orders/${unrelatedOrder.id}/lifecycle`, { headers: auth(dentalLabOwnerToken) });
    expect(remakeLifecycle.status()).toBe(200);
    const remakeHistory = (await remakeLifecycle.json()).data;
    expect(remakeHistory.shipments).toHaveLength(2);
    expect(remakeHistory.shipmentEvents.map((event: any) => event.eventType)).toEqual([
      'READY_FOR_PICKUP', 'DELIVERED', 'READY_FOR_PICKUP', 'DELIVERED',
    ]);
  });

});
