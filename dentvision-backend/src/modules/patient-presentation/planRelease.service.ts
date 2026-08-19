/**
 * The Doctor Approval Layer — the only way a treatment plan reaches a patient.
 *
 * `TreatmentPlan.items` is a mutable JSON blob with three writers, one of which
 * is an LLM agent. A status column on that row could therefore be set by
 * something that is not a doctor, and the document could change under the
 * patient mid-read. So the boundary is a separate table written by exactly one
 * function: `approveAndRelease`.
 *
 * Two facts, deliberately separate columns:
 *   `approvedAt`  — a named clinician signed off on the medicine.
 *   `publishedAt` — the patient may see it.
 * The UI presents them as one flow (approve → preview → publish), but without
 * the second the doctor would be signing off on words they never read.
 *
 * Nothing here reads `TreatmentPlan` on behalf of a patient. `getPublishedRelease`
 * is the patient-facing read and it only ever touches `treatmentPlanRelease`.
 */

import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { buildPlanOptions, type PlanOption } from '../../lib/planOptions.js';
import {
  collectPlanTeeth,
  enrichStages,
  normalizePlanItems,
  planTotal,
  type TreatmentPlanItems,
} from '../../lib/treatmentPlanShape.js';

/** A price shown to a patient is an offer, so it does not live forever. */
export const DEFAULT_RELEASE_VALIDITY_DAYS = 30;

export class PlanReleaseError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'FORBIDDEN' | 'EMPTY_PLAN' | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'PlanReleaseError';
  }
}

/** Stable stringify so the hash does not change when key order does. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function hashSnapshot(snapshot: unknown): string {
  return createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
}

/**
 * The frozen document, plus the three option levels resolved into real prices.
 *
 * Options are computed here, at freeze time, rather than when the patient looks:
 * the alternatives the doctor marked point at price-list rows that will move,
 * and a level whose price changed after approval would contradict the total the
 * doctor signed.
 */
export type FrozenSnapshot = TreatmentPlanItems & { options?: PlanOption[] };

export interface FrozenPlan {
  snapshot: FrozenSnapshot;
  snapshotHash: string;
  totalAmount: number;
}

/**
 * Normalise, enrich and total the plan exactly once, then hash the result.
 * Everything downstream — the patient's view, the printed plan, the funnel —
 * quotes this, never `TreatmentPlan.price`, which several writers leave stale.
 */
export function freezePlan(items: unknown, opts: { title?: string } = {}): FrozenPlan {
  const normalized = normalizePlanItems(items);
  const stages = enrichStages(normalized.stages);
  const options = buildPlanOptions(stages);
  const snapshot: FrozenSnapshot = {
    ...normalized,
    stages,
    teeth: collectPlanTeeth(stages),
    totalBudget: planTotal(stages),
    options,
  };
  if (opts.title) (snapshot as Record<string, unknown>).title = opts.title;
  return {
    snapshot,
    snapshotHash: hashSnapshot(snapshot),
    totalAmount: planTotal(stages),
  };
}

export interface ApproveAndReleaseInput {
  planId: string;
  approvedByUserId: string;
  approvalNote?: string | null;
  /** Publish to the patient in the same call. The UI does this after preview. */
  publish?: boolean;
  validityDays?: number;
}

/**
 * Freeze a plan and record who approved it.
 *
 * The actor is required and must resolve to a real clinic member holding
 * `medical.manage` — checked by the route, and required here structurally
 * because an agent has no user id to offer. Any earlier approved release for
 * the same plan is superseded in the same transaction, so a patient can never
 * hold two live versions.
 */
export async function approveAndRelease(input: ApproveAndReleaseInput) {
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: input.planId },
    select: {
      id: true,
      title: true,
      items: true,
      patientId: true,
      patient: { select: { clinicId: true } },
    },
  });
  if (!plan || !plan.patient?.clinicId) {
    throw new PlanReleaseError('NOT_FOUND', 'План не найден');
  }

  const frozen = freezePlan(plan.items, { title: plan.title });
  if (!frozen.snapshot.stages?.some((s) => (s.items?.length ?? 0) > 0)) {
    // A plan with no priced work is not something to put in front of a patient,
    // and it is the exact shape the AI agent used to write.
    throw new PlanReleaseError('EMPTY_PLAN', 'В плане нет ни одной услуги — публиковать нечего');
  }

  const now = new Date();
  const validityDays = input.validityDays ?? DEFAULT_RELEASE_VALIDITY_DAYS;
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 3600 * 1000);

  return prisma.$transaction(async (tx) => {
    // Supersede first: after this there is at most one approved release, and
    // the unique index on (planId, version) settles any concurrent second call.
    await tx.treatmentPlanRelease.updateMany({
      where: { planId: plan.id, status: 'approved' },
      data: { status: 'superseded' },
    });

    const last = await tx.treatmentPlanRelease.findFirst({
      where: { planId: plan.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return tx.treatmentPlanRelease.create({
      data: {
        planId: plan.id,
        clinicId: plan.patient!.clinicId,
        patientId: plan.patientId,
        version: (last?.version ?? 0) + 1,
        status: 'approved',
        snapshot: frozen.snapshot as unknown as Prisma.InputJsonValue,
        snapshotHash: frozen.snapshotHash,
        totalAmount: frozen.totalAmount,
        approvedByUserId: input.approvedByUserId,
        approvedAt: now,
        approvalNote: input.approvalNote ?? null,
        publishedAt: input.publish ? now : null,
        expiresAt,
      },
    });
  });
}

/** Second gate: the doctor has read the words and lets the patient see them. */
export async function publishRelease(releaseId: string) {
  const claimed = await prisma.treatmentPlanRelease.updateMany({
    where: { id: releaseId, status: 'approved', publishedAt: null },
    data: { publishedAt: new Date() },
  });
  if (claimed.count === 0) {
    const current = await prisma.treatmentPlanRelease.findUnique({ where: { id: releaseId } });
    if (!current) throw new PlanReleaseError('NOT_FOUND', 'Публикация не найдена');
    if (current.publishedAt) return current; // already published — idempotent
    throw new PlanReleaseError('CONFLICT', 'Эта версия плана больше не активна');
  }
  return prisma.treatmentPlanRelease.findUnique({ where: { id: releaseId } });
}

/**
 * Pull a plan back. The patient stops seeing it on their very next request —
 * `getPublishedRelease` re-queries every time, so there is no cache to clear.
 */
export async function withdrawRelease(releaseId: string, byUserId: string, reason?: string | null) {
  const claimed = await prisma.treatmentPlanRelease.updateMany({
    where: { id: releaseId, status: 'approved' },
    data: {
      status: 'withdrawn',
      withdrawnAt: new Date(),
      withdrawnByUserId: byUserId,
      withdrawReason: reason ?? null,
    },
  });
  if (claimed.count === 0) {
    throw new PlanReleaseError('NOT_FOUND', 'Активная публикация не найдена');
  }
  return prisma.treatmentPlanRelease.findUnique({ where: { id: releaseId } });
}

/**
 * The patient-facing read. Fail-closed and re-evaluated on every call:
 * approved, published, not withdrawn, not expired. An expired release is
 * treated as absent rather than shown with a stale price.
 */
export async function getPublishedRelease(patientId: string, releaseId?: string) {
  const now = new Date();
  return prisma.treatmentPlanRelease.findFirst({
    where: {
      ...(releaseId ? { id: releaseId } : {}),
      patientId,
      status: 'approved',
      publishedAt: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { clinic: { select: { id: true, name: true } } },
    orderBy: { approvedAt: 'desc' },
  });
}

/** Every published, still-valid release for a patient — what the portal lists. */
export async function listPublishedReleases(patientId: string) {
  const now = new Date();
  return prisma.treatmentPlanRelease.findMany({
    where: {
      patientId,
      status: 'approved',
      publishedAt: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { clinic: { select: { id: true, name: true } } },
    orderBy: { approvedAt: 'desc' },
    take: 20,
  });
}

/** Clinic-side history for one plan, including superseded and withdrawn versions. */
export async function listReleasesForPlan(planId: string) {
  return prisma.treatmentPlanRelease.findMany({
    where: { planId },
    orderBy: { version: 'desc' },
  });
}
