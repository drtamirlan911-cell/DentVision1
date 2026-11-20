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
  return queryRaw.mock.calls[index][0] as CapturedSql;
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
    expect(query.sql).not.toMatch(/CAST\(\? AS uuid\).*clinic_id/i);
    expect(query.sql).not.toMatch(/CAST\(\? AS uuid\).*source_event_id/i);
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
});
