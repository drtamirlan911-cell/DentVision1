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

/** Matches nothing — for a caller we cannot identify at all. */
const DENY_ALL: Prisma.AgentActivityWhereInput = { id: { equals: '__no_such_activity__' } };

export async function buildActivityFilter(userId: string, clinicId: string | null): Promise<ActivityVisibility> {
  if (!userId) return { where: DENY_ALL, canReadPhi: false };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { where: DENY_ALL, canReadPhi: false };

  if (user.role === 'SUPERADMIN') {
    // Platform tier: unrestricted, including PHI.
    return { where: {}, canReadPhi: true };
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
  const canReadWide = permissionsSatisfy(permissions, 'bi.read');

  const or: Prisma.AgentActivityWhereInput[] = [{ actorUserId: userId }];
  if (canReadWide && resolvedClinicId) or.push({ clinicId: resolvedClinicId });
  if (canReadWide && organizationId) or.push({ organizationId });

  return {
    where: { OR: or },
    canReadPhi: permissionsSatisfy(permissions, 'medical.read'),
  };
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
