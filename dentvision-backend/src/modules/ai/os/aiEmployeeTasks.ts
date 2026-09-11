/** Durable operational task ledger for role-based AI Employees.
 *
 * Kept outside Prisma's generated model surface deliberately: the task ledger
 * is additive and can be deployed independently from the large legacy schema.
 * The migration creates the table; this service uses parameterised raw SQL.
 */
import { randomUUID } from 'node:crypto';
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
  const payload = input.actionPayload == null ? null : JSON.stringify(input.actionPayload);
  const metadata = JSON.stringify(input.metadata || {});
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    INSERT INTO ai_employee_tasks
      (id, clinic_id, user_id, role, employee_title, title, description, status, risk, autonomy,
       source_event_id, source_event_type, action, action_payload, metadata, due_at, created_at, updated_at)
    VALUES
      (${id}, ${input.clinicId}, ${input.userId || null}, ${contract.role}, ${contract.title}, ${input.title},
       ${input.description || null}, ${status}, ${risk}, ${contract.autonomy}, ${input.sourceEventId || null},
       ${input.sourceEventType || null}, ${input.action || null}, ${payload}::jsonb, ${metadata}::jsonb,
       ${input.dueAt || null}, NOW(), NOW())
    ON CONFLICT (source_event_id, action, role)
      WHERE source_event_id IS NOT NULL AND action IS NOT NULL
      DO NOTHING
    RETURNING id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
  `);
  return rows[0] || null;
}

export async function listAiEmployeeTasks(input: {
  clinicId: string;
  userId?: string | null;
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
      AND (${input.userId || null}::text IS NULL OR user_id = ${input.userId || null})
    ORDER BY CASE WHEN status IN ('awaiting_approval','proposed','queued') THEN 0 ELSE 1 END, created_at DESC
    LIMIT ${limit}
  `);
  return rows;
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
    WHERE id = ${input.id} AND clinic_id = ${input.clinicId}
    LIMIT 1
  `);
  const current = currentRows[0]?.status;
  if (!current) return null;
  if (current === input.status) return getAiEmployeeTask(input.id, input.clinicId);
  if (!ALLOWED_TRANSITIONS[current].has(input.status)) {
    throw new Error(`Invalid AI task transition: ${current} -> ${input.status}`);
  }

  const result = input.result == null ? null : JSON.stringify(input.result);
  const completed = ['completed', 'failed', 'cancelled'].includes(input.status);
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    UPDATE ai_employee_tasks
    SET status = ${input.status},
        result = COALESCE(${result}::jsonb, result),
        error = CASE WHEN ${input.error || null}::text IS NULL THEN error ELSE ${input.error || null} END,
        completed_at = CASE WHEN ${completed} THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = ${input.id} AND clinic_id = ${input.clinicId} AND status = ${current}
    RETURNING id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
  `);
  return rows[0] || null;
}

async function getAiEmployeeTask(id: string, clinicId: string): Promise<AiEmployeeTask | null> {
  const rows = await prisma.$queryRaw<AiEmployeeTask[]>(Prisma.sql`
    SELECT id, clinic_id AS "clinicId", user_id AS "userId", role, employee_title AS "employeeTitle",
      title, description, status, risk, autonomy, source_event_id AS "sourceEventId",
      source_event_type AS "sourceEventType", action, action_payload AS "actionPayload",
      result, error, due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
    FROM ai_employee_tasks WHERE id = ${id} AND clinic_id = ${clinicId} LIMIT 1
  `);
  return rows[0] || null;
}
