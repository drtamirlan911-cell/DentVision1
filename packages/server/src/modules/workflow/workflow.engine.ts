import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { subscribe, type DomainEventName } from '../../lib/events.js';
import { uid } from '../../lib/helpers.js';

// Workflow Studio engine (Phase 9). Executes clinic automations built from a
// node graph, triggered by Event Bus events or manual runs. Node actions reuse
// the same primitives available to AI/API (audit, notifications).

interface WorkflowNode {
  id?: string;
  type: 'condition' | 'audit' | 'notification' | 'log';
  // condition
  field?: string;
  op?: 'eq' | 'neq' | 'exists' | 'contains';
  value?: unknown;
  // notification
  userId?: string;
  title?: string;
  message?: string;
  // audit / log
  action?: string;
}

const TRIGGER_EVENTS: DomainEventName[] = [
  'patient.created',
  'patient.deleted',
  'appointment.created',
];

function getField(obj: Record<string, unknown>, path?: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

function evalCondition(node: WorkflowNode, data: Record<string, unknown>): boolean {
  const actual = getField(data, node.field);
  switch (node.op) {
    case 'exists': return actual !== undefined && actual !== null;
    case 'neq': return actual !== node.value;
    case 'contains': return typeof actual === 'string' && actual.includes(String(node.value));
    case 'eq':
    default: return actual === node.value;
  }
}

async function runNode(
  node: WorkflowNode,
  ctx: { clinicId: string; workflowId: string; data: Record<string, unknown> },
): Promise<{ type: string; ok: boolean; note?: string; stop?: boolean }> {
  switch (node.type) {
    case 'condition': {
      const pass = evalCondition(node, ctx.data);
      return { type: 'condition', ok: true, note: pass ? 'passed' : 'failed', stop: !pass };
    }
    case 'audit':
      await prisma.auditLog.create({
        data: {
          id: uid(),
          clinicId: ctx.clinicId,
          action: node.action || 'workflow.action',
          entity: 'workflow',
          entityId: ctx.workflowId,
          details: { data: ctx.data } as Prisma.InputJsonValue,
        },
      });
      return { type: 'audit', ok: true };
    case 'notification':
      if (node.userId) {
        await prisma.notification.create({
          data: {
            id: uid(),
            userId: node.userId,
            type: 'workflow',
            title: node.title || 'Автоматизация',
            message: node.message || '',
          },
        });
        return { type: 'notification', ok: true };
      }
      return { type: 'notification', ok: false, note: 'no userId' };
    case 'log':
    default:
      return { type: node.type || 'log', ok: true };
  }
}

export async function runWorkflow(
  workflow: { id: string; scopeId: string; graph: unknown },
  triggerData: Record<string, unknown>,
) {
  const run = await prisma.workflowRun.create({
    data: { workflowId: workflow.id, status: 'running', triggerData: triggerData as object },
  });

  const nodes: WorkflowNode[] = Array.isArray((workflow.graph as any)?.nodes) ? (workflow.graph as any).nodes : [];
  const steps: unknown[] = [];
  let status = 'success';

  try {
    for (const node of nodes) {
      const result = await runNode(node, { clinicId: workflow.scopeId, workflowId: workflow.id, data: triggerData });
      steps.push(result);
      if (result.stop) break; // a failed condition halts the flow
    }
  } catch (err) {
    status = 'failed';
    steps.push({ type: 'error', ok: false, note: (err as Error).message });
  }

  return prisma.workflowRun.update({
    where: { id: run.id },
    data: { status, steps: steps as object, finishedAt: new Date() },
  });
}

async function handleEvent(event: string, payload: Record<string, unknown>) {
  const clinicId = payload.clinicId as string | undefined;
  if (!clinicId) return;
  const workflows = await prisma.workflow.findMany({
    where: { status: 'active', scopeType: 'CLINIC', scopeId: clinicId },
  });
  for (const wf of workflows) {
    const trigger = wf.trigger as { event?: string } | null;
    if (trigger?.event === event) {
      await runWorkflow(wf, { event, ...payload });
    }
  }
}

let registered = false;

export function registerWorkflowEngine(): void {
  if (registered) return;
  registered = true;
  for (const event of TRIGGER_EVENTS) {
    subscribe(event as DomainEventName, (payload) => handleEvent(event, payload as Record<string, unknown>));
  }
  console.log('[workflow] engine registered');
}
