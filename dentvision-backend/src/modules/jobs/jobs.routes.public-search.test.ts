// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  vacancyCount: vi.fn(),
  vacancyCreateMany: vi.fn(),
  vacancyFindMany: vi.fn(),
  where: undefined as unknown,
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    jobVacancy: {
      count: mocks.vacancyCount,
      createMany: mocks.vacancyCreateMany,
      findMany: mocks.vacancyFindMany,
    },
  },
}));

vi.mock('../../middleware/auth.js', () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../compliance/audit.service.js', () => ({
  auditFromReq: vi.fn(),
}));

vi.mock('../billing/planEntitlements.js', () => ({
  resolveClinicAccess: vi.fn(),
}));

vi.mock('../../lib/helpers.js', () => ({
  uid: () => 'test-vacancy-id',
}));

import { jobsRouter } from './jobs.routes.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', jobsRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.where = undefined;
  mocks.vacancyCount.mockResolvedValue(1);
  mocks.vacancyFindMany.mockImplementation(async ({ where }: { where: unknown }) => {
    mocks.where = where;
    return [];
  });
});

describe('public Jobs search visibility', () => {
  it('keeps employer legal activation gates when a text search is supplied', async () => {
    const response = await fetch(`${baseUrl}/api/jobs?q=orthodontist`);

    expect(response.status).toBe(200);

    const where = mocks.where as {
      AND?: Array<Record<string, any>>;
    };
    expect(where.AND).toBeDefined();

    const clauses = where.AND || [];
    expect(clauses).toContainEqual({ status: 'open', kind: 'vacancy' });

    const visibility = clauses.find((clause) =>
      Array.isArray(clause.OR) && clause.OR.some((item: any) => item.employerOrganization),
    );
    expect(visibility).toBeDefined();

    const employerGate = visibility?.OR.find((item: any) => item.employerOrganization)?.employerOrganization.is;
    expect(employerGate).toMatchObject({
      archivedAt: null,
      AND: expect.arrayContaining([
        { settings: { path: ['lifecycle'], equals: 'ACTIVE_VERIFIED' } },
        { settings: { path: ['verification'], equals: 'APPROVED' } },
        { settings: { path: ['ecosystemVisible'], equals: true } },
        { settings: { path: ['legal', 'ownerSigned'], equals: true } },
        { settings: { path: ['legal', 'platformSigned'], equals: true } },
      ]),
    });

    const textSearch = clauses.find((clause) =>
      Array.isArray(clause.OR) && clause.OR.some((item: any) => item.title?.contains === 'orthodontist'),
    );
    expect(textSearch).toBeDefined();
    expect(textSearch?.OR).toEqual(expect.arrayContaining([
      { title: { contains: 'orthodontist', mode: 'insensitive' } },
      { clinicName: { contains: 'orthodontist', mode: 'insensitive' } },
      { description: { contains: 'orthodontist', mode: 'insensitive' } },
    ]));
  });
});
