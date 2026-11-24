import prisma from './prisma.js';
import type { AuthUser } from '../types/index.js';

export type ReferralBranchResource = {
  clinicId: string;
  branchId: string | null;
};

/**
 * Resolve a referral's clinic branch from the canonical patient record.
 * A client branch selector may confirm the patient's branch, never replace it.
 * Unlinked referrals still require an explicitly selected branch which is
 * subsequently checked by canAccessReferralBranch.
 */
export function resolveReferralBranchId(input: {
  patientId?: string | null;
  patientBranchId?: string | null;
  requestedBranchId?: string | null;
}): string | null {
  if (input.patientId) {
    if (!input.patientBranchId) return null;
    if (input.requestedBranchId && input.requestedBranchId !== input.patientBranchId) return null;
    return input.patientBranchId;
  }
  return input.requestedBranchId || null;
}

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

  if (!resource.branchId) return false;

  // Canonical active BranchMember assignments are supplied by authenticate.
  // Also recheck an exact ClinicMember mapping for compatibility with existing
  // clinic sessions; the joined branch must still be active.
  const legacyMembership = await prisma.$queryRaw<Array<{
    branch_id: string | null;
    branch_active: boolean;
  }>>`
    SELECT cm."branch_id",
      CASE WHEN cm."branch_id" IS NULL THEN false ELSE COALESCE(b."active", false) END AS branch_active
    FROM "clinic_members" cm
    LEFT JOIN "branches" b ON b."id" = cm."branch_id"
    WHERE cm."userId" = ${user.id} AND cm."clinicId" = ${resource.clinicId}
    LIMIT 1
  `;
  const legacyBranchId = legacyMembership[0]?.branch_active ? legacyMembership[0].branch_id : null;
  const allowedBranchIds = new Set(
    [user.assignedBranchId, ...(user.branchIds ?? []), legacyBranchId]
      .filter((id): id is string => Boolean(id)),
  );
  if (!allowedBranchIds.has(resource.branchId)) return false;

  return branchBelongsToClinic(resource.branchId, resource.clinicId, user.organizationId);
}

export async function branchBelongsToClinic(
  branchId: string | null | undefined,
  clinicId: string,
  organizationId?: string,
): Promise<boolean> {
  if (!branchId || !clinicId || !organizationId) return false;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM branches
    WHERE id = ${branchId}
      AND active = true
      AND (
        organization_id = ${organizationId}
        OR (organization_id IS NULL AND clinic_id = ${clinicId})
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM "organizations" o
            WHERE o."id" = branches."organization_id"
              AND o."type" = 'CLINIC'
              AND o."originalId" = ${clinicId}
              AND o."archivedAt" IS NULL
          )
        )
      )
    LIMIT 1
  `;
  return rows.length === 1;
}

export function assertReferralBranchAccess(allowed: boolean): void {
  if (!allowed) throw new Error('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
}
