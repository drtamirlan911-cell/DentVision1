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
  await prisma.organizationInvitation.deleteMany({ where: { organizationId } });
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

      const recruiterInvite = await api.post(`${API}/api/iam/invitations`, {
        headers: auth(ownerToken),
        data: { organizationId: ownerOrganizationId, role: 'employer_recruiter', email: candidateEmail, expiresInDays: 7 },
      });
      expect(recruiterInvite.status()).toBe(201);
      const inviteData = (await recruiterInvite.json()).data;
      expect(inviteData.role).toBe('employer_recruiter');
      const ownerInviteList = await api.get(`${API}/api/iam/invitations?organizationId=${ownerOrganizationId}`, {
        headers: auth(ownerToken),
      });
      expect(ownerInviteList.status()).toBe(200);
      expect((await ownerInviteList.json()).data.some((item: any) => item.id === inviteData.id)).toBe(true);

      const blockedUntilVerified = await api.post(`${API}/api/jobs/employer/vacancies`, {
        headers: auth(ownerToken),
        data: { title: 'Premature vacancy', city: 'Тараз' },
      });
      expect(blockedUntilVerified.status()).toBe(409);
      expect((await blockedUntilVerified.json()).code).toBe('EMPLOYER_VERIFICATION_REQUIRED');

      const candidateToken = await registerUser(api, candidateEmail);
      const inviteLookup = await api.get(`${API}/api/iam/invitations/lookup?code=${encodeURIComponent(inviteData.code)}`, {
        headers: auth(candidateToken),
      });
      expect(inviteLookup.status()).toBe(200);
      expect((await inviteLookup.json()).data.role).toBe('employer_recruiter');
      const joined = await api.post(`${API}/api/iam/join-by-invite`, {
        headers: auth(candidateToken),
        data: { code: inviteData.code },
      });
      expect(joined.status()).toBe(201);

      const candidateContexts = await api.get(`${API}/api/iam/me/contexts`, { headers: auth(candidateToken) });
      expect(candidateContexts.status()).toBe(200);
      const employerContext = ((await candidateContexts.json()).data.contexts || []).find(
        (ctx: any) => ctx.scopeType === 'EMPLOYER'
          && ctx.organizationId === ownerOrganizationId
          && ctx.scopeId === employer.entityId
          && ctx.roleKey === 'employer_recruiter',
      );
      expect(employerContext, 'canonical employer context must expose Organization.id and source entity scope separately').toBeTruthy();

      const candidateSwitch = await api.post(`${API}/api/iam/switch-context`, {
        headers: auth(candidateToken),
        data: { scopeType: employerContext.scopeType, scopeId: employerContext.scopeId },
      });
      expect(candidateSwitch.status()).toBe(200);
      const recruiterToken = (await candidateSwitch.json()).data.accessToken;
      expect(recruiterToken).toBeTruthy();

      const recruiterCanReadEmployerQueue = await api.get(`${API}/api/jobs/employer/vacancies`, {
        headers: auth(recruiterToken),
      });
      expect(recruiterCanReadEmployerQueue.status()).toBe(200);
      const recruiterCannotInvite = await api.post(`${API}/api/iam/invitations`, {
        headers: auth(recruiterToken),
        data: { organizationId: ownerOrganizationId, role: 'employer_viewer', email: otherOwnerEmail },
      });
      expect(recruiterCannotInvite.status()).toBe(403);

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

      const editVacancy = await api.patch(API + '/api/jobs/employer/vacancies/' + vacancyId, {
        headers: auth(ownerToken),
        data: {
          salary: '420 000 — 650 000 ₸',
          description: 'Updated employer-owned vacancy with clear working conditions.',
          tags: ['Терапия', 'Эндодонтия'],
        },
      });
      expect(editVacancy.status(), 'owner can edit its own vacancy').toBe(200);
      const editedVacancy = (await editVacancy.json()).data;
      expect(editedVacancy).toMatchObject({
        id: vacancyId,
        title: 'Врач-стоматолог-терапевт',
        salary: '420 000 — 650 000 ₸',
        description: 'Updated employer-owned vacancy with clear working conditions.',
        tags: ['Терапия', 'Эндодонтия'],
      });

      const invalidVacancyStatus = await api.patch(API + '/api/jobs/employer/vacancies/' + vacancyId, {
        headers: auth(ownerToken),
        data: { status: 'draft' },
      });
      expect(invalidVacancyStatus.status()).toBe(400);
      expect((await invalidVacancyStatus.json()).code).toBe('INVALID_VACANCY_STATUS');

      const closeVacancy = await api.patch(API + '/api/jobs/employer/vacancies/' + vacancyId, {
        headers: auth(ownerToken),
        data: { status: 'closed' },
      });
      expect(closeVacancy.status(), 'owner can close a published vacancy').toBe(200);
      expect((await closeVacancy.json()).data.status).toBe('closed');
      const publicWhileClosed = await api.get(API + '/api/jobs');
      expect((await publicWhileClosed.json()).some((item: any) => item.id === vacancyId)).toBe(false);

      const reopenVacancy = await api.patch(API + '/api/jobs/employer/vacancies/' + vacancyId, {
        headers: auth(ownerToken),
        data: { status: 'open' },
      });
      expect(reopenVacancy.status(), 'verified owner can republish a closed vacancy').toBe(200);
      expect((await reopenVacancy.json()).data.status).toBe('open');

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

      const ownResumes = await api.get(`${API}/api/jobs/me/resumes`, {
        headers: auth(candidateToken),
      });
      expect(ownResumes.status()).toBe(200);
      const ownResumeRows = await ownResumes.json() as Array<Record<string, unknown>>;
      expect(ownResumeRows.some((item) => item.id === resumeData.data.id)).toBe(true);
      expect(ownResumeRows.find((item) => item.id === resumeData.data.id)).not.toHaveProperty('userId');
      expect(ownResumeRows.find((item) => item.id === resumeData.data.id)).not.toHaveProperty('email');

      const foreignOwnerCannotHideCandidateResume = await api.patch(
        `${API}/api/jobs/me/resumes/${resumeData.data.id}/status`,
        { headers: auth(ownerToken), data: { status: 'closed' } },
      );
      expect(foreignOwnerCannotHideCandidateResume.status()).toBe(404);

      const closeOwnResume = await api.patch(
        `${API}/api/jobs/me/resumes/${resumeData.data.id}/status`,
        { headers: auth(candidateToken), data: { status: 'closed' } },
      );
      expect(closeOwnResume.status()).toBe(200);
      expect((await closeOwnResume.json()).status).toBe('closed');

      const candidateLookup = await api.get(`${API}/api/jobs/employer/resumes`, {
        headers: auth(candidateToken),
      });
      expect(candidateLookup.status()).toBe(403);

      const employerCandidateLookupWhileClosed = await api.get(`${API}/api/jobs/employer/resumes`, {
        headers: auth(ownerToken),
      });
      expect(employerCandidateLookupWhileClosed.status()).toBe(200);
      expect(((await employerCandidateLookupWhileClosed.json()).data as Array<Record<string, unknown>>)
        .some((item) => item.id === resumeData.data.id)).toBe(false);

      const reopenOwnResume = await api.patch(
        `${API}/api/jobs/me/resumes/${resumeData.data.id}/status`,
        { headers: auth(candidateToken), data: { status: 'open' } },
      );
      expect(reopenOwnResume.status()).toBe(200);
      expect((await reopenOwnResume.json()).status).toBe('open');

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

      // Simulate a double tap / network retry: both requests must resolve to
      // one durable application and one audit event, not duplicate rows.
      const applyResponses = await Promise.all([
        api.post(`${API}/api/jobs/${vacancyId}/apply`, {
          headers: auth(candidateToken),
          data: { coverNote: 'Опыт работы 5 лет, терапия и эндодонтия.' },
        }),
        api.post(`${API}/api/jobs/${vacancyId}/apply`, {
          headers: auth(candidateToken),
          data: { coverNote: 'Опыт работы 5 лет, терапия и эндодонтия.' },
        }),
      ]);
      expect(applyResponses.map((response) => response.status()).sort()).toEqual([200, 201]);
      const applicationResponses = await Promise.all(applyResponses.map((response) => response.json()));
      expect(applicationResponses[0].id).toBe(applicationResponses[1].id);
      const application = applicationResponses.find((item) => item.status === 'new');

      const candidateOwnApplications = await api.get(`${API}/api/jobs/me/applications`, {
        headers: auth(candidateToken),
      });
      expect(candidateOwnApplications.status()).toBe(200);
      const candidateApplicationRows = await candidateOwnApplications.json() as Array<Record<string, any>>;
      const candidateApplication = candidateApplicationRows.find((row) => row.id === application.id);
      expect(candidateApplication?.status).toBe('new');
      expect(candidateApplication?.vacancy).toMatchObject({
        id: vacancyId,
        title: 'Врач-стоматолог-терапевт',
        city: 'Тараз',
      });
      expect(candidateApplication).not.toHaveProperty('userId');
      expect(candidateApplication?.vacancy).not.toHaveProperty('employerOrganizationId');

      const applications = await api.get(`${API}/api/jobs/employer/vacancies/${vacancyId}/applications`, {
        headers: auth(recruiterToken),
      });
      expect(applications.status()).toBe(200);
      const rows = (await applications.json()).data as Array<{ id: string; status: string }>;
      expect(rows.some((row) => row.id === application.id)).toBe(true);
      expect(rows.find((row) => row.id === application.id)?.status).toBe('new');

      const invalidTransition = await api.patch(`${API}/api/jobs/employer/applications/${application.id}/status`, {
        headers: auth(recruiterToken),
        data: { status: 'hired' },
      });
      expect(invalidTransition.status()).toBe(409);

      for (const status of ['reviewing', 'interview', 'offer', 'hired']) {
        const transition = await api.patch(`${API}/api/jobs/employer/applications/${application.id}/status`, {
          headers: auth(recruiterToken),
          data: { status },
        });
        expect(transition.status(), `application transition to ${status}`).toBe(200);
        expect((await transition.json()).data.status).toBe(status);

        const candidatePipeline = await api.get(`${API}/api/jobs/me/applications`, {
          headers: auth(candidateToken),
        });
        expect(candidatePipeline.status()).toBe(200);
        const refreshedRows = await candidatePipeline.json() as Array<Record<string, any>>;
        expect(refreshedRows.find((row) => row.id === application.id)?.status).toBe(status);
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

      const crossTenantEdit = await api.patch(API + '/api/jobs/employer/vacancies/' + vacancyId, {
        headers: auth(otherEmployer.accessToken),
        data: { title: 'Stolen vacancy title' },
      });
      expect(crossTenantEdit.status(), 'foreign employer cannot edit another organization vacancy').toBe(404);

      const crossTenantClose = await api.patch(API + '/api/jobs/employer/vacancies/' + vacancyId, {
        headers: auth(otherEmployer.accessToken),
        data: { status: 'closed' },
      });
      expect(crossTenantClose.status(), 'foreign employer cannot close another organization vacancy').toBe(404);

      // Public discovery must stop exposing an employer vacancy immediately

      // Public discovery must stop exposing an employer vacancy immediately
      // when verification/legal activation is revoked, even if its row remains open.
      await prisma.organization.update({
        where: { id: ownerOrganizationId },
        data: { settings: {
          ...pendingSettings,
          lifecycle: 'SUSPENDED',
          verification: 'SUSPENDED',
          ecosystemVisible: false,
          legal: { ...pendingLegal, ownerSigned: true, platformSigned: true },
        } as any },
      });
      const hiddenWhileSuspended = await api.get(`${API}/api/jobs`);
      expect(hiddenWhileSuspended.status()).toBe(200);
      expect((await hiddenWhileSuspended.json()).some((item: any) => item.id === vacancyId)).toBe(false);

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
