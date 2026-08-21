/**
 * Visibility for the Agent Activity Center (Agentic OS §12 observability).
 *
 * Visibility is a different question from "may this tool run" (that's
 * `access.ts` + the kernel) — it's "whose recorded activity may this caller
 * see". A DOCTOR with no `bi.read` still gets to see their own AI actions
 * (accountability shouldn't require a reporting permission); `bi.read`
 * widens that to the whole clinic (and, when the caller's permission graph
 * is organization-scoped, the whole organization); only SUPERADMIN sees the
 * platform tier. `assigned_team` (teamKey) has no producer yet — Stage 9
 * is what starts stamping it on activity rows — so that branch is omitted
 * here rather than shipped as dead code that always evaluates to nothing.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { resolveClinicAccess, resolveOrganizationIdForClinic } from '../../../lib/orgContext.js';
import { resolveUserPermissions } from '../../../lib/resolvePermissions.js';
import { permissionsSatisfy } from '../../../lib/permissions.js';

export interface ActivityVisibility {
  where: Prisma.AgentActivityWhereInput;
  /** Whether PHI-sensitivity rows may be shown unredacted to this caller. */
  canReadPhi: boolean;
}

export interface ApprovalVisibility {
  where: Prisma.AiApprovalWhereInput;
}

interface VisibilityTier {
  isPlatform: boolean;
  resolvedClinicId: string | null;
  organizationId: string | null;
  canReadWide: boolean;
  canReadPhi: boolean;
}

/** Matches nothing — for a caller we cannot identify at all. */
const DENY_ALL = { id: { equals: '__no_such_activity__' } };

/**
 * Shared identity/permission resolution behind both `buildActivityFilter`
 * and `buildApprovalFilter` — one DB round-trip for role + clinic
 * membership + permission set, reused to build either model's WHERE clause.
 * Returns `null` for a caller that cannot be identified at all.
 */
async function resolveVisibilityTier(userId: string, clinicId: string | null): Promise<VisibilityTier | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return null;

  if (user.role === 'SUPERADMIN') {
    return { isPlatform: true, resolvedClinicId: null, organizationId: null, canReadWide: true, canReadPhi: true };
  }

  let role = String(user.role);
  let resolvedClinicId: string | null = null;
  let organizationId: string | null = null;
  if (clinicId) {
    const access = await resolveClinicAccess(userId, clinicId);
    if (access) {
      role = access.role;
      resolvedClinicId = clinicId;
      organizationId = await resolveOrganizationIdForClinic(clinicId);
    }
  }

  const permissions = new Set(await resolveUserPermissions(userId, organizationId ?? resolvedClinicId, role));
  return {
    isPlatform: false,
    resolvedClinicId,
    organizationId,
    canReadWide: permissionsSatisfy(permissions, 'bi.read'),
    canReadPhi: permissionsSatisfy(permissions, 'medical.read'),
  };
}

export async function buildActivityFilter(userId: string, clinicId: string | null): Promise<ActivityVisibility> {
  const tier = await resolveVisibilityTier(userId, clinicId);
  if (!tier) return { where: DENY_ALL, canReadPhi: false };
  if (tier.isPlatform) return { where: {}, canReadPhi: true };

  const or: Prisma.AgentActivityWhereInput[] = [{ actorUserId: userId }];
  if (tier.canReadWide && tier.resolvedClinicId) or.push({ clinicId: tier.resolvedClinicId });
  if (tier.canReadWide && tier.organizationId) or.push({ organizationId: tier.organizationId });

  return { where: { OR: or }, canReadPhi: tier.canReadPhi };
}

/** Same visibility ladder as `buildActivityFilter`, keyed to `AiApproval`'s own field names. */
export async function buildApprovalFilter(userId: string, clinicId: string | null): Promise<ApprovalVisibility> {
  const tier = await resolveVisibilityTier(userId, clinicId);
  if (!tier) return { where: DENY_ALL };
  if (tier.isPlatform) return { where: {} };

  const or: Prisma.AiApprovalWhereInput[] = [{ requestedByUserId: userId }];
  if (tier.canReadWide && tier.resolvedClinicId) or.push({ clinicId: tier.resolvedClinicId });
  if (tier.canReadWide && tier.organizationId) or.push({ organizationId: tier.organizationId });

  return { where: { OR: or } };
}

/** Nulls the payload/result of PHI-sensitivity rows for a caller who cannot read PHI. Visibility (which rows) is separate from this (what those rows reveal). */
export function redactPhiRows<T extends { sensitivity: string; argsRedacted: unknown; resultSummary: string | null }>(
  rows: T[],
  canReadPhi: boolean,
): T[] {
  if (canReadPhi) return rows;
  return rows.map((row) =>
    row.sensitivity === 'phi' ? { ...row, argsRedacted: null, resultSummary: null } : row,
  );
}
