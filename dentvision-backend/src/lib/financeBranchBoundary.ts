import type { AuthUser } from '../types/index.js';

export type FinanceScope = {
  organizationId: string;
  branchId?: string | null;
};

/**
 * Finance visibility policy shared by route/service layers.
 *
 * Organization finance roles may see all branches inside their organization.
 * Branch operators must have an explicit assigned branch and may only access
 * resources from that branch. Missing context fails closed.
 */
const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

export function canAccessFinanceScope(
  user: Pick<AuthUser, 'role' | 'organizationId' | 'assignedBranchId' | 'branchIds'>,
  resource: FinanceScope,
): boolean {
  if (!user.organizationId || !resource.organizationId) return false;
  if (user.organizationId !== resource.organizationId) return false;

  if (ORGANIZATION_ROLES.has(user.role)) return true;

  if (!resource.branchId) return false;
  const assigned = new Set(
    [user.assignedBranchId, ...(user.branchIds ?? [])].filter((id): id is string => Boolean(id)),
  );
  return assigned.has(resource.branchId);
}

export function assertFinanceScope(
  user: Pick<AuthUser, 'role' | 'organizationId' | 'assignedBranchId' | 'branchIds'>,
  resource: FinanceScope,
): void {
  if (!canAccessFinanceScope(user, resource)) {
    throw new Error('FINANCE_SCOPE_FORBIDDEN');
  }
}
