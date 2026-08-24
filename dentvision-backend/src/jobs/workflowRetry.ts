/**
 * Retries failed Workflow Studio runs.
 *
 * A workflow node can fail transiently (a notification target briefly
 * unreachable, a DB hiccup) — retrying a handful of times beats leaving the
 * clinic's automation silently stuck. Capped at 3 attempts per run so a
 * workflow that's failing for a real reason (bad graph, missing data) stops
 * retrying instead of polling forever.
 */

import prisma from '../lib/prisma.js';
import { retryWorkflowRun } from '../modules/workflow/workflow.engine.js';

export interface WorkflowRetrySweepResult {
  retried: number;
}

export async function sweepFailedWorkflowRuns(): Promise<WorkflowRetrySweepResult> {
  const runs = await prisma.workflowRun
    .findMany({
      where: { status: 'failed', attempts: { lt: 3 } },
      select: { id: true },
      take: 100,
    })
    .catch((err: any) => {
      if (String(err?.code) === 'P2021') return [];
      throw err;
    });

  for (const run of runs) {
    await retryWorkflowRun(run.id);
  }

  return { retried: runs.length };
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Safe no-op if already started — same shape as `startAiApprovalSweeperInterval`. */
export function startWorkflowRetryInterval(ms = 15 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await sweepFailedWorkflowRuns();
      if (r.retried) {
        console.warn(`[WorkflowRetry] retried=${r.retried}`);
      }
    } catch (err) {
      console.error('[WorkflowRetry] tick failed', err);
    }
  };
  setTimeout(tick, 30_000);
  timer = setInterval(tick, ms);
  console.warn(`[WorkflowRetry] interval started (every ${ms / 60000} min)`);
}
