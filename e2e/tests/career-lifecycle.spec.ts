import { test, expect, type APIRequestContext, request as apiRequest } from '@playwright/test';
import { cleanupTestUser, prisma } from '../helpers/db';

const API = process.env.VITE_API_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function register(api: APIRequestContext, email: string, role = 'STUDENT') {
  const response = await api.post(`${API}/api/auth/register`, {
    data: { email, password: PASSWORD, firstName: 'Career', lastName: 'E2E', role },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  const token = body.data?.accessToken || body.accessToken;
  expect(token).toBeTruthy();
  return token as string;
}

async function createEmployer(api: APIRequestContext, token: string, name: string, key: string) {
  const response = await api.post(`${API}/api/organizations/self-service`, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data: { type: 'employer', name, city: 'Тараз' },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.organizationId).toBeTruthy();
  expect(body.data.accessToken).toBeTruthy();
  return body.data as { organizationId: string; entityId: string; branchId: string; accessToken: string };
}

test.describe('Career OS — employer-origin and candidate-origin lifecycle', () => {
  let api: APIRequestContext;
  const stamp = Date.now();
  const employerEmail = `career-employer-${stamp}@test.com`;
  const candidateEmail = `career-candidate-${stamp}@test.com`;
  let employerUserId = '';
  let candidateUserId = '';
  let organizationId = '';
  let employerToken = '';
  let candidateToken = '';
  let vacancyId = '';
  let resumeId = '';
  let applicationId = '';
  let invitationId = '';
  let interviewId = '';
  let offerId = '';

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    const employerRegistrationToken = await register(api, employerEmail, 'STUDENT');
    const employer = await createEmployer(
      api,
      employerRegistrationToken,
      `Career E2E Employer ${stamp}`,
      `career-employer-${stamp}`,
    );
    organizationId = employer.organizationId;
    employerToken = employer.accessToken;

    const employerUser = await prisma.user.findUnique({ where: { email: employerEmail }, select: { id: true } });
    employerUserId = employerUser?.id || '';
    expect(employerUserId).toBeTruthy();

    // Simulate the approved state only in the isolated CI database. No legal
    // signature or production employer is created by this test.
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = organization?.settings && typeof organization.settings === 'object' && !Array.isArray(organization.settings)
      ? organization.settings as Record<string, unknown> : {};
    const legal = settings.legal && typeof settings.legal === 'object' && !Array.isArray(settings.legal)
      ? settings.legal as Record<string, unknown> : {};
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...settings,
          lifecycle: 'ACTIVE_VERIFIED',
          verification: 'APPROVED',
          ecosystemVisible: true,
          legal: { ...legal, ownerSigned: true, platformSigned: true },
        } as any,
      },
    });

    candidateToken = await register(api, candidateEmail, 'STUDENT');
    const candidateUser = await prisma.user.findUnique({ where: { email: candidateEmail }, select: { id: true } });
    candidateUserId = candidateUser?.id || '';
    expect(candidateUserId).toBeTruthy();
  });

  test.afterAll(async () => {
    await api?.dispose();
    if (offerId) await prisma.jobOffer.deleteMany({ where: { id: offerId } }).catch(() => {});
    if (interviewId) await prisma.jobInterview.deleteMany({ where: { id: interviewId } }).catch(() => {});
    if (invitationId) await prisma.jobInvitation.deleteMany({ where: { id: invitationId } }).catch(() => {});
    if (applicationId) await prisma.jobApplication.deleteMany({ where: { id: applicationId } }).catch(() => {});
    if (vacancyId) await prisma.jobVacancy.deleteMany({ where: { id: vacancyId } }).catch(() => {});
    if (resumeId) await prisma.jobVacancy.deleteMany({ where: { id: resumeId } }).catch(() => {});

    if (organizationId) {
      const branches = await prisma.branch.findMany({ where: { organizationId }, select: { id: true } }).catch(() => []);
      const branchIds = branches.map((branch) => branch.id);
      if (branchIds.length) {
        await prisma.branchMember.deleteMany({ where: { branchId: { in: branchIds } } }).catch(() => {});
        await prisma.branch.deleteMany({ where: { id: { in: branchIds } } }).catch(() => {});
      }
      await prisma.organizationInvitation.deleteMany({ where: { organizationId } }).catch(() => {});
      await prisma.personRole.deleteMany({ where: { scopeType: 'organization', scopeId: organizationId } }).catch(() => {});
      await prisma.person.deleteMany({ where: { organizationId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => {});
    }
    await cleanupTestUser(candidateEmail).catch(() => {});
    await cleanupTestUser(employerEmail).catch(() => {});
  });

  test('CAREER-OS-001: invitation → application → interview → offer → contract-required boundary', async () => {
    const employerStatus = await api.get(`${API}/api/jobs/employer/status`, { headers: auth(employerToken) });
    expect(employerStatus.status()).toBe(200);
    expect((await employerStatus.json()).data.canPublish).toBe(true);

    const resumeResponse = await api.post(`${API}/api/jobs`, {
      headers: auth(candidateToken),
      data: {
        kind: 'resume',
        title: 'Врач-стоматолог-терапевт',
        city: 'Тараз',
        salary: '400 000 ₸',
        employmentType: 'Полная занятость',
        description: 'Опыт терапии, эндодонтии и работы с цифровыми протоколами.',
        tags: ['Терапия', 'Эндодонтия'],
      },
    });
    expect(resumeResponse.status()).toBe(201);
    resumeId = (await resumeResponse.json()).data.id;
    expect(resumeId).toBeTruthy();

    const vacancyResponse = await api.post(`${API}/api/jobs/employer/vacancies`, {
      headers: auth(employerToken),
      data: {
        title: 'Стоматолог-терапевт',
        city: 'Тараз',
        salary: '450 000 — 650 000 ₸',
        employmentType: 'Полная занятость',
        description: 'Вакансия для проверки полного пути найма.',
        tags: ['Терапия'],
      },
    });
    expect(vacancyResponse.status()).toBe(201);
    const vacancy = (await vacancyResponse.json()).data;
    vacancyId = vacancy.id;
    expect(vacancy.employerOrganizationId).toBe(organizationId);

    const invitationResponse = await api.post(`${API}/api/jobs/employer/invitations`, {
      headers: auth(employerToken),
      data: {
        resumeId,
        vacancyId,
        message: 'Ваш опыт подходит. Приглашаем обсудить вакансию.',
      },
    });
    expect(invitationResponse.status()).toBe(201);
    invitationId = (await invitationResponse.json()).data.id;

    const invitationsResponse = await api.get(`${API}/api/jobs/me/invitations`, { headers: auth(candidateToken) });
    expect(invitationsResponse.status()).toBe(200);
    const invitation = (await invitationsResponse.json()).data.find((row: any) => row.id === invitationId);
    expect(invitation).toMatchObject({
      employerNameSnapshot: vacancy.clinicName,
      vacancy: { id: vacancyId, title: vacancy.title },
      status: 'pending',
    });

    const invitationAccepted = await api.patch(`${API}/api/jobs/me/invitations/${invitationId}/respond`, {
      headers: auth(candidateToken),
      data: { response: 'accepted' },
    });
    expect(invitationAccepted.status()).toBe(200);

    const candidateApplications = await api.get(`${API}/api/jobs/me/applications`, { headers: auth(candidateToken) });
    expect(candidateApplications.status()).toBe(200);
    const application = (await candidateApplications.json()).find((row: any) => row.vacancyId === vacancyId);
    expect(application).toBeTruthy();
    applicationId = application.id;
    expect(application.events.some((event: any) => event.eventType === 'invitation_accepted')).toBe(true);

    const employerApplications = await api.get(`${API}/api/jobs/employer/vacancies/${vacancyId}/applications`, {
      headers: auth(employerToken),
    });
    expect(employerApplications.status()).toBe(200);
    const ownedApplications = (await employerApplications.json()).data;
    expect(ownedApplications.some((row: any) => row.id === applicationId)).toBe(true);

    const reviewing = await api.patch(`${API}/api/jobs/employer/applications/${applicationId}/status`, {
      headers: auth(employerToken),
      data: { status: 'reviewing' },
    });
    expect(reviewing.status()).toBe(200);

    const interviewTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const interviewResponse = await api.post(`${API}/api/jobs/employer/applications/${applicationId}/interviews`, {
      headers: auth(employerToken),
      data: {
        scheduledAt: interviewTime,
        durationMinutes: 45,
        timezone: 'Asia/Almaty',
        mode: 'online',
        meetingUrl: 'https://meet.example.test/career-e2e',
        agenda: 'Обсуждение клинического опыта и графика.',
      },
    });
    expect(interviewResponse.status()).toBe(201);
    interviewId = (await interviewResponse.json()).data.id;

    const candidateInterviews = await api.get(`${API}/api/jobs/me/interviews`, { headers: auth(candidateToken) });
    expect(candidateInterviews.status()).toBe(200);
    const interview = (await candidateInterviews.json()).data.find((row: any) => row.id === interviewId);
    expect(interview).toMatchObject({
      status: 'proposed',
      employerOrganizationId: organizationId,
      application: { vacancy: { id: vacancyId, title: vacancy.title } },
    });
    expect(interview.meetingUrl).toBe('https://meet.example.test/career-e2e');

    const interviewConfirmed = await api.patch(`${API}/api/jobs/me/interviews/${interviewId}/respond`, {
      headers: auth(candidateToken),
      data: { response: 'confirmed' },
    });
    expect(interviewConfirmed.status()).toBe(200);

    const offerExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const offerResponse = await api.post(`${API}/api/jobs/employer/applications/${applicationId}/offers`, {
      headers: auth(employerToken),
      data: {
        title: vacancy.title,
        salary: '550 000 ₸',
        currency: 'KZT',
        employmentType: 'Полная занятость',
        startAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: offerExpiry,
        terms: { probation: '3 месяца', schedule: '5/2' },
      },
    });
    expect(offerResponse.status()).toBe(201);
    offerId = (await offerResponse.json()).data.id;

    const candidateOffers = await api.get(`${API}/api/jobs/me/offers`, { headers: auth(candidateToken) });
    expect(candidateOffers.status()).toBe(200);
    const offer = (await candidateOffers.json()).data.find((row: any) => row.id === offerId);
    expect(offer).toMatchObject({
      title: vacancy.title,
      salary: '550 000 ₸',
      currency: 'KZT',
      status: 'sent',
      employerOrganizationId: organizationId,
    });
    expect(offer.vacancy).toMatchObject({ id: vacancyId, title: vacancy.title });

    const acceptedOffer = await api.patch(`${API}/api/jobs/me/offers/${offerId}/respond`, {
      headers: auth(candidateToken),
      data: { response: 'accepted', message: 'Принимаю предложенные условия.' },
    });
    expect(acceptedOffer.status()).toBe(200);
    expect((await acceptedOffer.json()).note).toBe('EMPLOYMENT_CONTRACT_REQUIRED');

    const finalApplications = await api.get(`${API}/api/jobs/me/applications`, { headers: auth(candidateToken) });
    const finalApplication = (await finalApplications.json()).find((row: any) => row.id === applicationId);
    expect(finalApplication.status).toBe('offer');
    expect(finalApplication.events.some((event: any) => event.eventType === 'offer_accepted')).toBe(true);

    const finalOffer = await prisma.jobOffer.findUnique({ where: { id: offerId } });
    expect(finalOffer?.status).toBe('accepted');
    // A candidate's acceptance does not fabricate a signed contract or mark the
    // person hired. Contract/signature and onboarding remain separate legal steps.
  });
});
