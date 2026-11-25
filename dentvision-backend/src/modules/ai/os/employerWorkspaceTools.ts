import prisma from '../../../lib/prisma.js';
import { resolveOrganizationRoleKey } from '../../../lib/authContext.js';
import { permissionsSatisfy } from '../../../lib/permissions.js';
import { resolveUserPermissions } from '../../../lib/resolvePermissions.js';

export interface EmployerVacancyOverviewContext {
  userId: string;
  organizationId: string | null;
  organizationType: string | null;
  role: string;
}

const EMPLOYER_READ_ROLES = new Set([
  'EMPLOYER_OWNER',
  'EMPLOYER_RECRUITER',
  'EMPLOYER_VIEWER',
]);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  let sanitized = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    sanitized += code <= 0x1f || code === 0x7f ? ' ' : character;
  }
  const normalized = sanitized.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => safeText(item, 48))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
}

/**
 * Read-only employer vacancy overview.
 * Authorization mirrors GET /api/jobs/employer/vacancies:
 * active Employer Organization, scoped employer role and jobs.read permission.
 * Candidate identities, applications, cover notes and resume records are never
 * selected; only aggregate application counts are exposed.
 */
export async function getEmployerVacancyOverview(context: EmployerVacancyOverviewContext) {
  const role = String(context.role || '').trim().toUpperCase();
  if (
    !context.userId
    || !context.organizationId
    || context.organizationType !== 'EMPLOYER'
    || !EMPLOYER_READ_ROLES.has(role)
  ) {
    return { ok: false as const, error: 'Нет подтверждённого рабочего пространства работодателя' };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { id: true, name: true, type: true, settings: true, archivedAt: true },
    });
    if (!organization || organization.archivedAt || organization.type !== 'EMPLOYER') {
      return { ok: false as const, error: 'Текущее рабочее пространство не является активным работодателем' };
    }

    const scopedRole = await resolveOrganizationRoleKey(context.userId, organization.id);
    if (!scopedRole || !EMPLOYER_READ_ROLES.has(scopedRole)) {
      return { ok: false as const, error: 'Нет действующей роли работодателя в этой организации' };
    }

    const permissions = await resolveUserPermissions(context.userId, organization.id, scopedRole);
    if (!permissionsSatisfy(new Set(permissions), 'jobs.read')) {
      return { ok: false as const, error: 'Недостаточно прав для чтения вакансий работодателя' };
    }

    const where = { employerOrganizationId: organization.id, kind: 'vacancy' };
    const [totalVacancies, rows, grouped] = await Promise.all([
      prisma.jobVacancy.count({ where }),
      prisma.jobVacancy.findMany({
        where,
        select: {
          id: true,
          title: true,
          city: true,
          salary: true,
          employmentType: true,
          status: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 51,
      }),
      prisma.jobVacancy.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    const vacancies = rows.slice(0, 50).map((vacancy) => ({
      id: vacancy.id,
      title: safeText(vacancy.title, 160) || 'Вакансия без названия',
      city: safeText(vacancy.city, 80),
      salary: safeText(vacancy.salary, 80),
      employmentType: safeText(vacancy.employmentType, 60),
      status: safeText(vacancy.status, 32) || 'unknown',
      tags: safeTags(vacancy.tags),
      applicationsCount: Number(vacancy._count.applications) || 0,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
    }));

    const settings = isRecord(organization.settings) ? organization.settings : {};
    const legal = isRecord(settings.legal) ? settings.legal : {};
    const verificationStatus = String(settings.verification || 'PENDING').toUpperCase();
    const canPublish = verificationStatus === 'APPROVED'
      && settings.lifecycle === 'ACTIVE_VERIFIED'
      && legal.ownerSigned === true
      && legal.platformSigned === true;
    const byStatus = grouped.reduce<Record<string, number>>((result, item) => {
      result[String(item.status)] = Number(item._count._all) || 0;
      return result;
    }, {});
    const applicationsCount = vacancies.reduce((sum, vacancy) => sum + vacancy.applicationsCount, 0);

    return {
      ok: true as const,
      data: {
        employer: {
          id: organization.id,
          name: safeText(organization.name, 160) || 'Работодатель',
          verificationStatus,
          canPublish,
        },
        summary: {
          totalVacancies,
          byStatus,
          applicationsCountInReturnedVacancies: applicationsCount,
        },
        returned: vacancies.length,
        hasMore: totalVacancies > vacancies.length,
        vacancies,
      },
    };
  } catch {
    return { ok: false as const, error: 'Не удалось безопасно загрузить вакансии работодателя' };
  }
}
