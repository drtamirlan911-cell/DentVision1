import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

  it('backfills legacy task keys without deleting task history and adds a partial unique index', () => {
    const migration = readFileSync(
      new URL('../../../../prisma/migrations/20261120_add_ai_employee_task_idempotency_key/migration.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
    expect(migration).toContain("SET idempotency_key = 'legacy:' || id::text");
    expect(migration).toContain('WHERE idempotency_key IS NULL');
    expect(migration).toMatch(/CREATE UNIQUE INDEX[\s\S]*ON ai_employee_tasks \(idempotency_key\)[\s\S]*WHERE idempotency_key IS NOT NULL/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+ai_employee_tasks/i);
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

  it('uses a deterministic idempotency key bound to the clinic tenant', async () => {
    const input = {
      clinicId: 'clinic-a',
      userId: 'user-a',
      role: 'OWNER',
      title: 'Retryable event task',
      sourceEventId: 'event-a',
      sourceEventType: 'DailySummary',
      action: 'generateDailySummary',
    };

    await createAiEmployeeTask(input);
    await createAiEmployeeTask(input);
    await createAiEmployeeTask({ ...input, clinicId: 'clinic-b' });

    expect(queryRaw).toHaveBeenCalledTimes(3);
    const expectedClinicA = 'evt:' + createHash('sha256')
      .update(['CLINIC', 'clinic-a', 'event-a', 'generateDailySummary', 'OWNER'].join('|'))
      .digest('hex');
    const expectedClinicB = 'evt:' + createHash('sha256')
      .update(['CLINIC', 'clinic-b', 'event-a', 'generateDailySummary', 'OWNER'].join('|'))
      .digest('hex');

    expect(statement(0).values.at(-1)).toBe(expectedClinicA);
    expect(statement(1).values.at(-1)).toBe(expectedClinicA);
    expect(statement(2).values.at(-1)).toBe(expectedClinicB);
    expect(statement(0).sql).toMatch(/ON CONFLICT\s*\(idempotency_key\)/i);
    expect(statement(0).sql).not.toMatch(/ON CONFLICT\s*\(source_event_id,\s*action,\s*role\)/i);
  });

  it('does not persist arbitrary action payload or non-allowlisted task metadata', async () => {
    const sentinel = 'SENSITIVE_TASK_PAYLOAD_SENTINEL_8f3c1d';
    await createAiEmployeeTask({
      clinicId: 'clinic-text-id',
      role: 'OWNER',
      title: 'Daily clinic summary',
      actionPayload: { patientName: sentinel, diagnosis: sentinel },
      metadata: {
        employeeMission: 'Контроль клиники',
        requiresHumanApproval: true,
        privateNote: sentinel,
      },
    });

    const query = statement();
    expect(JSON.stringify(query.values)).not.toContain(sentinel);
    expect(query.values).toContain(null);
    expect(query.values).toContain(JSON.stringify({
      employeeMission: 'Контроль клиники',
      requiresHumanApproval: true,
    }));
  });

  it('persists only allowlisted aggregate result fields and drops free text and identifiers', async () => {
    queryRaw
      .mockResolvedValueOnce([{ status: 'executing' }])
      .mockResolvedValueOnce([]);

    const sentinel = 'SENSITIVE_TASK_RESULT_SENTINEL_a7231c';
    await transitionAiEmployeeTask({
      id: '00000000-0000-4000-8000-000000000001',
      clinicId: 'clinic-text-id',
      status: 'completed',
      result: {
        status: 'completed',
        verified: true,
        totalCount: 12,
        completedCount: 10,
        patientId: sentinel,
        summary: sentinel,
        transcript: sentinel,
      },
    });

    const update = statement(1);
    expect(JSON.stringify(update.values)).not.toContain(sentinel);
    expect(update.values).toContain(JSON.stringify({
      status: 'completed',
      verified: true,
      totalCount: 12,
      completedCount: 10,
    }));
  });

  it('redacts stored legacy result, action payload and error before returning queue rows', async () => {
    const sentinel = 'LEGACY_TASK_PHI_SENTINEL_41d0';
    queryRaw.mockResolvedValueOnce([{
      id: 'task-legacy',
      clinicId: 'clinic-text-id',
      userId: 'doctor-user-id',
      role: 'DOCTOR',
      employeeTitle: 'AI Clinical Assistant',
      title: 'PatientCreated: notify',
      description: 'An internal task',
      status: 'failed',
      risk: 'low',
      autonomy: 'execute_with_approval',
      sourceEventId: 'event-legacy',
      sourceEventType: 'PatientCreated',
      action: 'notify',
      actionPayload: { patientName: sentinel },
      result: { patientId: sentinel, summary: sentinel, totalCount: 3 },
      error: sentinel,
      dueAt: null,
      createdAt: new Date('2026-11-20T00:00:00.000Z'),
      updatedAt: new Date('2026-11-20T00:00:00.000Z'),
      completedAt: null,
    }]);

    const [task] = await listAiEmployeeTasks({ clinicId: 'clinic-text-id' });

    expect(task.actionPayload).toBeNull();
    expect(task.result).toEqual({ totalCount: 3 });
    expect(task.error).toBe('Task failed; details omitted');
    expect(JSON.stringify(task)).not.toContain(sentinel);
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
