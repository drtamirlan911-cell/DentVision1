/**
 * Durable recall agent — finds patients overdue for a follow-up visit and
 * surfaces them through the Approval Center instead of acting on its own.
 *
 * There is no tool in the registry that safely re-engages a patient without
 * a human choosing a time and picking up the phone, so this agent proposes
 * `getRecallList` (read-only, `patients.read`) rather than inventing
 * incomplete `createAppointment` params — approving it hands staff the
 * current list to work from, exactly what a marketing/reception recall
 * queue needs. One pending row per clinic at a time: a fresh run never
 * piles duplicates on top of one nobody has decided yet.
 */

import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { uid } from '../lib/helpers.js';
import { buildClinicLoadPlan } from '../modules/ai/core/clinicLoadPlan.js';
import { TOOL_PERMISSIONS } from '../modules/ai/os/toolPermissions.js';

const INACTIVE_DAYS = 90;
const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUESTER_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER];

export interface RecallSweepResult {
  proposed: number;
}

/**
 * `runAiAction`'s staff branch re-verifies `requestedByUserId` against real
 * clinic membership on approve (`resolveAiToolAccess`), so the row must name
 * an actual staffer, not a synthetic `system:` id — unlike the admin/patient
 * surfaces, staff has no pre-kernel trust boundary to inherit instead.
 */
async function findRequester(clinicId: string): Promise<string | null> {
  const member = await prisma.clinicMember.findFirst({
    where: { clinicId, role: { in: REQUESTER_ROLES } },
    select: { userId: true },
    orderBy: { joinedAt: 'asc' },
  });
  return member?.userId ?? null;
}

async function proposeForClinic(clinicId: string): Promise<boolean> {
  const existing = await prisma.aiApproval.findFirst({
    where: { clinicId, tool: 'getRecallList', status: 'pending' },
    select: { id: true },
  });
  if (existing) return false;

  const plan = await buildClinicLoadPlan(clinicId, { inactiveDays: INACTIVE_DAYS });
  const recall = Array.isArray(plan.payload.recall) ? plan.payload.recall : [];
  if (recall.length === 0) return false;

  const requestedByUserId = await findRequester(clinicId);
  if (!requestedByUserId) return false; // no eligible staffer to request on behalf of

  const limit = Math.min(recall.length, 20);
  await prisma.aiApproval.create({
    data: {
      id: uid(),
      clinicId,
      organizationId: null,
      requestedByUserId,
      surface: 'staff',
      agentId: null,
      tool: 'getRecallList',
      params: { inactiveDays: INACTIVE_DAYS, limit } as never,
      summary: `${recall.length} пациентов не были в клинике более ${INACTIVE_DAYS} дней — проверить список для реактивации`,
      requiredPermission: TOOL_PERMISSIONS.getRecallList || null,
      riskLevel: 'standard',
      status: 'pending',
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
    },
  });
  return true;
}

export async function sweepOverdueRecalls(): Promise<RecallSweepResult> {
  const clinics = await prisma.clinic.findMany({ select: { id: true } });
  let proposed = 0;

  for (const { id: clinicId } of clinics) {
    try {
      if (await proposeForClinic(clinicId)) proposed += 1;
    } catch (err: any) {
      // Fresh boot, migration hasn't run yet — skip this clinic, not the whole sweep.
      if (String(err?.code) === 'P2021') continue;
      throw err;
    }
  }

  return { proposed };
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Safe no-op if already started — same shape as the other durable jobs in this directory. */
export function startRecallAgentInterval(ms = 24 * 60 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await sweepOverdueRecalls();
      if (r.proposed) {
        console.warn(`[RecallAgent] proposed=${r.proposed}`);
      }
    } catch (err) {
      console.error('[RecallAgent] tick failed', err);
    }
  };
  setTimeout(tick, 60_000);
  timer = setInterval(tick, ms);
  console.warn(`[RecallAgent] interval started (every ${ms / 60000} min)`);
}
