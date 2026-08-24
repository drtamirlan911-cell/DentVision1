/**
 * Expires stale `AiApproval` rows.
 *
 * A high-risk action nobody approved within its window should stop being
 * approvable rather than sit "pending" forever — the requester finds out by
 * having to ask again, which is the correct outcome for a decision that
 * timed out unanswered.
 */

import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';

export interface ApprovalSweepResult {
  expired: number;
}

export async function sweepExpiredApprovals(): Promise<ApprovalSweepResult> {
  const result = await prisma.aiApproval
    .updateMany({
      where: { status: 'pending', expiresAt: { lte: new Date() } },
      data: { status: 'expired' },
    })
    .catch((err: any) => {
      if (String(err?.code) === 'P2021') return { count: 0 };
      throw err;
    });

  return { expired: result.count };
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Safe no-op if already started — same shape as `startOnCallInterval`. */
export function startAiApprovalSweeperInterval(ms = 15 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await withJobLock('ai_approval_sweeper', sweepExpiredApprovals);
      if (r?.expired) {
        // `warn`, not `log`: an expired approval means a high-risk action sat
        // unanswered past its window — not routine.
        console.warn(`[AiApprovalSweeper] expired=${r.expired}`);
      }
    } catch (err) {
      console.error('[AiApprovalSweeper] tick failed', err);
    }
  };
  setTimeout(tick, 30_000);
  timer = setInterval(tick, ms);
  console.warn(`[AiApprovalSweeper] interval started (every ${ms / 60000} min)`);
}
