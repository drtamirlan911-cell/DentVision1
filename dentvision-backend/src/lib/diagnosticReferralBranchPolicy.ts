import type { AuthUser } from '../types/index.js';
import { resolveClinicBranchAccess } from './clinicBranchAccess.js';

export type ReferralBranchResource = {
  clinicId: string;
  branchId: string | null;
};

/**
 * Runtime policy for clinic-originated diagnostic referrals.
 * Partner-center/laboratory access remains governed by the partner membership layer.
 *
 * Clinic access is always re-resolved from active IAM membership. JWT branchIds
 * and assignedBranchId are not authorization sources; branchId is only a
 * selector that resolveClinicBranchAccess verifies against current membership.
 */
export async function canAccessReferralBranch(
  user: Pick<AuthUser, 'id' | 'role' | 'organizationId' | 'branchId' | 'clinicId'>,
  resource: ReferralBranchResource,
): Promise<boolean> {
  if (!resource.clinicId || !resource.branchId) return false;
  if (user.role === 'SUPERADMIN') return true;

  const access = await resolveClinicBranchAccess({
    userId: user.id,
    clinicId: resource.clinicId,
    organizationId: user.organizationId,
    role: String(user.role || ''),
    requestedBranchId: user.branchId,
  });
  if (!access || !access.allowedBranchIds.includes(resource.branchId)) return false;

  // A branch selected by an organization-wide role narrows this request even
  // though that role may select any other active branch in another context.
  return access.branchId === null || access.branchId === resource.branchId;
}

export function assertReferralBranchAccess(allowed: boolean): void {
  if (!allowed) throw new Error('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
}
