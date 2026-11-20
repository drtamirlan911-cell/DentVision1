import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: { $queryRaw: queryRaw },
}));

import { createAiEmployeeTask, listAiEmployeeTasks, transitionAiEmployeeTask } from './aiEmployeeTasks.js';

interface CapturedSql {
  sql: string;
  values: unknown[];
}

function statement(index = 0): CapturedSql {
  const call = queryRaw.mock.calls[index];
  if (!call) throw new Error(`Missing captured SQL statement at index ${index}`);
  return call[0] as CapturedSql;
}

describe('AI Employee task SQL matches its durable table schema', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
  });

  it('binds clinic, user and source-event identifiers as text on insert', async () => {
    await createAiEmployeeTask({
      clinicId: 'clinic-text-id',
      userId: 'user-text-id',
      role: 'OWNER',
      title: 'Daily clinic summary',
      sourceEventId: 'event-text-id',
      sourceEventType: 'DailySummary',
    });

    const query = statement();
    expect(query.sql).toMatch(/INSERT INTO ai_employee_tasks/i);
    expect(query.sql).toMatch(/VALUES\s*\(CAST\(\? AS uuid\),\s*\?,\s*\?,/i);
    // Only the UUID primary key is cast; tenant, user and event columns are TEXT.
    expect(query.sql.match(/CAST\(\? AS uuid\)/gi) || []).toHaveLength(1);
    expect(query.values).toContain('clinic-text-id');
    expect(query.values).toContain('user-text-id');
    expect(query.values).toContain('event-text-id');
  });

  it('compares text tenant and user columns with text parameters, not UUID values', async () => {
    await listAiEmployeeTasks({
      clinicId: 'clinic-text-id',
      userId: 'user-text-id',
      role: 'OWNER',
    });

    const query = statement();
    expect(query.sql).toMatch(/clinic_id\s*=\s*\?/i);
    expect(query.sql).not.toMatch(/clinic_id\s*=\s*CAST\([^)]*AS uuid\)/i);
    expect(query.sql).toMatch(/user_id\s*=\s*\?/i);
    expect(query.sql).not.toMatch(/user_id\s*=\s*CAST\([^)]*AS uuid\)/i);
    expect(query.values).toContain('clinic-text-id');
    expect(query.values).toContain('user-text-id');
  });

  it('keeps UUID casting only for the UUID task primary key during transitions', async () => {
    queryRaw
      .mockResolvedValueOnce([{ status: 'queued' }])
      .mockResolvedValueOnce([]);

    await transitionAiEmployeeTask({
      id: '00000000-0000-4000-8000-000000000001',
      clinicId: 'clinic-text-id',
      status: 'proposed',
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    const lookup = statement(0);
    const update = statement(1);
    expect(lookup.sql).toMatch(/id\s*=\s*CAST\(\? AS uuid\)/i);
    expect(lookup.sql).toMatch(/clinic_id\s*=\s*\?/i);
    expect(lookup.sql).not.toMatch(/clinic_id\s*=\s*CAST\([^)]*AS uuid\)/i);
    expect(update.sql).toMatch(/id\s*=\s*CAST\(\? AS uuid\)/i);
    expect(update.sql).toMatch(/clinic_id\s*=\s*\?/i);
    expect(update.sql).not.toMatch(/clinic_id\s*=\s*CAST\([^)]*AS uuid\)/i);
    expect(update.values).toContain('clinic-text-id');
  });
  it('uses a text tenant parameter for idempotent transition readback', async () => {
    queryRaw
      .mockResolvedValueOnce([{ status: 'queued' }])
      .mockResolvedValueOnce([{ id: '00000000-0000-4000-8000-000000000001' }]);

    await transitionAiEmployeeTask({
      id: '00000000-0000-4000-8000-000000000001',
      clinicId: 'clinic-text-id',
      status: 'queued',
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    const readback = statement(1);
    expect(readback.sql).toMatch(/FROM ai_employee_tasks WHERE id = CAST\(\? AS uuid\) AND clinic_id = \?/i);
    expect(readback.sql).not.toMatch(/clinic_id\s*=\s*CAST\([^)]*AS uuid\)/i);
    expect(readback.values).toContain('clinic-text-id');
  });

  it('does not persist raw task exception details in the durable error column', async () => {
    queryRaw
      .mockResolvedValueOnce([{ status: 'executing' }])
      .mockResolvedValueOnce([]);

    const sensitive = 'SENSITIVE_CLINICAL_SENTINEL_7f93a1b2';
    await transitionAiEmployeeTask({
      id: '00000000-0000-4000-8000-000000000001',
      clinicId: 'clinic-text-id',
      status: 'failed',
      error: sensitive,
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    const update = statement(1);
    expect(update.values).not.toContain(sensitive);
    expect(update.values).toContain('Task failed; details omitted');
  });

  it('includes unassigned tasks only when requested for a role queue', async () => {
    await listAiEmployeeTasks({
      clinicId: 'clinic-text-id',
      userId: 'doctor-user-id',
      role: 'DOCTOR',
      includeUnassigned: true,
    });

    const query = statement();
    expect(query.sql).toMatch(/user_id\s*=\s*\?/i);
    expect(query.sql).toMatch(/\?\s*=\s*TRUE\s+AND\s+user_id\s+IS\s+NULL/i);
    expect(query.values).toContain('doctor-user-id');
    expect(query.values).toContain(true);
    expect(query.values).toContain('DOCTOR');
  });
});
