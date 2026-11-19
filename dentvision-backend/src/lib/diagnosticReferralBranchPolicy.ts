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

  // The auth middleware has already resolved PersonRole and active
  // BranchMember assignments from the selected organization. ClinicMember is
  // only merged into this positive allow-list for legacy, non-canonical data.
  // Requiring a legacy row here would deny valid canonical-only clinic users.
  if (!resource.branchId) return false;

  const allowedBranchIds = new Set(
    [user.assignedBranchId, ...(user.branchIds ?? [])]
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
      )
    LIMIT 1
  `;
  return rows.length === 1;
}

export function assertReferralBranchAccess(allowed: boolean): void {
  if (!allowed) throw new Error('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
}
