/**
 * Branch-scope policy used by the IAM layer.
 *
 * This is intentionally framework-agnostic: route handlers can use it without
 * coupling authorization rules to Express request objects or Prisma queries.
 * A policy decision is only valid after the caller's organization and branch
 * assignments have been resolved from trusted server-side context.
 */

export type BranchScope = 'ORGANIZATION' | 'BRANCH' | 'ASSIGNED';

export interface BranchAccessContext {
  organizationId: string;
  userOrganizationId: string | null;
  scope: BranchScope;
  assignedBranchIds: readonly string[];
  requestedBranchId: string | null;
}

export type BranchAccessDecision =
  | { allowed: true; reason: 'ORGANIZATION_SCOPE' | 'ASSIGNED_BRANCH' }
  | { allowed: false; reason: 'NO_ORGANIZATION' | 'ORGANIZATION_MISMATCH' | 'BRANCH_REQUIRED' | 'BRANCH_NOT_ASSIGNED' };

/**
 * Fail-closed branch authorization.
 *
 * ORGANIZATION scope does not mean cross-organization access: the caller must
 * still belong to the requested organization.
 */
export function canAccessBranch(context: BranchAccessContext): BranchAccessDecision {
  if (!context.userOrganizationId) {
    return { allowed: false, reason: 'NO_ORGANIZATION' };
  }

  if (context.userOrganizationId !== context.organizationId) {
    return { allowed: false, reason: 'ORGANIZATION_MISMATCH' };
  }

  if (context.scope === 'ORGANIZATION') {
    return { allowed: true, reason: 'ORGANIZATION_SCOPE' };
  }

  if (!context.requestedBranchId) {
    return { allowed: false, reason: 'BRANCH_REQUIRED' };
  }

  if (!context.assignedBranchIds.includes(context.requestedBranchId)) {
    return { allowed: false, reason: 'BRANCH_NOT_ASSIGNED' };
  }

  return { allowed: true, reason: 'ASSIGNED_BRANCH' };
}

export function assertBranchAccess(context: BranchAccessContext): void {
  const decision = canAccessBranch(context);
  if (!decision.allowed) {
    throw new Error(`BRANCH_ACCESS_DENIED:${decision.reason}`);
  }
}
