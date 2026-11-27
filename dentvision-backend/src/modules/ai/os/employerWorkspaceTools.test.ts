import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  organizationFindUnique,
  jobVacancyCount,
  jobVacancyFindMany,
  jobVacancyGroupBy,
  resolveOrganizationRoleKey,
  resolveUserPermissions,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  jobVacancyCount: vi.fn(),
  jobVacancyFindMany: vi.fn(),
  jobVacancyGroupBy: vi.fn(),
  resolveOrganizationRoleKey: vi.fn(),
  resolveUserPermissions: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    organization: { findUnique: organizationFindUnique },
    jobVacancy: {
      count: jobVacancyCount,
      findMany: jobVacancyFindMany,
      groupBy: jobVacancyGroupBy,
    },
  },
}));

vi.mock('../../../lib/authContext.js', () => ({ resolveOrganizationRoleKey }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));

import { getEmployerVacancyOverview } from './employerWorkspaceTools.js';

const context = {
  userId: 'employer-user-1',
  organizationId: 'employer-org-1',
  organizationType: 'EMPLOYER',
  role: 'EMPLOYER_OWNER',
};

describe('getEmployerVacancyOverview — own employer vacancies only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationFindUnique.mockResolvedValue({
      id: 'employer-org-1',
      name: 'DentVision Employer',
      type: 'EMPLOYER',
      archivedAt: null,
      settings: {
        lifecycle: 'ACTIVE_VERIFIED',
        verification: 'APPROVED',
        legal: { ownerSigned: true, platformSigned: true },
      },
    });
    resolveOrganizationRoleKey.mockResolvedValue('EMPLOYER_OWNER');
    resolveUserPermissions.mockResolvedValue(['jobs.read']);
    jobVacancyCount.mockResolvedValue(1);
    jobVacancyGroupBy.mockResolvedValue([{ status: 'open', _count: { _all: 1 } }]);
    jobVacancyFindMany.mockResolvedValue([{
      id: 'vacancy-1',
      title: 'Dental Therapist',
      city: 'Taraz',
      salary: '400000-600000 KZT',
      employmentType: 'FULL_TIME',
      status: 'open',
      tags: ['dentistry', 'therapy'],
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-10T00:00:00.000Z'),
      _count: { applications: 4 },
      userId: 'private-employer-user',
      description: 'not selected',
      applications: [{ user: { email: 'private-candidate@example.com' }, coverNote: 'private candidate note' }],
    }]);
  });

  it('returns the employer vacancy list and aggregate counts without candidate data', async () => {
    const result = await getEmployerVacancyOverview(context);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      employer: {
        id: 'employer-org-1',
        name: 'DentVision Employer',
        verificationStatus: 'APPROVED',
        canPublish: true,
      },
      summary: {
        totalVacancies: 1,
        byStatus: { open: 1 },
        applicationsCountInReturnedVacancies: 4,
      },
      returned: 1,
      hasMore: false,
      vacancies: [{
        id: 'vacancy-1',
        title: 'Dental Therapist',
        city: 'Taraz',
        status: 'open',
        applicationsCount: 4,
        tags: ['dentistry', 'therapy'],
      }],
    });
    expect(resolveOrganizationRoleKey).toHaveBeenCalledWith('employer-user-1', 'employer-org-1');
    expect(resolveUserPermissions).toHaveBeenCalledWith('employer-user-1', 'employer-org-1', 'EMPLOYER_OWNER');
    expect(jobVacancyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employerOrganizationId: 'employer-org-1', kind: 'vacancy' },
      take: 51,
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
    }));
    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain('private-employer-user');
    expect(serialized).not.toContain('private-candidate@example.com');
    expect(serialized).not.toContain('private candidate note');
    expect(serialized).not.toContain('not selected');
  });

  it('rejects missing, wrong-type and archived workspaces before reading vacancies', async () => {
    const missing = await getEmployerVacancyOverview({ ...context, organizationId: null });
    const wrongType = await getEmployerVacancyOverview({ ...context, organizationType: 'CLINIC' });
    organizationFindUnique.mockResolvedValueOnce({
      id: 'employer-org-1', name: 'Archived Employer', type: 'EMPLOYER',
      archivedAt: new Date(), settings: {},
    });
    const archived = await getEmployerVacancyOverview(context);

    expect(missing.ok).toBe(false);
    expect(wrongType.ok).toBe(false);
    expect(archived.ok).toBe(false);
    expect(jobVacancyFindMany).not.toHaveBeenCalled();
  });

  it('rejects users without an active employer organization role', async () => {
    resolveOrganizationRoleKey.mockResolvedValueOnce(undefined);
    const result = await getEmployerVacancyOverview(context);
    expect(result.ok).toBe(false);
    expect(jobVacancyFindMany).not.toHaveBeenCalled();
  });

  it('rejects roles outside the employer read contract', async () => {
    const result = await getEmployerVacancyOverview({ ...context, role: 'EMPLOYER_UNVERIFIED' });
    expect(result.ok).toBe(false);
    expect(organizationFindUnique).not.toHaveBeenCalled();
    expect(jobVacancyFindMany).not.toHaveBeenCalled();
  });

  it('accepts jobs.write because the shared IAM action ladder includes read access', async () => {
    resolveUserPermissions.mockResolvedValueOnce(['jobs.write']);
    const result = await getEmployerVacancyOverview(context);
    expect(result.ok).toBe(true);
    expect(jobVacancyFindMany).toHaveBeenCalled();
  });

  it('rejects a permission set unrelated to Jobs in the verified organization scope', async () => {
    resolveUserPermissions.mockResolvedValueOnce(['billing.read']);
    const result = await getEmployerVacancyOverview(context);
    expect(result.ok).toBe(false);
    expect(jobVacancyFindMany).not.toHaveBeenCalled();
  });

  it('limits returned rows to 50 and reports the full total', async () => {
    jobVacancyCount.mockResolvedValueOnce(51);
    jobVacancyFindMany.mockResolvedValueOnce(Array.from({ length: 51 }, (_, index) => ({
      id: 'vacancy-' + index,
      title: 'Vacancy ' + index,
      city: 'Astana',
      salary: '',
      employmentType: 'FULL_TIME',
      status: 'open',
      tags: [],
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: null,
      _count: { applications: 0 },
    })));

    const result = await getEmployerVacancyOverview(context);
    expect(result.ok).toBe(true);
    expect(result.data.returned).toBe(50);
    expect(result.data.summary.totalVacancies).toBe(51);
    expect(result.data.hasMore).toBe(true);
  });
});
