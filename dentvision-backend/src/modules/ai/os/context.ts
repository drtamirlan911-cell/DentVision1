/**
 * Context engine (Stage 10) — the spec's rule that the AI must not ask for
 * context the system already knows. `buildAiContext` consolidates what the
 * orchestrator already had scattered as loose scalars (pathname, role,
 * clinic) plus the two pieces that were missing: the entity actually open in
 * the caller's workspace, and recent tool-call history.
 *
 * `entity` is the one field with real teeth: `kernel.ts` step 4c reads it to
 * fill a missing `patientId` argument instead of leaving the model to guess
 * or re-ask. Everything here is read from verified server state (the JWT's
 * clinicId is re-resolved, never trusted as-is) or from `hints`, which the
 * caller is responsible for treating as a UI convenience, not an identity
 * claim — `entity.id` is only ever substituted into a tool call, never used
 * to widen what the caller is allowed to see.
 */

import prisma from '../../../lib/prisma.js';
import { resolveOrganizationIdForClinic } from '../../../lib/orgContext.js';
import { stageFromPath } from '../lib/platformMap.js';
import type { AuthRequest } from '../../../types/index.js';

export interface ContextHints {
  pathname?: string | null;
  /** 'workspace' (the default focus) never resolves to an entity — there is nothing open. */
  focusType?: string | null;
  focusId?: string | null;
}

export interface AiRequestContext {
  user: { id: string; role: string; name?: string };
  organizationId: string | null;
  clinicId: string | null;
  page: { pathname: string; pageId: string | null };
  /** The open card in the caller's workspace, if any — null on the plain workspace view. */
  entity: { type: string; id: string } | null;
  /**
   * No product concept of a per-user "active workflow" exists yet (Workflow
   * Studio's `WorkflowRun` is clinic-configured automation, not a step a
   * person is walking through) — always null until one does. Honest gap,
   * not a stub pretending to be real.
   */
  workflow: { id: string; state: string } | null;
  recentEvents: Array<{ type: string; at: string }>;
}

const RECENT_EVENTS_LIMIT = 5;

export async function buildAiContext(req: AuthRequest, hints: ContextHints): Promise<AiRequestContext> {
  const user = req.user!;
  const clinicId = user.clinicId || null;
  const organizationId = clinicId ? await resolveOrganizationIdForClinic(clinicId) : null;

  const pathname = hints.pathname || '';
  const pageId = pathname ? stageFromPath(pathname) : null;

  const focusType = hints.focusType || null;
  const entity =
    focusType && focusType !== 'workspace' && hints.focusId ? { type: focusType, id: String(hints.focusId) } : null;

  const recentEvents = await prisma.agentActivity
    .findMany({
      where: { actorUserId: user.id },
      orderBy: { createdAt: 'desc' },
      take: RECENT_EVENTS_LIMIT,
      select: { tool: true, createdAt: true },
    })
    .then((rows) => rows.map((r) => ({ type: r.tool, at: r.createdAt.toISOString() })))
    .catch(() => []); // fresh boot / migration not yet applied — an empty history, not a failed request

  return {
    user: { id: user.id, role: String(user.role), name: `${user.firstName} ${user.lastName}`.trim() || undefined },
    organizationId,
    clinicId,
    page: { pathname, pageId },
    entity,
    workflow: null,
    recentEvents,
  };
}
