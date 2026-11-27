/** Durable operational task ledger for role-based AI Employees.
 *
 * Kept outside Prisma's generated model surface deliberately: the task ledger
 * is additive and can be deployed independently from the large legacy schema.
 * The migration creates the table; this service uses parameterised raw SQL.
 */
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { employeeContractForRole, type AiAutonomy } from './employeeContract.js';

export type AiTaskStatus = 'queued' | 'observing' | 'proposed' | 'awaiting_approval' | 'executing' | 'verified' | 'completed' | 'failed' | 'cancelled';
export type AiTaskRisk = 'low' | 'medium' | 'high' | 'critical';

export interface CreateAiEmployeeTaskInput {
  clinicId: string;
  userId?: string | null;
  role: string;
  title: string;
  description?: string | null;
  sourceEventId?: string | null;
  sourceEventType?: string | null;
  action?: string | null;
  actionPayload?: unknown;
  risk?: AiTaskRisk;
  status?: AiTaskStatus;
  dueAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface AiEmployeeTask {
  id: string;
  clinicId: string;
  userId: string | null;
  role: string;
  employeeTitle: string;
  title: string;
  description: string | null;
  status: AiTaskStatus;
  risk: AiTaskRisk;
  autonomy: AiAutonomy;
  sourceEventId: string | null;
  sourceEventType: string | null;
  action: string | null;
  actionPayload: unknown;
  result: unknown;
  error: string | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

const SAFE_RESULT_STATUSES = new Set([
  'ok', 'success', 'completed', 'failed', 'partial', 'verified', 'pending', 'queued', 'skipped', 'cancelled',
]);
const SAFE_RESULT_COUNTS = ['totalCount', 'completedCount', 'failedCount', 'skippedCount'] as const;

/**
 * Task results are visible in role queues and are not a PHI vault.
 * Persist/return only small machine-readable aggregates; never free text,
 * patient/entity identifiers, transcripts, provider payloads or arbitrary JSON.
 */
function sanitizeAiTaskResult(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  for (const key of ['status', 'outcome']) {
    const candidate = source[key];
    if (typeof candidate === 'string' && SAFE_RESULT_STATUSES.has(candidate)) safe[key] = candidate;
  }
  if (typeof source.verified === 'boolean') safe.verified = source.verified;

  for (const key of SAFE_RESULT_COUNTS) {
    const candidate = source[key];
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 && candidate <= 1_000_000) {
      safe[key] = candidate;
    }
  }

  return Object.keys(safe).length ? safe : null;
}

function sanitizeAiEmployeeTask(task: AiEmployeeTask): AiEmployeeTask {
  return {
    ...task,
    // The task ledger is work memory, not an execution-payload transport.
    actionPayload: null,
    result: sanitizeAiTaskResult(task.result),
    error: task.error ? 'Task failed; details omitted' : null,
  };
}

function sanitizeTaskMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  const source = value || {};
  const safe: Record<string, unknown> = {};
  for (const key of ['ruleId', 'agent', 'employeeMission'] as const) {
    const candidate = source[key];
    if (typeof candidate === 'string') safe[key] = candidate.slice(0, 240);
  }
  for (const key of ['parallel', 'requiresHumanApproval'] as const) {
    if (typeof source[key] === 'boolean') safe[key] = source[key];
  }
  return safe;
}

const VALID_STATUSES = new Set<AiTaskStatus>([
  'queued', 'observing', 'proposed', 'awaiting_approval', 'executing', 'verified', 'completed', 'failed', 'cancelled',
]);

/** A task cannot skip approval or jump directly to a terminal state. */
const ALLOWED_TRANSITIONS: Record<AiTaskStatus, ReadonlySet<AiTaskStatus>> = {
  queued: new Set(['observing', 'proposed', 'awaiting_approval', 'cancelled']),
  observing: new Set(['proposed', 'awaiting_approval', 'queued', 'failed', 'cancelled']),
  proposed: new Set(['awaiting_approval', 'queued', 'cancelled', 'failed']),
  awaiting_approval: new Set(['executing', 'cancelled', 'failed']),
  executing: new Set(['verified', 'completed', 'failed', 'cancelled']),
  verified: new Set(['completed', 'failed']),
  completed: new Set([]),
  failed: new Set([]),
  cancelled: new Set([]),
};

export async function createAiEmployeeTask(input: CreateAiEmployeeTaskInput): Promise<AiEmployeeTask | null> {
  if (!input.clinicId || !input.title) return null;
  const contract = employeeContractForRole(input.role);
  const id = randomUUID();
  const status = input.status || (contract.autonomy === 'execute_with_approval' ? 'proposed' : 'queued');
  const risk = input.risk || 'low';
  // Tasks are not an executor. Do not duplicate arbitrary/possibly clinical payloads.
  const payload = null;
  const metadata = JSON.stringify(sanitizeTaskMetadata(input.metadata));
  // Idempotency is tenant-bound. A source event/action/role may be retried by
  // a worker, but it must never collide with another clinic's task.
  const idempotencyKey = input.sourceEventId && input.action
    ? 'evt:' + createHash('sha256')
      .update(['CLINIC', input.clinicId, input.sourceEventId, input.action, contract.role].join('|'))
      .digest('hex')
    : null;
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    INSERT INTO ai_employee_tasks
      (id, clinic_id, user_id, role, employee_title, title, description, status, risk, autonomy,
       source_event_id, source_event_type, action, action_payload, metadata, due_at, created_at, updated_at, idempotency_key)
    VALUES
      (CAST(${id} AS uuid), ${input.clinicId}, ${input.userId || null}, ${contract.role}, ${contract.title}, ${input.title},
       ${input.description || null}, ${status}, ${risk}, ${contract.autonomy}, ${input.sourceEventId || null}, ${input.sourceEventType || null},
       ${input.action || null}, ${payload}::jsonb, ${metadata}::jsonb, ${input.dueAt || null}, NOW(), NOW(), ${idempotencyKey})
    ON CONFLICT (idempotency_key)
      WHERE idempotency_key IS NOT NULL
      DO NOTHING
    RETURNING id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
  `);
  return rows[0] ? sanitizeAiEmployeeTask(rows[0]) : null;
}

export async function listAiEmployeeTasks(input: {
  clinicId: string;
  userId?: string | null;
  /** Include unassigned tasks from the caller's verified role queue. */
  includeUnassigned?: boolean;
  role?: string | null;
  status?: AiTaskStatus | null;
  limit?: number;
}): Promise<AiEmployeeTask[]> {
  const limit = Math.min(Math.max(input.limit || 30, 1), 100);
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    SELECT id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
    FROM ai_employee_tasks
    WHERE clinic_id = ${input.clinicId}
      AND (${input.role || null}::text IS NULL OR role = ${input.role || null})
      AND (${input.status || null}::text IS NULL OR status = ${input.status || null})
      AND (
        ${input.userId || null}::text IS NULL
        OR user_id = ${input.userId || null}
        OR (${input.includeUnassigned === true} = TRUE AND user_id IS NULL)
      )
    ORDER BY CASE WHEN status IN ('awaiting_approval','proposed','queued') THEN 0 ELSE 1 END, created_at DESC
    LIMIT ${limit}
  `);
  return rows.map(sanitizeAiEmployeeTask);
}

export async function transitionAiEmployeeTask(input: {
  id: string;
  clinicId: string;
  status: AiTaskStatus;
  result?: unknown;
  error?: string | null;
}): Promise<AiEmployeeTask | null> {
  if (!VALID_STATUSES.has(input.status)) throw new Error('Invalid AI task status');

  const currentRows = await prisma.$queryRaw<Array<{ status: AiTaskStatus }>>(Prisma.sql`
    SELECT status FROM ai_employee_tasks
    WHERE id = CAST(${input.id} AS uuid) AND clinic_id = ${input.clinicId}
    LIMIT 1
  `);
  const current = currentRows[0]?.status;
  if (!current) return null;
  if (current === input.status) return getAiEmployeeTask(input.id, input.clinicId);
  if (!ALLOWED_TRANSITIONS[current].has(input.status)) {
    throw new Error(`Invalid AI task transition: ${current} -> ${input.status}`);
  }

  const safeResult = sanitizeAiTaskResult(input.result);
  const result = safeResult == null ? null : JSON.stringify(safeResult);
  // The request may contain exception text copied from clinical/provider errors.
  // Task rows are not an exception vault: retain the failure signal, not the raw details.
  const safeError = typeof input.error === 'string' && input.error.trim()
    ? 'Task failed; details omitted'
    : null;
  const completed = ['completed', 'failed', 'cancelled'].includes(input.status);
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    UPDATE ai_employee_tasks
    SET status = ${input.status},
        result = COALESCE(${result}::jsonb, result),
        error = CASE WHEN ${safeError}::text IS NULL THEN error ELSE ${safeError} END,
        completed_at = CASE WHEN ${completed} THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = CAST(${input.id} AS uuid) AND clinic_id = ${input.clinicId} AND status = ${current}
    RETURNING id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
  `);
  return rows[0] ? sanitizeAiEmployeeTask(rows[0]) : null;
}

async function getAiEmployeeTask(id: string, clinicId: string): Promise<AiEmployeeTask | null> {
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    SELECT id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
    FROM ai_employee_tasks WHERE id = CAST(${id} AS uuid) AND clinic_id = ${clinicId} LIMIT 1
  `);
  return rows[0] ? sanitizeAiEmployeeTask(rows[0]) : null;
}
