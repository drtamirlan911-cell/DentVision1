import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditFromReq } from '../compliance/audit.service.js';
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
};

async function activeJobEmployerScope(req: AuthRequest): Promise<JobEmployerScope | null> {
  const organizationId = String(req.user?.organizationId || '').trim();
  if (organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, archivedAt: null },
      select: { id: true, name: true, type: true, originalId: true },
    });
    if (!organization) return null;
    if (organization.type === 'EMPLOYER') {
      return { employerOrganizationId: organization.id, clinicId: null, clinicName: organization.name };
    }
    if (organization.type === 'CLINIC') {
      const clinicId = String(organization.originalId || req.user?.clinicId || '').trim();
      if (!clinicId) return null;
      return { employerOrganizationId: null, clinicId, clinicName: organization.name };
    }
    return null;
  }

  // Legacy clinic JWTs remain supported only for the clinic domain. Other
  // organization types must switch through the canonical Organization context.
  const clinicId = String(req.user?.clinicId || '').trim();
  if (!clinicId) return null;
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true, active: true } });
  if (!clinic?.active) return null;
  return { employerOrganizationId: null, clinicId: clinic.id, clinicName: clinic.name };
}

function ownedVacancyWhere(scope: JobEmployerScope): Record<string, unknown> {
  return scope.employerOrganizationId
    ? { employerOrganizationId: scope.employerOrganizationId }
    : { clinicId: scope.clinicId, employerOrganizationId: null };
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
    const where: Record<string, unknown> = { status: 'open', kind: 'vacancy' };
    if (city && city !== 'all') where.city = city;
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { clinicName: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
    const list = await prisma.jobVacancy.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json(list);
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить вакансии' } satisfies ApiResponse);
  }
});

jobsRouter.get('/employer/vacancies', authenticate, requirePermission('jobs.read'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Переключитесь в рабочий контекст работодателя или клиники', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    const vacancies = await prisma.jobVacancy.findMany({
      where: { ...ownedVacancyWhere(scope), kind: 'vacancy' },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, data: vacancies } satisfies ApiResponse);
  } catch (error) {
    console.error('Employer vacancy list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить вакансии работодателя' } satisfies ApiResponse);
  }
});

jobsRouter.get('/employer/resumes', authenticate, requirePermission('jobs.read'), async (req: AuthRequest, res) => {
  try {
    const scope = await activeJobEmployerScope(req);
    if (!scope) return res.status(403).json({ ok: false, error: 'Поиск кандидатов доступен только из контекста работодателя или клиники', code: 'EMPLOYER_CONTEXT_REQUIRED' } satisfies ApiResponse);
    const resumes = await prisma.jobVacancy.findMany({
      where: { kind: 'resume', status: 'open' },
      select: { id: true, title: true, clinicName: true, city: true, salary: true, employmentType: true, description: true, tags: true, createdAt: true },
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
    if (vacancy.kind !== 'vacancy' || vacancy.status !== 'open') return res.status(404).json({ ok: false, error: 'Вакансия недоступна' } satisfies ApiResponse);
    if (vacancy.userId === req.user!.id) return res.status(409).json({ ok: false, error: 'Нельзя откликнуться на собственную вакансию' } satisfies ApiResponse);
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
    const title = String(req.body?.title || '').trim();
    const city = String(req.body?.city || '').trim();
    if (!title || !city) return res.status(400).json({ ok: false, error: 'title и city обязательны' } satisfies ApiResponse);
    const vacancy = await prisma.jobVacancy.create({
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
      entityId: vacancy.id,
      details: { employerOrganizationId: scope.employerOrganizationId, clinicId: scope.clinicId },
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
    const nextStatus = String(req.body?.status || '').trim().toLowerCase();
    if (!(APPLICATION_TRANSITIONS[application.status] || []).includes(nextStatus)) {
      return res.status(409).json({ ok: false, error: 'Недопустимый переход статуса отклика', code: 'INVALID_APPLICATION_TRANSITION', data: { currentStatus: application.status, requestedStatus: nextStatus } } satisfies ApiResponse);
    }
    const changed = await prisma.jobApplication.updateMany({
      where: { id: application.id, status: application.status },
      data: { status: nextStatus },
    });
    if (changed.count !== 1) return res.status(409).json({ ok: false, error: 'Отклик изменился параллельно. Обновите список.', code: 'APPLICATION_CONFLICT' } satisfies ApiResponse);
    const updated = await prisma.jobApplication.findUnique({ where: { id: application.id } });
    await auditFromReq(req, {
      action: 'jobs.application.status_changed',
      entity: 'job_application',
      entityId: application.id,
      details: { vacancyId: application.vacancyId, from: application.status, to: nextStatus },
    });
    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (error) {
    console.error('Update employer application error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось изменить статус отклика' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/applications', authenticate, async (req: AuthRequest, res) => {
  try {
    const apps = await prisma.jobApplication.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
    return res.json(apps);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

/**
 * Employer self-service bootstrap.
 *
 * Jobs historically used `clinicName` on each vacancy and therefore had no
 * employer workspace. This endpoint introduces the missing organization
 * boundary without changing existing JobVacancy rows. The employer is a
 * unified Organization + Person context; existing clinic-linked vacancies
 * continue to work unchanged.
 */
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

    const resume = await prisma.jobVacancy.create({
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
    return res.status(201).json({ ok: true, data: resume } satisfies ApiResponse);
  } catch (error) {
    console.error('Create resume error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось разместить резюме' } satisfies ApiResponse);
  }
});

jobsRouter.post('/:id/apply', authenticate, async (req: AuthRequest, res) => {
  try {
    const vacancy = await prisma.jobVacancy.findUnique({ where: { id: req.params.id as string } });
    if (!vacancy) return res.status(404).json({ ok: false, error: 'Вакансия не найдена' } satisfies ApiResponse);
    const existing = await prisma.jobApplication.findFirst({ where: { vacancyId: vacancy.id, userId: req.user!.id } });
    if (existing) return res.json(existing);
    const application = await prisma.jobApplication.create({
      data: {
        id: uid(), vacancyId: vacancy.id, userId: req.user!.id,
        userName: [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || req.user!.email,
        coverNote: req.body?.coverNote || '', status: 'new',
      },
    });
    return res.status(201).json(application);
  } catch (error) {
    console.error('Apply job error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось откликнуться' } satisfies ApiResponse);
  }
});

export default jobsRouter;
