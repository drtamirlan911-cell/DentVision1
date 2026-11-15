import { test, expect, type APIRequestContext } from '@playwright/test';
import { cleanupTestUser, prisma } from '../helpers/db';

const API = process.env.VITE_API_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function registerUser(api: APIRequestContext, email: string, role = 'STUDENT'): Promise<string> {
  const response = await api.post(`${API}/api/auth/register`, {
    data: { email, password: PASSWORD, firstName: 'Jobs', lastName: 'E2E', role },
  });
  expect(response.status(), 'test user registration').toBe(201);
  const payload = await response.json();
  const token = payload.data?.accessToken || payload.accessToken;
  expect(token).toBeTruthy();
  return token;
}

async function createEmployer(api: APIRequestContext, token: string, name: string, key: string) {
  const response = await api.post(`${API}/api/organizations/self-service`, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data: { type: 'employer', name, city: 'Тараз' },
  });
  expect(response.status(), 'employer self-service onboarding').toBe(201);
  const payload = await response.json();
  expect(payload.data.organizationId).toBeTruthy();
  expect(payload.data.branchId).toBeTruthy();
  expect(payload.data.type).toBe('employer');
  expect(payload.data.verification).toBe('PENDING');
  return payload.data as { organizationId: string; entityId: string; branchId: string; accessToken: string };
}

async function cleanupOrganization(organizationId: string) {
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const branchIds = branches.map((item) => item.id);
  if (branchIds.length) {
    await prisma.branchMember.deleteMany({ where: { branchId: { in: branchIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  }
  await prisma.personRole.deleteMany({ where: { scopeType: 'organization', scopeId: organizationId } });
  await prisma.person.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}

test.describe('Employer workspace and scoped Jobs lifecycle', () => {
  test('JOBS-EMPLOYER-001: onboarding → scoped vacancy → applicant pipeline → tenant isolation', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const stamp = Date.now();
    const ownerEmail = `jobs-employer-owner-${stamp}@test.com`;
    const candidateEmail = `jobs-employer-candidate-${stamp}@test.com`;
    const otherOwnerEmail = `jobs-employer-other-${stamp}@test.com`;
    let ownerOrganizationId = '';
    let otherOrganizationId = '';
    let vacancyId = '';

    try {
      const ownerRegistrationToken = await registerUser(api, ownerEmail);
      const employer = await createEmployer(
        api,
        ownerRegistrationToken,
        `E2E Employer ${stamp}`,
        `jobs-employer-${stamp}`,
      );
      ownerOrganizationId = employer.organizationId;
      const ownerToken = employer.accessToken;
      expect(ownerToken).toBeTruthy();

      const blockedUntilVerified = await api.post(`${API}/api/jobs/employer/vacancies`, {
        headers: auth(ownerToken),
        data: { title: 'Premature vacancy', city: 'Тараз' },
      });
      expect(blockedUntilVerified.status()).toBe(409);
      expect((await blockedUntilVerified.json()).code).toBe('EMPLOYER_VERIFICATION_REQUIRED');

      const candidateToken = await registerUser(api, candidateEmail);
      const deniedQueue = await api.get(`${API}/api/organizations/verification/queue`, {
        headers: auth(candidateToken),
      });
      expect(deniedQueue.status()).toBe(403);
      const deniedApproval = await api.post(`${API}/api/organizations/${ownerOrganizationId}/verification`, {
        headers: auth(candidateToken),
        data: { status: 'APPROVED' },
      });
      expect(deniedApproval.status()).toBe(403);

      // Isolated E2E fixture: simulate the platform approval result only in
      // the temporary CI database; no real legal signature or production org
      // is changed. Approval requires owner and platform signatures.
      const pendingOrg = await prisma.organization.findUnique({
        where: { id: ownerOrganizationId },
        select: { settings: true },
      });
      const pendingSettings = pendingOrg?.settings && typeof pendingOrg.settings === 'object' && !Array.isArray(pendingOrg.settings)
        ? pendingOrg.settings as Record<string, unknown> : {};
      const pendingLegal = pendingSettings.legal && typeof pendingSettings.legal === 'object' && !Array.isArray(pendingSettings.legal)
        ? pendingSettings.legal as Record<string, unknown> : {};
      await prisma.organization.update({
        where: { id: ownerOrganizationId },
        data: { settings: {
          ...pendingSettings,
          lifecycle: 'ACTIVE_VERIFIED',
          verification: 'APPROVED',
          ecosystemVisible: true,
          legal: { ...pendingLegal, ownerSigned: true, platformSigned: true },
        } as any },
      });
      const approvedStatus = await api.get(`${API}/api/jobs/employer/status`, { headers: auth(ownerToken) });
      expect(approvedStatus.status()).toBe(200);
      expect((await approvedStatus.json()).data.canPublish).toBe(true);

      const created = await api.post(`${API}/api/jobs/employer/vacancies`, {
        headers: auth(ownerToken),
        data: {
          title: 'Врач-стоматолог-терапевт',
          city: 'Тараз',
          salary: '400 000 — 600 000 ₸',
          employmentType: 'Полная занятость',
          description: 'E2E employer-owned vacancy',
          tags: ['Терапия'],
        },
      });
      expect(created.status(), 'employer-owned vacancy creation').toBe(201);
      const vacancy = (await created.json()).data;
      vacancyId = vacancy.id;
      expect(vacancy.employerOrganizationId).toBe(ownerOrganizationId);
      expect(vacancy.clinicId).toBeNull();
      expect(vacancy.kind).toBe('vacancy');

      const legacyCreate = await api.post(`${API}/api/jobs`, {
        headers: auth(ownerToken),
        data: { title: 'Unscoped vacancy', city: 'Тараз', kind: 'vacancy' },
      });
      expect(legacyCreate.status()).toBe(403);

      const resume = await api.post(`${API}/api/jobs`, {
        headers: auth(candidateToken),
        data: {
          title: 'Врач-терапевт ищет работу',
          city: 'Тараз',
          salary: 'От 350 000 ₸',
          employmentType: 'Полная занятость',
          description: 'Пять лет опыта; кандидат сам опубликовал резюме.',
          tags: ['Терапия'],
          kind: 'resume',
        },
      });
      expect(resume.status()).toBe(201);
      const resumeData = await resume.json();
      expect(resumeData.data.kind).toBe('resume');

      const candidateLookup = await api.get(`${API}/api/jobs/employer/resumes`, {
        headers: auth(candidateToken),
      });
      expect(candidateLookup.status()).toBe(403);

      const employerCandidateLookup = await api.get(`${API}/api/jobs/employer/resumes`, {
        headers: auth(ownerToken),
      });
      expect(employerCandidateLookup.status()).toBe(200);
      const candidateRows = (await employerCandidateLookup.json()).data as Array<Record<string, unknown>>;
      const discoveredResume = candidateRows.find((item) => item.id === resumeData.data.id);
      expect(discoveredResume).toBeTruthy();
      expect(discoveredResume).not.toHaveProperty('userId');
      expect(discoveredResume).not.toHaveProperty('email');

      const publicListBeforeApply = await api.get(`${API}/api/jobs`);
      expect(publicListBeforeApply.status()).toBe(200);
      const publicVacancies = await publicListBeforeApply.json();
      expect(publicVacancies.some((item: any) => item.id === resumeData.data.id)).toBe(false);

      const selfApply = await api.post(`${API}/api/jobs/${vacancyId}/apply`, {
        headers: auth(ownerToken),
        data: { coverNote: 'Owner cannot apply to own vacancy' },
      });
      expect(selfApply.status()).toBe(409);

      const apply = await api.post(`${API}/api/jobs/${vacancyId}/apply`, {
        headers: auth(candidateToken),
        data: { coverNote: 'Опыт работы 5 лет, терапия и эндодонтия.' },
      });
      expect(apply.status()).toBe(201);
      const application = await apply.json();

      const applications = await api.get(`${API}/api/jobs/employer/vacancies/${vacancyId}/applications`, {
        headers: auth(ownerToken),
      });
      expect(applications.status()).toBe(200);
      const rows = (await applications.json()).data as Array<{ id: string; status: string }>;
      expect(rows.some((row) => row.id === application.id)).toBe(true);
      expect(rows.find((row) => row.id === application.id)?.status).toBe('new');

      const invalidTransition = await api.patch(`${API}/api/jobs/employer/applications/${application.id}/status`, {
        headers: auth(ownerToken),
        data: { status: 'hired' },
      });
      expect(invalidTransition.status()).toBe(409);

      for (const status of ['reviewing', 'interview', 'offer', 'hired']) {
        const transition = await api.patch(`${API}/api/jobs/employer/applications/${application.id}/status`, {
          headers: auth(ownerToken),
          data: { status },
        });
        expect(transition.status(), `application transition to ${status}`).toBe(200);
        expect((await transition.json()).data.status).toBe(status);
      }

      const otherRegistrationToken = await registerUser(api, otherOwnerEmail);
      const otherEmployer = await createEmployer(
        api,
        otherRegistrationToken,
        `E2E Other Employer ${stamp}`,
        `jobs-employer-other-${stamp}`,
      );
      otherOrganizationId = otherEmployer.organizationId;
      const crossTenantRead = await api.get(`${API}/api/jobs/employer/vacancies/${vacancyId}/applications`, {
        headers: auth(otherEmployer.accessToken),
      });
      expect(crossTenantRead.status()).toBe(404);

      const publicList = await api.get(`${API}/api/jobs`);
      expect(publicList.status()).toBe(200);
      const publicRows = await publicList.json();
      expect(Array.isArray(publicRows)).toBe(true);
      expect(publicRows.some((item: any) => item.id === vacancyId)).toBe(true);
    } finally {
      if (vacancyId) {
        await prisma.jobApplication.deleteMany({ where: { vacancyId } });
        await prisma.jobVacancy.deleteMany({ where: { id: vacancyId } });
      }
      if (otherOrganizationId) await cleanupOrganization(otherOrganizationId);
      if (ownerOrganizationId) await cleanupOrganization(ownerOrganizationId);
      await cleanupTestUser(otherOwnerEmail);
      await cleanupTestUser(candidateEmail);
      await cleanupTestUser(ownerEmail);
      await api.dispose();
    }
  });
});
