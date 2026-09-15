import prisma from './prisma.js';
import type { AuthUser } from '../types/index.js';

export type ReferralBranchResource = {
  clinicId: string;
  branchId: string | null;
};

/**
 * Runtime policy for clinic-originated diagnostic referrals.
 * Partner-center/laboratory access is intentionally outside this policy: their
 * organization boundary is checked by the partner membership layer.
 */
export async function canAccessReferralBranch(
  user: Pick<AuthUser, 'id' | 'role' | 'organizationId' | 'assignedBranchId' | 'branchIds' | 'clinicId'>,
  resource: ReferralBranchResource,
): Promise<boolean> {
  if (!resource.clinicId || !user.clinicId || user.clinicId !== resource.clinicId) return false;
  if (user.role === 'SUPERADMIN') return true;

  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null }>>`
    SELECT "branch_id"
    FROM "clinic_members"
    WHERE "userId" = ${user.id} AND "clinicId" = ${resource.clinicId}
    LIMIT 1
  `;
  if (!membership[0]) return false;

  const assigned = new Set(
    [membership[0].branch_id, user.assignedBranchId, ...(user.branchIds ?? [])]
      .filter((id): id is string => Boolean(id)),
  );

  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return resource.branchId !== null && assigned.has(resource.branchId)
      ? true
      : await branchBelongsToClinic(resource.branchId, resource.clinicId);
  }

  if (!resource.branchId) return false;
  return assigned.has(resource.branchId);
}

export async function branchBelongsToClinic(
  branchId: string | null | undefined,
  clinicId: string,
): Promise<boolean> {
  if (!branchId || !clinicId) return false;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM branches
    WHERE id = ${branchId} AND clinic_id = ${clinicId} AND active = true
    LIMIT 1
  `;
  return rows.length === 1;
}

export function assertReferralBranchAccess(allowed: boolean): void {
  if (!allowed) throw new Error('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
}
