// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    jobVacancy: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    jobApplication: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    tx,
    organizationFindFirst: vi.fn(),
    vacancyFindUnique: vi.fn(),
    vacancyFindMany: vi.fn(),
    applicationFindUnique: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    auditFromReq: vi.fn(),
  };
});

vi.mock('../../lib/prisma.js', () => ({
  default: {
    organization: { findFirst: mocks.organizationFindFirst },
    jobVacancy: {
      findUnique: mocks.vacancyFindUnique,
      findMany: mocks.vacancyFindMany,
    },
    jobApplication: { findUnique: mocks.applicationFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../../middleware/auth.js', () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  authenticate: (req: any, _res: unknown, next: () => void) => {
    req.user = {
      id: 'employer-owner',
      organizationId: 'employer-org',
      clinicId: null,
      firstName: 'Test',
      lastName: 'Employer',
    };
    next();
  },
}));

vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../compliance/audit.service.js', () => ({
  auditFromReq: mocks.auditFromReq,
}));

vi.mock('../billing/planEntitlements.js', () => ({
  resolveClinicAccess: vi.fn(),
}));

vi.mock('../../lib/helpers.js', () => ({
  uid: () => 'test-vacancy-id',
}));

import { auditFromReq } from '../compliance/audit.service.js';
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
  mocks.organizationFindFirst.mockResolvedValue({
    id: 'employer-org',
    name: 'Employer Org',
    type: 'EMPLOYER',
    originalId: null,
    settings: {
      lifecycle: 'ACTIVE_VERIFIED',
      verification: 'APPROVED',
      legal: { ownerSigned: true, platformSigned: true },
    },
  });
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.auditFromReq.mockResolvedValue(undefined);
  mocks.vacancyFindMany.mockResolvedValue([{
    id: 'resume-1',
    title: 'Dentist',
    city: 'Тараз',
    status: 'open',
    kind: 'resume',
  }]);
  mocks.vacancyFindUnique.mockResolvedValue({
    id: 'vacancy-1',
    title: 'Dentist',
    kind: 'vacancy',
    status: 'open',
    userId: 'different-employer',
  });
  mocks.applicationFindUnique.mockResolvedValue({
    id: 'application-1',
    status: 'new',
    vacancyId: 'vacancy-1',
    vacancy: {
      kind: 'vacancy',
      employerOrganizationId: 'employer-org',
      clinicId: null,
    },
  });
  mocks.tx.jobVacancy.create.mockResolvedValue({ id: 'vacancy-1', title: 'Dentist' });
  mocks.tx.jobVacancy.findFirst.mockResolvedValue({ id: 'resume-1', status: 'open' });
  mocks.tx.jobVacancy.findUnique.mockResolvedValue({ id: 'resume-1', status: 'closed', kind: 'resume' });
  mocks.tx.jobVacancy.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.jobApplication.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.jobApplication.findFirst.mockResolvedValue(null);
  mocks.tx.jobApplication.create.mockResolvedValue({
    id: 'application-2',
    vacancyId: 'vacancy-1',
    userId: 'employer-owner',
    status: 'new',
  });
  mocks.tx.jobApplication.findUnique.mockResolvedValue({ id: 'application-1', status: 'reviewing' });
});

describe('Jobs mutation audit atomicity', () => {
  it('lists only the current candidate own resumes', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/me/resumes`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'resume-1', kind: 'resume' }),
    ]));
    expect(mocks.vacancyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'employer-owner', kind: 'resume' },
    }));
  });

  it('changes candidate resume visibility and audits the change in one transaction', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/me/resumes/resume-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.jobVacancy.updateMany).toHaveBeenCalledWith({
      where: { id: 'resume-1', userId: 'employer-owner', kind: 'resume' },
      data: { status: 'closed' },
    });
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'jobs.resume.visibility_changed',
        entity: 'job_vacancy',
        entityId: 'resume-1',
        details: { from: 'open', to: 'closed' },
      }),
      mocks.tx,
    );
  });

  it('does not audit a resume visibility request when its status is unchanged', async () => {
    mocks.tx.jobVacancy.findFirst.mockResolvedValueOnce({ id: 'resume-1', status: 'closed' });

    const response = await fetch(`${baseUrl}/api/jobs/me/resumes/resume-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });

    expect(response.status).toBe(200);
    expect(auditFromReq).not.toHaveBeenCalled();
  });

  it('does not allow candidate resume status changes for a different owner or a vacancy', async () => {
    mocks.tx.jobVacancy.findFirst.mockResolvedValueOnce(null);

    const response = await fetch(`${baseUrl}/api/jobs/me/resumes/another-users-resume/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });

    expect(response.status).toBe(404);
    expect(mocks.tx.jobVacancy.updateMany).not.toHaveBeenCalled();
    expect(auditFromReq).not.toHaveBeenCalled();
  });

  it('fails candidate resume visibility changes when the audit write fails inside the transaction', async () => {
    mocks.auditFromReq.mockRejectedValueOnce(new Error('audit storage unavailable'));

    const response = await fetch(`${baseUrl}/api/jobs/me/resumes/resume-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });

    expect(response.status).toBe(500);
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ action: 'jobs.resume.visibility_changed' }),
      mocks.tx,
    );
  });

  it('creates a candidate resume and its audit record in one transaction', async () => {
    mocks.tx.jobVacancy.create.mockResolvedValueOnce({
      id: 'resume-1',
      title: 'Dentist',
      kind: 'resume',
    });

    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dentist', city: 'Тараз', kind: 'resume' }),
    });

    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'jobs.resume.created',
        entity: 'job_vacancy',
        entityId: 'resume-1',
        details: { kind: 'resume' },
      }),
      mocks.tx,
    );
  });

  it('creates a candidate application and its audit record in one transaction', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/vacancy-1/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverNote: 'Five years of clinical experience' }),
    });

    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.jobApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vacancyId: 'vacancy-1',
        userId: 'employer-owner',
        status: 'new',
      }),
    });
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'jobs.application.created',
        entity: 'job_application',
        entityId: 'application-2',
        details: { vacancyId: 'vacancy-1' },
      }),
      mocks.tx,
    );
  });

  it('returns an existing application without writing a duplicate audit event', async () => {
    mocks.tx.jobApplication.findFirst.mockResolvedValueOnce({
      id: 'application-existing',
      vacancyId: 'vacancy-1',
      userId: 'employer-owner',
      status: 'new',
    });

    const response = await fetch(`${baseUrl}/api/jobs/vacancy-1/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverNote: 'Retry' }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe('application-existing');
    expect(mocks.tx.jobApplication.create).not.toHaveBeenCalled();
    expect(auditFromReq).not.toHaveBeenCalled();
  });

  it('fails candidate resume creation when the audit write fails inside the transaction', async () => {
    mocks.auditFromReq.mockRejectedValueOnce(new Error('audit storage unavailable'));

    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dentist', city: 'Тараз', kind: 'resume' }),
    });

    expect(response.status).toBe(500);
    expect(mocks.auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ action: 'jobs.resume.created' }),
      mocks.tx,
    );
  });

  it('fails candidate application creation when the audit write fails inside the transaction', async () => {
    mocks.auditFromReq.mockRejectedValueOnce(new Error('audit storage unavailable'));

    const response = await fetch(`${baseUrl}/api/jobs/vacancy-1/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverNote: 'Apply' }),
    });

    expect(response.status).toBe(500);
    expect(mocks.auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ action: 'jobs.application.created' }),
      mocks.tx,
    );
  });

  it('creates a vacancy and its audit record through the same transaction client', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/employer/vacancies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dentist', city: 'Тараз' }),
    });

    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.jobVacancy.create).toHaveBeenCalledTimes(1);
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'jobs.vacancy.created',
        entity: 'job_vacancy',
        entityId: 'vacancy-1',
      }),
      mocks.tx,
    );
  });

  it('changes an application status and writes its audit record through the same transaction client', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/employer/applications/application-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.jobApplication.updateMany).toHaveBeenCalledWith({
      where: { id: 'application-1', status: 'new' },
      data: { status: 'reviewing' },
    });
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'jobs.application.status_changed',
        entity: 'job_application',
        entityId: 'application-1',
        details: { vacancyId: 'vacancy-1', from: 'new', to: 'reviewing' },
      }),
      mocks.tx,
    );
  });

  it('does not write an audit event when optimistic concurrency detects a conflict', async () => {
    mocks.tx.jobApplication.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await fetch(`${baseUrl}/api/jobs/employer/applications/application-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing' }),
    });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('APPLICATION_CONFLICT');
    expect(auditFromReq).not.toHaveBeenCalled();
  });

  it('fails the vacancy request when the audit write fails inside the transaction callback', async () => {
    mocks.auditFromReq.mockRejectedValueOnce(new Error('audit storage unavailable'));

    const response = await fetch(`${baseUrl}/api/jobs/employer/vacancies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dentist', city: 'Тараз' }),
    });

    expect(response.status).toBe(500);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(auditFromReq).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ action: 'jobs.vacancy.created' }),
      mocks.tx,
    );
  });
});
