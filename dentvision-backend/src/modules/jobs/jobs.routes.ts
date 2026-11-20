import { Router, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { resolveClinicAccess } from '../billing/planEntitlements.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

const SEED = [
  {
    title: 'Врач-стоматолог-терапевт', clinicName: 'KazDent', city: 'Алматы', salary: '450 000 — 700 000 ₸', employmentType: 'Полная занятость', description: 'Требуется опытный стоматолог-терапевт. Современное оборудование, цифровая рентгенография.', tags: ['Терапия', 'Эндодонтия'],
  },
  {
    title: 'Дентальный гигиенист', clinicName: 'Smile Clinic', city: 'Астана', salary: '300 000 — 450 000 ₸', employmentType: 'Полная занятость', description: 'Ищем гигиениста для профилактических процедур и чистки.', tags: ['Профилактика'],
  },
  {
    title: 'Врач-ортодонт', clinicName: 'Dental Premium', city: 'Алматы', salary: '600 000 — 900 000 ₸', employmentType: 'Полная занятость', description: 'Ортодонт с опытом работы с элайнерами и брекетами.', tags: ['Ортодонтия', 'Элайнеры'],
  },
];

export const jobsRouter = Router();

type JobEmployerScope = {
  employerOrganizationId: string | null;
  clinicId: string | null;
  clinicName: string;
  verificationStatus: string;
  canPublish: boolean;
};

async function activeJobEmployerScope(req: AuthRequest): Promise<JobEmployerScope | null> {
  const organizationId = String(req.user?.organizationId || '').trim();
  if (organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, archivedAt: null },
      select: { id: true, name: true, type: true, originalId: true, settings: true },
    });
    if (!organization) return null;
    if (organization.type === 'EMPLOYER') {
      const settings = organization.settings && typeof organization.settings === 'object' && !Array.isArray(organization.settings)
        ? organization.settings as Record<string, unknown> : {};
      const legal = settings.legal && typeof settings.legal === 'object' && !Array.isArray(settings.legal)
        ? settings.legal as Record<string, unknown> : {};
      const verificationStatus = String(settings.verification || 'PENDING').toUpperCase();
      const canPublish = verificationStatus === 'APPROVED'
        && settings.lifecycle === 'ACTIVE_VERIFIED'
        && legal.ownerSigned === true
        && legal.platformSigned === true;
      return { employerOrganizationId: organization.id, clinicId: null, clinicName: organization.name, verificationStatus, canPublish };
    }
    if (organization.type === 'CLINIC') {
      const clinicId = String(organization.originalId || req.user?.clinicId || '').trim();
      if (!clinicId) return null;
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, active: true },
      });
      if (!clinic?.active) return null;
      const settings = organization.settings && typeof organization.settings === 'object' && !Array.isArray(organization.settings)
        ? organization.settings as Record<string, unknown> : {};
      const verificationStatus = String(settings.verification || 'LEGACY_ACTIVE').toUpperCase();
      const legal = settings.legal && typeof settings.legal === 'object' && !Array.isArray(settings.legal)
        ? settings.legal as Record<string, unknown> : {};
      const hasExplicitVerification = Object.prototype.hasOwnProperty.call(settings, 'verification');
      const canPublish = !hasExplicitVerification || (
        verificationStatus === 'APPROVED'
        && settings.lifecycle === 'ACTIVE_VERIFIED'
        && legal.ownerSigned === true
        && legal.platformSigned === true
      );
      return { employerOrganizationId: null, clinicId: clinic.id, clinicName: organization.name || clinic.name, verificationStatus, canPublish };
    }
    return null;
  }

  // Legacy clinic JWTs remain supported only for the clinic domain. Other
  // organization types must switch through the canonical Organization context.
  const clinicId = String(req.user?.clinicId || '').trim();
  if (!clinicId) return null;
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true, active: true } });
  if (!clinic?.active) return null;
  return { employerOrganizationId: null, clinicId: clinic.id, clinicName: clinic.name, verificationStatus: 'APPROVED', canPublish: true };
}

function ownedVacancyWhere(scope: JobEmployerScope): Prisma.JobVacancyWhereInput {
  return scope.employerOrganizationId
    ? { employerOrganizationId: scope.employerOrganizationId }
    : { clinicId: scope.clinicId, employerOrganizationId: null };
}

async function ensureJobWriteAllowed(scope: JobEmployerScope, res: Response): Promise<boolean> {
  if (!scope.clinicId) return true;
  const access = await resolveClinicAccess(scope.clinicId);
  if (!access) {
    res.status(503).json({ ok: false, error: 'Не удалось проверить доступ клиники', code: 'CLINIC_ACCESS_UNVERIFIED' } satisfies ApiResponse);
    return false;
  }
  if (access.writeBlocked) {
    res.status(402).json({ ok: false, error: 'Публикация и изменение вакансий недоступны после окончания пробного периода клиники.', code: 'SUBSCRIPTION_EXPIRED' } satisfies ApiResponse);
    return false;
  }
  return true;
}

const APPLICATION_TRANSITIONS: Record<string, readonly string[]> = {
  new: ['reviewing', 'rejected'],
  reviewing: ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};

async function ensureSeed() {
  const count = await prisma.jobVacancy.count();
  if (count === 0) {
    await prisma.jobVacancy.createMany({ data: SEED.map((s) => ({ id: uid(), ...s, status: 'open', tags: s.tags })) });
  }
}

jobsRouter.get('/', optionalAuth, async (req, res) => {
  try {
    await ensureSeed();
    const { q, city } = req.query as Record<string, string | undefined>;
    const filters: Prisma.JobVacancyWhereInput[] = [
      { status: 'open', kind: 'vacancy' },
      {
        OR: [
          // Legacy clinic vacancies remain public only while their clinic is active.
          { employerOrganizationId: null, clinic: { is: { active: true } } },
          // Keep only platform seed listings that have no clinic or user owner.
          // Unscoped legacy user-created vacancies must not remain publicly discoverable.
          { employerOrganizationId: null, clinicId: null, userId: null },
          // Employer vacancies are discoverable only while the organization is
          // active, verified, visible and both required legal signatures remain effective.
          {
            employerOrganization: {
              is: {
                archivedAt: null,
                AND: [
                  { settings: { path: ['lifecycle'], equals: 'ACTIVE_VERIFIED' } },
                  { settings: { path: ['verification'], equals: 'APPROVED' } },
                  { settings: { path: ['ecosystemVisible'], equals: true } },
                  { settings: { path: ['legal', 'ownerSigned'], equals: true } },
                  { settings: { path: ['legal', 'platformSigned'], equals: true } },
                ],
              },
            },
          },
        ],
      },
    ];
    if (city && city !== 'all') filters.push({ city });
    if (q) filters.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { clinicName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    });
    const where: Prisma.JobVacancyWhereInput = { AND: filters };
    const list = await prisma.jobVacancy.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json(list);
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить вакансии' } satisfies ApiResponse);
  }
});

jobsRouter.get('/employer/status', authenticate, requirePermission('jobs.read'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Рабочий контекст работодателя не подтверждён', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    return res.json({
      ok: true,
      data: {
        organizationType: scope.employerOrganizationId ? 'EMPLOYER' : 'CLINIC',
        organizationName: scope.clinicName,
        verificationStatus: scope.verificationStatus,
        canPublish: scope.canPublish,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Employer workspace status error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось проверить статус работодателя' } satisfies ApiResponse);
  }
});

jobsRouter.get('/employer/vacancies', authenticate, requirePermission('jobs.read'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Переключитесь в рабочий контекст работодателя или клиники', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    const vacancies = await prisma.jobVacancy.findMany({
      where: { ...ownedVacancyWhere(scope), kind: 'vacancy' },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({
      ok: true,
      data: vacancies.map(({ _count, ...vacancy }) => ({ ...vacancy, applicationsCount: _count.applications })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Employer vacancy list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить вакансии работодателя' } satisfies ApiResponse);
  }
});

jobsRouter.get('/employer/resumes', authenticate, requirePermission('jobs.read'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Поиск кандидатов доступен только из контекста работодателя или клиники', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    if (scope.employerOrganizationId && !scope.canPublish) return res.status(409).json({ ok: false, error: 'Доступ к поиску кандидатов откроется после юридической проверки работодателя', code: 'EMPLOYER_VERIFICATION_REQUIRED' } satisfies ApiResponse);
    const resumes = await prisma.jobVacancy.findMany({
      where: { kind: 'resume', status: 'open' },
      select: {
        id: true, title: true, city: true, salary: true, employmentType: true,
        description: true, tags: true, createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, data: resumes } satisfies ApiResponse);
  } catch (error) {
    console.error('Employer resume discovery error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить резюме' } satisfies ApiResponse);
  }
});

jobsRouter.get('/employer/vacancies/:id/applications', authenticate, requirePermission('jobs.read'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Рабочий контекст работодателя не подтверждён', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    const vacancy = await prisma.jobVacancy.findFirst({
      where: { id: String(req.params.id), ...ownedVacancyWhere(scope), kind: 'vacancy' },
      select: { id: true },
    });
    if (!vacancy) return res.status(404).json({ ok: false, error: 'Вакансия не найдена' } satisfies ApiResponse);
    const applications = await prisma.jobApplication.findMany({
      where: { vacancyId: vacancy.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, data: applications } satisfies ApiResponse);
  } catch (error) {
    console.error('Employer applications error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить отклики' } satisfies ApiResponse);
  }
});

jobsRouter.post('/employer/vacancies', authenticate, requirePermission('jobs.write'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Публикация вакансии доступна только из активного контекста работодателя или клиники', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    if (scope.employerOrganizationId && !scope.canPublish) return res.status(409).json({ ok: false, error: 'Публикация вакансий доступна после юридической проверки работодателя и активации организации', code: 'EMPLOYER_VERIFICATION_REQUIRED', data: { verificationStatus: scope.verificationStatus, nextPath: '/organizations' } } satisfies ApiResponse);
    if (!(await ensureJobWriteAllowed(scope, res))) return;
    const title = String(req.body?.title || '').trim();
    const city = String(req.body?.city || '').trim();
    if (!title || !city) return res.status(400).json({ ok: false, error: 'title и city обязательны' } satisfies ApiResponse);
    const vacancy = await prisma.$transaction(async (tx) => {
      const created = await tx.jobVacancy.create({
        data: {
          id: uid(),
          title,
          clinicName: scope.clinicName,
          city,
          salary: req.body?.salary ? String(req.body.salary) : '',
          employmentType: req.body?.employmentType ? String(req.body.employmentType) : 'Полная занятость',
          description: req.body?.description ? String(req.body.description) : '',
          tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
          status: 'open',
          kind: 'vacancy',
          userId: req.user!.id,
          clinicId: scope.clinicId,
          employerOrganizationId: scope.employerOrganizationId,
        },
      });
      await auditFromReq(req, {
        action: 'jobs.vacancy.created',
        entity: 'job_vacancy',
        entityId: created.id,
        details: { employerOrganizationId: scope.employerOrganizationId, clinicId: scope.clinicId },
      }, tx);
      return created;
    });
    return res.status(201).json({ ok: true, data: vacancy } satisfies ApiResponse);
  } catch (error) {
    console.error('Create employer vacancy error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось разместить вакансию' } satisfies ApiResponse);
  }
});

jobsRouter.patch('/employer/applications/:id/status', authenticate, requirePermission('jobs.write'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Рабочий контекст работодателя не подтверждён', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    const application = await prisma.jobApplication.findUnique({
      where: { id: String(req.params.id) },
      include: { vacancy: true },
    });
    if (!application || application.vacancy.kind !== 'vacancy') return res.status(404).json({ ok: false, error: 'Отклик не найден' } satisfies ApiResponse);
    const owned = scope.employerOrganizationId
      ? application.vacancy.employerOrganizationId === scope.employerOrganizationId
      : application.vacancy.clinicId === scope.clinicId && !application.vacancy.employerOrganizationId;
    if (!owned) return res.status(404).json({ ok: false, error: 'Отклик не найден' } satisfies ApiResponse);
    if (!(await ensureJobWriteAllowed(scope, res))) return;
    const nextStatus = String(req.body?.status || '').trim().toLowerCase();
    if (!(APPLICATION_TRANSITIONS[application.status] || []).includes(nextStatus)) {
      return res.status(409).json({ ok: false, error: 'Недопустимый переход статуса отклика', code: 'INVALID_APPLICATION_TRANSITION', data: { currentStatus: application.status, requestedStatus: nextStatus } } satisfies ApiResponse);
    }
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.jobApplication.updateMany({
        where: { id: application.id, status: application.status },
        data: { status: nextStatus },
      });
      if (changed.count !== 1) return null;
      const result = await tx.jobApplication.findUnique({ where: { id: application.id } });
      if (!result) throw new Error('Updated Jobs application could not be read inside transaction');
      await tx.jobApplicationEvent.create({
        data: {
          id: uid(), applicationId: application.id, actorUserId: req.user!.id,
          eventType: 'status_changed', fromStatus: application.status, toStatus: nextStatus,
          candidateVisible: true,
          message: nextStatus === 'reviewing' ? 'Работодатель начал рассматривать ваш отклик.'
            : nextStatus === 'rejected' ? 'Работодатель завершил рассмотрение отклика.'
            : nextStatus === 'interview' ? 'Работодатель перевёл отклик на этап собеседования.'
            : nextStatus === 'offer' ? 'Работодатель отправил предложение о работе.'
            : nextStatus === 'hired' ? 'Работодатель отметил ваше трудоустройство.'
            : 'Работодатель обновил статус отклика.',
        },
      });
      await tx.notification.create({
        data: {
          id: uid(), userId: application.userId, type: 'JOB_APPLICATION_STATUS',
          title: 'Изменился статус отклика',
          message: `${application.vacancy.title} · ${nextStatus}`,
          link: '/career/applications',
        },
      });
      await auditFromReq(req, {
        action: 'jobs.application.status_changed',
        entity: 'job_application',
        entityId: application.id,
        details: { vacancyId: application.vacancyId, from: application.status, to: nextStatus },
      }, tx);
      return result;
    });
    if (!updated) return res.status(409).json({ ok: false, error: 'Отклик изменился параллельно. Обновите список.', code: 'APPLICATION_CONFLICT' } satisfies ApiResponse);
    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (error) {
    console.error('Update employer application error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось изменить статус отклика' } satisfies ApiResponse);
  }
});


jobsRouter.post('/employer/invitations', authenticate, requirePermission('jobs.write'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Рабочий контекст работодателя не подтверждён', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    if (scope.employerOrganizationId && !scope.canPublish) return res.status(409).json({ ok: false, error: 'Приглашения кандидатам доступны после юридической проверки работодателя', code: 'EMPLOYER_VERIFICATION_REQUIRED' } satisfies ApiResponse);
    if (!(await ensureJobWriteAllowed(scope, res))) return;

    const resumeId = String(req.body?.resumeId || '').trim();
    if (!resumeId) return res.status(400).json({ ok: false, error: 'resumeId обязателен' } satisfies ApiResponse);
    const resume = await prisma.jobVacancy.findFirst({
      where: { id: resumeId, kind: 'resume', status: 'open' },
      select: { id: true, userId: true, title: true },
    });
    if (!resume?.userId || resume.userId === req.user!.id) return res.status(404).json({ ok: false, error: 'Открытое резюме не найдено' } satisfies ApiResponse);

    const vacancyId = req.body?.vacancyId ? String(req.body.vacancyId) : null;
    if (vacancyId) {
      const vacancy = await prisma.jobVacancy.findFirst({
        where: { id: vacancyId, ...ownedVacancyWhere(scope), kind: 'vacancy', status: 'open' },
        select: { id: true },
      });
      if (!vacancy) return res.status(404).json({ ok: false, error: 'Вакансия не найдена в активной организации' } satisfies ApiResponse);
    }

    const duplicate = await prisma.jobInvitation.findFirst({
      where: {
        candidateUserId: resume.userId, resumeId: resume.id,
        employerOrganizationId: scope.employerOrganizationId, senderUserId: req.user!.id,
        status: 'pending', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (duplicate) return res.status(409).json({ ok: false, error: 'Приглашение этому кандидату уже ожидает ответа', code: 'INVITATION_ALREADY_PENDING' } satisfies ApiResponse);

    const invitation = await prisma.$transaction(async (tx) => {
      const created = await tx.jobInvitation.create({
        data: {
          id: uid(), candidateUserId: resume.userId!, senderUserId: req.user!.id,
          employerOrganizationId: scope.employerOrganizationId, vacancyId, resumeId: resume.id,
          employerNameSnapshot: scope.clinicName, message: String(req.body?.message || '').trim() || null,
          expiresAt: req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.notification.create({
        data: {
          id: uid(), userId: resume.userId!, type: 'JOB_INVITATION',
          title: 'Новое приглашение от работодателя',
          message: \`\${scope.clinicName} пригласил вас рассмотреть предложение.\`,
          link: '/career/invitations',
        },
      });
      await auditFromReq(req, { action: 'jobs.invitation.created', entity: 'job_invitation', entityId: created.id, details: { resumeId: resume.id, vacancyId, employerOrganizationId: scope.employerOrganizationId } }, tx);
      return created;
    });
    return res.status(201).json({ ok: true, data: invitation } satisfies ApiResponse);
  } catch (error) {
    console.error('Create candidate invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить приглашение' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/invitations', authenticate, async (req: AuthRequest, res) => {
  try {
    const invitations = await prisma.jobInvitation.findMany({
      where: { candidateUserId: req.user!.id },
      include: {
        employer: { select: { id: true, name: true, logo: true } },
        vacancy: { select: { id: true, title: true, city: true, salary: true, employmentType: true, status: true } },
        resume: { select: { id: true, title: true, status: true } },
        sender: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, data: invitations } satisfies ApiResponse);
  } catch (error) {
    console.error('List candidate invitations error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить приглашения' } satisfies ApiResponse);
  }
});

jobsRouter.patch('/me/invitations/:id/respond', authenticate, async (req: AuthRequest, res) => {
  try {
    const response = String(req.body?.response || '').trim().toLowerCase();
    if (!['accepted', 'declined'].includes(response)) return res.status(400).json({ ok: false, error: 'response должен быть accepted или declined' } satisfies ApiResponse);
    const invitation = await prisma.jobInvitation.findFirst({ where: { id: String(req.params.id), candidateUserId: req.user!.id } });
    if (!invitation) return res.status(404).json({ ok: false, error: 'Приглашение не найдено' } satisfies ApiResponse);
    if (invitation.status !== 'pending') return res.status(409).json({ ok: false, error: 'На это приглашение уже ответили', code: 'INVITATION_ALREADY_RESPONDED' } satisfies ApiResponse);
    if (invitation.expiresAt && invitation.expiresAt <= new Date()) {
      await prisma.jobInvitation.updateMany({ where: { id: invitation.id, status: 'pending' }, data: { status: 'expired' } });
      return res.status(410).json({ ok: false, error: 'Срок приглашения истёк', code: 'INVITATION_EXPIRED' } satisfies ApiResponse);
    }
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.jobInvitation.updateMany({
        where: { id: invitation.id, candidateUserId: req.user!.id, status: 'pending' },
        data: { status: response, respondedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      const row = await tx.jobInvitation.findUnique({ where: { id: invitation.id } });
      if (!row) throw new Error('Updated invitation could not be read');
      await tx.notification.create({
        data: {
          id: uid(), userId: invitation.senderUserId, type: 'JOB_INVITATION_RESPONSE',
          title: response === 'accepted' ? 'Кандидат принял приглашение' : 'Кандидат отклонил приглашение',
          message: \`Приглашение от \${invitation.employerNameSnapshot}\`, link: '/employer',
        },
      });
      await auditFromReq(req, { action: 'jobs.invitation.responded', entity: 'job_invitation', entityId: invitation.id, details: { response, employerOrganizationId: invitation.employerOrganizationId } }, tx);
      return row;
    });
    if (!updated) return res.status(409).json({ ok: false, error: 'Приглашение уже изменилось. Обновите список.', code: 'INVITATION_CONFLICT' } satisfies ApiResponse);
    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (error) {
    console.error('Respond to candidate invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось ответить на приглашение' } satisfies ApiResponse);
  }
});

jobsRouter.post('/employer/applications/:id/interviews', authenticate, requirePermission('jobs.write'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Рабочий контекст работодателя не подтверждён', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    if (!(await ensureJobWriteAllowed(scope, res))) return;
    const application = await prisma.jobApplication.findUnique({ where: { id: String(req.params.id) }, include: { vacancy: true } });
    if (!application || application.vacancy.kind !== 'vacancy') return res.status(404).json({ ok: false, error: 'Отклик не найден' } satisfies ApiResponse);
    const owned = scope.employerOrganizationId
      ? application.vacancy.employerOrganizationId === scope.employerOrganizationId
      : application.vacancy.clinicId === scope.clinicId && !application.vacancy.employerOrganizationId;
    if (!owned) return res.status(404).json({ ok: false, error: 'Отклик не найден' } satisfies ApiResponse);

    const scheduledAt = new Date(String(req.body?.scheduledAt || ''));
    const durationMinutes = Number(req.body?.durationMinutes || 30);
    const timezone = String(req.body?.timezone || 'Asia/Almaty').trim();
    const mode = String(req.body?.mode || 'online').trim().toLowerCase();
    let validTimezone = false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); validTimezone = true; } catch { validTimezone = false; }
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) return res.status(400).json({ ok: false, error: 'Укажите будущую дату собеседования' } satisfies ApiResponse);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) return res.status(400).json({ ok: false, error: 'Продолжительность должна быть от 15 до 180 минут' } satisfies ApiResponse);
    if (!validTimezone) return res.status(400).json({ ok: false, error: 'Некорректная временная зона' } satisfies ApiResponse);
    if (!['online', 'in_person', 'phone'].includes(mode)) return res.status(400).json({ ok: false, error: 'Некорректный формат собеседования' } satisfies ApiResponse);
    if (mode === 'online' && !String(req.body?.meetingUrl || '').trim()) return res.status(400).json({ ok: false, error: 'Для онлайн-собеседования нужна ссылка' } satisfies ApiResponse);
    if (mode === 'in_person' && !String(req.body?.location || '').trim()) return res.status(400).json({ ok: false, error: 'Укажите место встречи' } satisfies ApiResponse);
    if (!['reviewing', 'interview'].includes(application.status)) return res.status(409).json({ ok: false, error: 'Сначала переведите отклик на рассмотрение', code: 'APPLICATION_NOT_READY_FOR_INTERVIEW' } satisfies ApiResponse);

    const interview = await prisma.$transaction(async (tx) => {
      if (application.status === 'reviewing') {
        const changed = await tx.jobApplication.updateMany({ where: { id: application.id, status: 'reviewing' }, data: { status: 'interview' } });
        if (changed.count !== 1) return null;
        await tx.jobApplicationEvent.create({
          data: { id: uid(), applicationId: application.id, actorUserId: req.user!.id, eventType: 'status_changed', fromStatus: 'reviewing', toStatus: 'interview', candidateVisible: true, message: 'Работодатель пригласил вас на собеседование.' },
        });
      }
      const created = await tx.jobInterview.create({
        data: {
          id: uid(), applicationId: application.id, candidateUserId: application.userId, createdByUserId: req.user!.id,
          employerOrganizationId: scope.employerOrganizationId, employerNameSnapshot: scope.clinicName,
          scheduledAt, durationMinutes, timezone, mode,
          meetingUrl: mode === 'online' ? String(req.body?.meetingUrl || '').trim() : null,
          location: mode === 'in_person' ? String(req.body?.location || '').trim() : null,
          agenda: String(req.body?.agenda || '').trim() || null, status: 'proposed',
        },
      });
      await tx.notification.create({
        data: { id: uid(), userId: application.userId, type: 'JOB_INTERVIEW_PROPOSED', title: 'Вас пригласили на собеседование', message: \`\${scope.clinicName} · \${application.vacancy.title}\`, link: '/career/interviews' },
      });
      await auditFromReq(req, { action: 'jobs.interview.scheduled', entity: 'job_interview', entityId: created.id, details: { applicationId: application.id, scheduledAt: scheduledAt.toISOString(), timezone, mode } }, tx);
      return created;
    });
    if (!interview) return res.status(409).json({ ok: false, error: 'Отклик изменился параллельно. Обновите страницу.', code: 'APPLICATION_CONFLICT' } satisfies ApiResponse);
    return res.status(201).json({ ok: true, data: interview } satisfies ApiResponse);
  } catch (error) {
    console.error('Create interview error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось назначить собеседование' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/interviews', authenticate, async (req: AuthRequest, res) => {
  try {
    const interviews = await prisma.jobInterview.findMany({
      where: { candidateUserId: req.user!.id },
      include: {
        employer: { select: { id: true, name: true, logo: true } },
        application: { include: { vacancy: { select: { id: true, title: true, city: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return res.json({ ok: true, data: interviews } satisfies ApiResponse);
  } catch (error) {
    console.error('List candidate interviews error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить собеседования' } satisfies ApiResponse);
  }
});

jobsRouter.patch('/me/interviews/:id/respond', authenticate, async (req: AuthRequest, res) => {
  try {
    const response = String(req.body?.response || '').trim().toLowerCase();
    if (!['confirmed', 'declined', 'reschedule_requested'].includes(response)) return res.status(400).json({ ok: false, error: 'Некорректный ответ на приглашение' } satisfies ApiResponse);
    const interview = await prisma.jobInterview.findFirst({ where: { id: String(req.params.id), candidateUserId: req.user!.id } });
    if (!interview) return res.status(404).json({ ok: false, error: 'Собеседование не найдено' } satisfies ApiResponse);
    if (interview.status !== 'proposed') return res.status(409).json({ ok: false, error: 'Собеседование уже подтверждено или закрыто' } satisfies ApiResponse);
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.jobInterview.updateMany({
        where: { id: interview.id, candidateUserId: req.user!.id, status: 'proposed' },
        data: { status: response, candidateResponse: response, candidateRespondedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      const row = await tx.jobInterview.findUnique({ where: { id: interview.id } });
      if (!row) throw new Error('Updated interview could not be read');
      await tx.jobApplicationEvent.create({
        data: {
          id: uid(), applicationId: interview.applicationId, actorUserId: req.user!.id,
          eventType: 'interview_candidate_response', candidateVisible: true,
          message: response === 'confirmed' ? 'Вы подтвердили собеседование.'
            : response === 'declined' ? 'Вы отклонили предложенное время собеседования.'
            : 'Вы попросили работодателя перенести собеседование.',
          metadata: { interviewId: interview.id, response },
        },
      });
      await tx.notification.create({
        data: {
          id: uid(), userId: interview.createdByUserId, type: 'JOB_INTERVIEW_RESPONSE',
          title: 'Кандидат ответил на приглашение',
          message: response === 'confirmed' ? 'Собеседование подтверждено.' : response === 'declined' ? 'Кандидат отклонил собеседование.' : 'Кандидат просит перенести собеседование.',
          link: '/employer',
        },
      });
      await auditFromReq(req, { action: 'jobs.interview.candidate_responded', entity: 'job_interview', entityId: interview.id, details: { response } }, tx);
      return row;
    });
    if (!updated) return res.status(409).json({ ok: false, error: 'Собеседование изменилось. Обновите список.', code: 'INTERVIEW_CONFLICT' } satisfies ApiResponse);
    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (error) {
    console.error('Respond to interview error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось ответить на приглашение' } satisfies ApiResponse);
  }
});

jobsRouter.post('/employer/applications/:id/offers', authenticate, requirePermission('jobs.write'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Рабочий контекст работодателя не подтверждён', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    if (!(await ensureJobWriteAllowed(scope, res))) return;
    const application = await prisma.jobApplication.findUnique({ where: { id: String(req.params.id) }, include: { vacancy: true } });
    if (!application || application.vacancy.kind !== 'vacancy') return res.status(404).json({ ok: false, error: 'Отклик не найден' } satisfies ApiResponse);
    const owned = scope.employerOrganizationId
      ? application.vacancy.employerOrganizationId === scope.employerOrganizationId
      : application.vacancy.clinicId === scope.clinicId && !application.vacancy.employerOrganizationId;
    if (!owned) return res.status(404).json({ ok: false, error: 'Отклик не найден' } satisfies ApiResponse);
    if (!['interview', 'offer'].includes(application.status)) return res.status(409).json({ ok: false, error: 'Сначала проведите собеседование', code: 'APPLICATION_NOT_READY_FOR_OFFER' } satisfies ApiResponse);

    const title = String(req.body?.title || application.vacancy.title).trim();
    const employmentType = String(req.body?.employmentType || application.vacancy.employmentType || '').trim();
    const expiresAt = new Date(String(req.body?.expiresAt || ''));
    if (!title || !employmentType) return res.status(400).json({ ok: false, error: 'Укажите должность и тип занятости' } satisfies ApiResponse);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return res.status(400).json({ ok: false, error: 'Срок действия предложения должен быть в пределах 30 дней' } satisfies ApiResponse);

    const offer = await prisma.$transaction(async (tx) => {
      const previous = await tx.jobOffer.findFirst({ where: { applicationId: application.id }, orderBy: { version: 'desc' }, select: { version: true } });
      if (application.status === 'interview') {
        const changed = await tx.jobApplication.updateMany({ where: { id: application.id, status: 'interview' }, data: { status: 'offer' } });
        if (changed.count !== 1) return null;
        await tx.jobApplicationEvent.create({
          data: { id: uid(), applicationId: application.id, actorUserId: req.user!.id, eventType: 'status_changed', fromStatus: 'interview', toStatus: 'offer', candidateVisible: true, message: 'Работодатель отправил вам предложение о работе.' },
        });
      }
      const created = await tx.jobOffer.create({
        data: {
          id: uid(), applicationId: application.id, vacancyId: application.vacancyId,
          candidateUserId: application.userId, createdByUserId: req.user!.id,
          employerOrganizationId: scope.employerOrganizationId, employerNameSnapshot: scope.clinicName,
          title, salary: req.body?.salary != null ? String(req.body.salary) : application.vacancy.salary || null,
          currency: String(req.body?.currency || 'KZT'), employmentType,
          startAt: req.body?.startAt ? new Date(String(req.body.startAt)) : null,
          expiresAt, version: (previous?.version || 0) + 1,
          terms: req.body?.terms && typeof req.body.terms === 'object' ? req.body.terms : undefined,
        },
      });
      await tx.notification.create({
        data: { id: uid(), userId: application.userId, type: 'JOB_OFFER_RECEIVED', title: 'Вы получили предложение о работе', message: \`\${scope.clinicName} · \${title}\`, link: '/career/offers' },
      });
      await tx.jobApplicationEvent.create({
        data: { id: uid(), applicationId: application.id, actorUserId: req.user!.id, eventType: 'offer_sent', candidateVisible: true, message: 'Вам отправлено предложение о работе.', metadata: { offerId: created.id, version: created.version } },
      });
      await auditFromReq(req, { action: 'jobs.offer.created', entity: 'job_offer', entityId: created.id, details: { applicationId: application.id, version: created.version, employerOrganizationId: scope.employerOrganizationId } }, tx);
      return created;
    });
    if (!offer) return res.status(409).json({ ok: false, error: 'Отклик изменился параллельно. Обновите страницу.', code: 'APPLICATION_CONFLICT' } satisfies ApiResponse);
    return res.status(201).json({ ok: true, data: offer } satisfies ApiResponse);
  } catch (error) {
    console.error('Create employment offer error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить предложение' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/offers', authenticate, async (req: AuthRequest, res) => {
  try {
    const offers = await prisma.jobOffer.findMany({
      where: { candidateUserId: req.user!.id },
      include: {
        employer: { select: { id: true, name: true, logo: true } },
        vacancy: { select: { id: true, title: true, city: true, status: true } },
        application: { select: { id: true, status: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, data: offers } satisfies ApiResponse);
  } catch (error) {
    console.error('List candidate offers error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить предложения о работе' } satisfies ApiResponse);
  }
});

jobsRouter.patch('/me/offers/:id/respond', authenticate, async (req: AuthRequest, res) => {
  try {
    const response = String(req.body?.response || '').trim().toLowerCase();
    if (!['accepted', 'declined'].includes(response)) return res.status(400).json({ ok: false, error: 'response должен быть accepted или declined' } satisfies ApiResponse);
    const offer = await prisma.jobOffer.findFirst({ where: { id: String(req.params.id), candidateUserId: req.user!.id } });
    if (!offer) return res.status(404).json({ ok: false, error: 'Предложение не найдено' } satisfies ApiResponse);
    if (offer.status !== 'sent') return res.status(409).json({ ok: false, error: 'Предложение уже обработано', code: 'OFFER_ALREADY_RESPONDED' } satisfies ApiResponse);
    if (offer.expiresAt <= new Date()) {
      await prisma.jobOffer.updateMany({ where: { id: offer.id, candidateUserId: req.user!.id, status: 'sent' }, data: { status: 'expired' } });
      return res.status(410).json({ ok: false, error: 'Срок предложения истёк', code: 'OFFER_EXPIRED' } satisfies ApiResponse);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.jobOffer.updateMany({
        where: { id: offer.id, candidateUserId: req.user!.id, status: 'sent' },
        data: { status: response, respondedAt: new Date(), candidateMessage: String(req.body?.message || '').trim() || null },
      });
      if (changed.count !== 1) return null;
      const row = await tx.jobOffer.findUnique({ where: { id: offer.id } });
      if (!row) throw new Error('Updated offer could not be read');
      if (offer.applicationId) {
        await tx.jobApplicationEvent.create({
          data: {
            id: uid(), applicationId: offer.applicationId, actorUserId: req.user!.id,
            eventType: response === 'accepted' ? 'offer_accepted' : 'offer_declined',
            candidateVisible: true,
            message: response === 'accepted' ? 'Вы приняли предложение о работе. Для трудоустройства требуется отдельное оформление договора.' : 'Вы отклонили предложение о работе.',
            metadata: { offerId: offer.id, version: offer.version },
          },
        });
      }
      await tx.notification.create({
        data: { id: uid(), userId: offer.createdByUserId, type: 'JOB_OFFER_RESPONSE', title: response === 'accepted' ? 'Кандидат принял предложение' : 'Кандидат отклонил предложение', message: \`\${offer.title} · версия \${offer.version}\`, link: '/employer' },
      });
      await auditFromReq(req, { action: 'jobs.offer.responded', entity: 'job_offer', entityId: offer.id, details: { response, version: offer.version } }, tx);
      return row;
    });
    if (!updated) return res.status(409).json({ ok: false, error: 'Предложение уже изменилось. Обновите список.', code: 'OFFER_CONFLICT' } satisfies ApiResponse);
    return res.json({ ok: true, data: updated, note: 'EMPLOYMENT_CONTRACT_REQUIRED' } satisfies ApiResponse);
  } catch (error) {
    console.error('Respond to employment offer error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось ответить на предложение' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/applications', authenticate, async (req: AuthRequest, res) => {
  try {
    const apps = await prisma.jobApplication.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        vacancyId: true,
        coverNote: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        vacancy: {
          select: {
            id: true, title: true, clinicName: true, city: true, salary: true, employmentType: true, status: true,
            employerOrganization: { select: { id: true, name: true, logo: true } },
            clinic: { select: { id: true, name: true } },
          },
        },
        events: {
          where: { candidateVisible: true },
          select: { id: true, eventType: true, fromStatus: true, toStatus: true, message: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(apps);
  } catch (error) {
    console.error('List candidate applications error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить ваши отклики' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/resumes', authenticate, async (req: AuthRequest, res) => {
  try {
    const resumes = await prisma.jobVacancy.findMany({
      where: { userId: req.user!.id, kind: 'resume' },
      select: {
        id: true,
        title: true,
        city: true,
        salary: true,
        employmentType: true,
        description: true,
        tags: true,
        status: true,
        kind: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json(resumes);
  } catch (error) {
    console.error('List candidate resumes error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить ваши резюме' } satisfies ApiResponse);
  }
});

jobsRouter.patch('/me/resumes/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (status !== 'open' && status !== 'closed') {
      return res.status(400).json({
        ok: false,
        error: 'Статус резюме должен быть open или closed',
        code: 'INVALID_RESUME_STATUS',
      } satisfies ApiResponse);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const owned = await tx.jobVacancy.findFirst({
        where: { id: String(req.params.id), userId: req.user!.id, kind: 'resume' },
        select: { id: true, status: true },
      });
      if (!owned) return null;

      const changed = await tx.jobVacancy.updateMany({
        where: { id: owned.id, userId: req.user!.id, kind: 'resume' },
        data: { status },
      });
      if (changed.count !== 1) return null;

      const result = await tx.jobVacancy.findUnique({ where: { id: owned.id } });
      if (!result) throw new Error('Updated candidate resume could not be read inside transaction');

      if (owned.status !== status) {
        await auditFromReq(req, {
          action: 'jobs.resume.visibility_changed',
          entity: 'job_vacancy',
          entityId: owned.id,
          details: { from: owned.status, to: status },
        }, tx);
      }
      return result;
    });

    if (!updated) return res.status(404).json({ ok: false, error: 'Резюме не найдено' } satisfies ApiResponse);
    return res.json(updated);
  } catch (error) {
    console.error('Update candidate resume visibility error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось изменить видимость резюме' } satisfies ApiResponse);
  }
});

/**
 * Compatibility response for the former unscoped employer bootstrap.
 * Employer creation now uses the canonical Organization self-service flow so
 * PersonRole, active workspace, branch membership and onboarding lifecycle are
 * persisted atomically. Do not recreate the legacy CORPORATE/owner graph here.
 */
jobsRouter.post('/employers/register', authenticate, async (_req: AuthRequest, res) => {
  return res.status(410).json({
    ok: false,
    error: 'Регистрация работодателя перенесена в единое создание организации',
    code: 'EMPLOYER_ONBOARDING_MOVED',
    data: { nextPath: '/onboarding?mode=create&kind=employer', endpoint: '/api/organizations/self-service' },
  } satisfies ApiResponse);
});

jobsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, city, salary, employmentType, description, tags, kind } = req.body || {};
    if (kind !== 'resume') {
      return res.status(403).json({ ok: false, error: 'Вакансии публикуются только из подтверждённого контекста работодателя или клиники', code: 'EMPLOYER_CONTEXT_REQUIRED', data: { nextPath: '/onboarding?kind=employer' } } satisfies ApiResponse);
    }
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) return res.status(400).json({ ok: false, error: 'title обязателен' } satisfies ApiResponse);
    if (!String(city || '').trim()) return res.status(400).json({ ok: false, error: 'city обязателен' } satisfies ApiResponse);

    const resume = await prisma.$transaction(async (tx) => {
      const created = await tx.jobVacancy.create({
        data: {
          id: uid(),
          title: normalizedTitle,
          clinicName: [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || req.user!.email || 'Кандидат',
          city: String(city).trim(),
          salary: salary ? String(salary) : '',
          employmentType: employmentType ? String(employmentType) : 'Ищу работу',
          description: description ? String(description) : '',
          tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
          status: 'open',
          userId: req.user!.id,
          clinicId: null,
          employerOrganizationId: null,
          kind: 'resume',
        },
      });
      await auditFromReq(req, {
        action: 'jobs.resume.created',
        entity: 'job_vacancy',
        entityId: created.id,
        details: { kind: 'resume' },
      }, tx);
      return created;
    });
    return res.status(201).json({ ok: true, data: resume } satisfies ApiResponse);
  } catch (error) {
    console.error('Create resume error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось разместить резюме' } satisfies ApiResponse);
  }
});

jobsRouter.post('/:id/apply', authenticate, async (req: AuthRequest, res) => {
  try {
    const vacancy = await prisma.jobVacancy.findUnique({ where: { id: req.params.id as string } });
    if (!vacancy || vacancy.kind !== 'vacancy' || vacancy.status !== 'open') return res.status(404).json({ ok: false, error: 'Вакансия недоступна' } satisfies ApiResponse);
    if (vacancy.userId === req.user!.id) return res.status(409).json({ ok: false, error: 'Нельзя откликнуться на собственную вакансию' } satisfies ApiResponse);
    const result = await prisma.$transaction(async (tx) => {
      // Serialize retries for this vacancy/candidate pair. The transaction-scoped
      // PostgreSQL advisory lock avoids duplicate applications without requiring
      // a destructive cleanup/unique-index migration over existing records.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${vacancy.id}), hashtext(${req.user!.id}))`;
      const existing = await tx.jobApplication.findFirst({
        where: { vacancyId: vacancy.id, userId: req.user!.id },
      });
      if (existing) return { application: existing, created: false };
      const application = await tx.jobApplication.create({
        data: {
          id: uid(), vacancyId: vacancy.id, userId: req.user!.id,
          userName: [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || req.user!.email,
          coverNote: req.body?.coverNote || '', status: 'new',
        },
      });
      await tx.jobApplicationEvent.create({
        data: {
          id: uid(), applicationId: application.id, actorUserId: req.user!.id,
          eventType: 'application_submitted', toStatus: 'new',
          candidateVisible: true, message: 'Вы отправили отклик на эту вакансию.',
          metadata: { source: 'candidate_application' },
        },
      });
      await auditFromReq(req, {
        action: 'jobs.application.created',
        entity: 'job_application',
        entityId: application.id,
        details: { vacancyId: vacancy.id, source: 'candidate_application' },
      }, tx);
      return { application, created: true };
    });
    return res.status(result.created ? 201 : 200).json(result.application);
  } catch (error) {
    console.error('Apply job error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось откликнуться' } satisfies ApiResponse);
  }
});

export default jobsRouter;
