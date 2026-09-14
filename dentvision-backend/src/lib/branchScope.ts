export type BranchScopeRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'DOCTOR'
  | 'ASSISTANT'
  | 'RECEPTIONIST'
  | 'CASHIER'
  | 'ACCOUNTANT';

export type BranchScope = {
  organizationId: string;
  branchId?: string | null;
  assignedBranchIds?: readonly string[];
};

export type BranchVisibility =
  | { mode: 'ORGANIZATION'; organizationId: string }
  | { mode: 'ASSIGNED'; organizationId: string; branchIds: readonly string[] };

/**
 * Returns whether a role may access a branch inside an organization.
 * Missing organization or branch context fails closed.
 */
export function canAccessBranch(
  role: BranchScopeRole,
  context: BranchScope,
  target: { organizationId?: string | null; branchId?: string | null },
): boolean {
  if (!context.organizationId || !target.organizationId || context.organizationId !== target.organizationId) {
    return false;
  }

  if (!target.branchId) return false;

  switch (role) {
    case 'OWNER':
    case 'ADMIN':
    case 'ACCOUNTANT':
      return true;
    case 'MANAGER':
    case 'RECEPTIONIST':
    case 'CASHIER':
    case 'DOCTOR':
    case 'ASSISTANT':
      return context.assignedBranchIds?.includes(target.branchId) ?? false;
    default:
      return false;
  }
}

/**
 * Produces a query-safe visibility contract. Organization-wide roles are
 * represented structurally; there is no wildcard that could accidentally
 * become an unrestricted SQL/API predicate.
 */
export function visibleBranches(
  role: BranchScopeRole,
  context: BranchScope,
): BranchVisibility | null {
  if (!context.organizationId) return null;

  if (role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT') {
    return { mode: 'ORGANIZATION', organizationId: context.organizationId };
  }

  return {
    mode: 'ASSIGNED',
    organizationId: context.organizationId,
    branchIds: context.assignedBranchIds ?? [],
  };
}
