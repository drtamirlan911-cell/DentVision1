import type { RoleScope } from './roleAccessRegistry.js';

export interface BranchAuthorizationContext {
  organizationId: string;
  roleScope: RoleScope;
  branchIds?: readonly string[];
  assignedBranchId?: string | null;
  userId?: string;
}

export interface BranchResourceContext {
  organizationId: string;
  branchId?: string | null;
  ownerUserId?: string | null;
}

export type BranchAuthorizationReason =
  | 'ORGANIZATION_MATCH'
  | 'BRANCH_MATCH'
  | 'ASSIGNED_BRANCH_MATCH'
  | 'OWNER_MATCH'
  | 'ORGANIZATION_MISMATCH'
  | 'BRANCH_REQUIRED'
  | 'BRANCH_NOT_ASSIGNED'
  | 'OWNER_REQUIRED';

export interface BranchAuthorizationResult {
  allowed: boolean;
  reason: BranchAuthorizationReason;
}

/**
 * Pure branch/organization scope gate. It deliberately knows nothing about
 * HTTP, Prisma, or UserRole so route handlers can use the same rules without
 * creating a second permission system.
 */
export function authorizeBranchScope(
  actor: BranchAuthorizationContext,
  resource: BranchResourceContext,
): BranchAuthorizationResult {
  if (actor.organizationId !== resource.organizationId) {
    return { allowed: false, reason: 'ORGANIZATION_MISMATCH' };
  }

  switch (actor.roleScope) {
    case 'ORGANIZATION':
      return { allowed: true, reason: 'ORGANIZATION_MATCH' };

    case 'BRANCH': {
      if (!resource.branchId) {
        return { allowed: false, reason: 'BRANCH_REQUIRED' };
      }
      if (!actor.branchIds?.includes(resource.branchId)) {
        return { allowed: false, reason: 'BRANCH_NOT_ASSIGNED' };
      }
      return { allowed: true, reason: 'BRANCH_MATCH' };
    }

    case 'ASSIGNED': {
      if (!resource.branchId) {
        return { allowed: false, reason: 'BRANCH_REQUIRED' };
      }
      if (actor.assignedBranchId !== resource.branchId) {
        return { allowed: false, reason: 'BRANCH_NOT_ASSIGNED' };
      }
      return { allowed: true, reason: 'ASSIGNED_BRANCH_MATCH' };
    }

    case 'OWN':
      if (!actor.userId || !resource.ownerUserId) {
        return { allowed: false, reason: 'OWNER_REQUIRED' };
      }
      return actor.userId === resource.ownerUserId
        ? { allowed: true, reason: 'OWNER_MATCH' }
        : { allowed: false, reason: 'OWNER_REQUIRED' };

    default:
      return { allowed: false, reason: 'BRANCH_REQUIRED' };
  }
}

export function canAccessBranch(
  actor: BranchAuthorizationContext,
  resource: BranchResourceContext,
): boolean {
  return authorizeBranchScope(actor, resource).allowed;
}

export function assertBranchAccess(
  actor: BranchAuthorizationContext,
  resource: BranchResourceContext,
): void {
  const result = authorizeBranchScope(actor, resource);
  if (!result.allowed) {
    const error = new Error(`Branch access denied: ${result.reason}`);
    error.name = 'BranchAuthorizationError';
    throw error;
  }
}
