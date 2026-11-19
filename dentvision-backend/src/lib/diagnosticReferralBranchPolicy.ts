import prisma from './prisma.js';
import type { AuthUser } from '../types/index.js';

export type ReferralBranchResource = {
  clinicId: string;
  branchId: string | null;
};

/**
 * Clinic data is available only while the caller is operating in that exact
 * clinic context. A retained ClinicMember row is not permission to cross from
 * a diagnostic/laboratory/other organization into an unrelated clinic.
 */
export function isActiveClinicContext(
  user: Pick<AuthUser, 'organizationId' | 'organizationOriginalId' | 'organizationType' | 'clinicId'> | null | undefined,
  clinicId: string,
): boolean {
  if (!user || !clinicId || user.organizationType?.toUpperCase() !== 'CLINIC' || user.clinicId !== clinicId || !user.organizationId) {
    return false;
  }

  // Canonical clinic contexts carry originalId; pre-canonical contexts use
  // the clinic ID as organizationId. Both must resolve to the same clinic.
  const activeClinicId = user.organizationOriginalId
    || (user.organizationId === clinicId ? user.organizationId : undefined);
  return activeClinicId === clinicId;
}

/**
 * Runtime policy for clinic-originated diagnostic referrals.
 * Partner-center/laboratory access is intentionally outside this policy: their
 * organization boundary is checked by the partner membership layer.
 */
export async function canAccessReferralBranch(
  user: Pick<AuthUser, 'id' | 'role' | 'organizationId' | 'organizationOriginalId' | 'organizationType' | 'assignedBranchId' | 'branchIds' | 'clinicId'>,
  resource: ReferralBranchResource,
): Promise<boolean> {
  if (!resource.clinicId) return false;
  if (user.role === 'SUPERADMIN') return true;
  if (!isActiveClinicContext(user, resource.clinicId)) return false;

  // Verify current membership as a second boundary after validating active
  // organization context; neither a role nor a retained membership is enough alone.
  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null; branch_active: boolean }>>`
    SELECT cm."branch_id",
      CASE WHEN cm."branch_id" IS NULL THEN true ELSE COALESCE(b."active", false) END AS branch_active
    FROM "clinic_members" cm
    LEFT JOIN "branches" b ON b."id" = cm."branch_id"
    WHERE cm."userId" = ${user.id} AND cm."clinicId" = ${resource.clinicId}
    LIMIT 1
  `;
  if (!membership[0]) return false;

  const activeMemberBranchId = membership[0].branch_active ? membership[0].branch_id : null;
  const assigned = new Set(
    [activeMemberBranchId, user.assignedBranchId, ...(user.branchIds ?? [])]
      .filter((id): id is string => Boolean(id)),
  );

  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return branchBelongsToClinic(resource.branchId, resource.clinicId);
  }

  if (!resource.branchId) return false;
  if (!(await branchBelongsToClinic(resource.branchId, resource.clinicId))) return false;
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
