import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { cleanupTestClinic, cleanupTestUser, prisma } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

test.describe('Clinic invitation lifecycle', () => {
  let api: APIRequestContext;
  const stamp = Date.now();
  const ownerEmail = `clinic-invite-owner-${stamp}@test.com`;
  const adminEmail = `clinic-invite-admin-${stamp}@test.com`;
  const invitedEmail = `clinic-invite-doctor-${stamp}@test.com`;
  const wrongEmail = `clinic-invite-wrong-${stamp}@test.com`;
  const clinicName = `Clinic invite lifecycle ${stamp}`;
  let clinicId: string | null = null;
  let organizationId: string | null = null;

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
  });

  test.afterAll(async () => {
    if (organizationId) {
      await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
    }
    await cleanupTestClinic(clinicName);
    await cleanupTestUser(ownerEmail);
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(invitedEmail);
    await cleanupTestUser(wrongEmail);
    await api.dispose();
  });

  test('persists, looks up, email-binds and consumes a one-time invitation', async () => {
    test.setTimeout(90_000);

    const ownerRegistration = await api.post(`${BASE_URL}/api/auth/register`, {
      data: { email: ownerEmail, password: PASSWORD, firstName: 'Clinic', lastName: 'Owner' },
    });
    expect(ownerRegistration.status()).toBe(201);
    const ownerBody = await ownerRegistration.json();
    const ownerToken = ownerBody.data?.accessToken || ownerBody.accessToken;
    expect(ownerToken).toBeTruthy();
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    const createClinic = await api.post(`${BASE_URL}/api/auth/clinics`, {
      headers: ownerHeaders,
      data: { name: clinicName, city: 'Taraz', country: 'Kazakhstan', plan: 'starter' },
    });
    expect(createClinic.status()).toBe(201);
    const clinicBody = await createClinic.json();
    const clinic = clinicBody.data?.clinic || clinicBody.data;
    clinicId = clinic.id;
    expect(clinicId).toBeTruthy();
    const organization = await prisma.organization.findFirst({
      where: { originalType: 'Clinic', originalId: clinicId },
      select: { id: true },
    });
    organizationId = organization?.id || null;

    const ownerDelegatedInvite = await api.post(`${BASE_URL}/api/clinics/${clinicId}/invite`, {
      headers: ownerHeaders,
      data: { email: adminEmail, role: 'OWNER', expiresInDays: 7 },
    });
    // The creator is the owner, so owner-to-owner delegation is allowed.
    expect(ownerDelegatedInvite.status()).toBe(201);

    const adminCreate = await api.post(`${BASE_URL}/api/clinics/${clinicId}/staff`, {
      headers: ownerHeaders,
      data: { email: adminEmail, password: PASSWORD, name: 'Clinic Admin', role: 'ADMIN' },
    });
    expect([200, 201]).toContain(adminCreate.status());
    const adminLogin = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: adminEmail, password: PASSWORD },
    });
    expect(adminLogin.status()).toBe(200);
    const adminBody = await adminLogin.json();
    const adminToken = adminBody.data?.accessToken || adminBody.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const ownerInviteCode = (await ownerDelegatedInvite.json()).data.code;
    const existingMemberJoin = await api.post(`${BASE_URL}/api/auth/join-clinic`, {
      headers: adminHeaders,
      data: { code: ownerInviteCode },
    });
    expect(existingMemberJoin.status()).toBe(200);
    expect((await existingMemberJoin.json()).data.membership.role).toBe('ADMIN');

    const adminOwnerInvite = await api.post(`${BASE_URL}/api/clinics/${clinicId}/invite`, {
      headers: adminHeaders,
      data: { email: invitedEmail, role: 'OWNER', expiresInDays: 7 },
    });
    expect(adminOwnerInvite.status()).toBe(403);
    expect((await adminOwnerInvite.json()).code).toBe('OWNER_REQUIRED');

    const wrongEmailInvite = await api.post(`${BASE_URL}/api/clinics/${clinicId}/invite`, {
      headers: ownerHeaders,
      data: { email: wrongEmail, role: 'DOCTOR', expiresInDays: 7 },
    });
    expect(wrongEmailInvite.status()).toBe(201);
    const wrongCode = (await wrongEmailInvite.json()).data.code;

    const wrongRegistration = await api.post(`${BASE_URL}/api/auth/register`, {
      data: { email: invitedEmail, password: PASSWORD, firstName: 'Clinic', lastName: 'Doctor' },
    });
    expect(wrongRegistration.status()).toBe(201);
    const wrongBody = await wrongRegistration.json();
    const invitedToken = wrongBody.data?.accessToken || wrongBody.accessToken;
    const emailMismatch = await api.post(`${BASE_URL}/api/auth/join-clinic`, {
      headers: { Authorization: `Bearer ${invitedToken}` },
      data: { code: wrongCode },
    });
    expect(emailMismatch.status()).toBe(403);
    expect((await emailMismatch.json()).code).toBe('INVITATION_EMAIL_MISMATCH');

    const validInvite = await api.post(`${BASE_URL}/api/clinics/${clinicId}/invite`, {
      headers: ownerHeaders,
      data: { email: invitedEmail, role: 'DOCTOR', expiresInDays: 7 },
    });
    expect(validInvite.status()).toBe(201);
    const validCode = (await validInvite.json()).data.code;

    const lookup = await api.get(`${BASE_URL}/api/auth/invitations/lookup?code=${validCode}`);
    expect(lookup.status()).toBe(200);
    expect((await lookup.json()).data.clinicId).toBe(clinicId);

    const join = await api.post(`${BASE_URL}/api/auth/join-clinic`, {
      headers: { Authorization: `Bearer ${invitedToken}` },
      data: { code: validCode },
    });
    expect(join.status()).toBe(200);
    const joined = (await join.json()).data;
    expect(joined.clinic.id).toBe(clinicId);
    expect(joined.membership.role).toBe('DOCTOR');

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: invitedEmail } })).id, clinicId: clinicId! } },
    });
    expect(membership?.role).toBe('DOCTOR');
    expect(membership?.active).toBe(true);

    const replay = await api.post(`${BASE_URL}/api/auth/join-clinic`, {
      headers: { Authorization: `Bearer ${invitedToken}` },
      data: { code: validCode },
    });
    expect(replay.status()).toBe(410);
    expect((await replay.json()).code).toBe('INVITATION_USED');
  });
});
