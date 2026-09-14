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

/**
 * Returns whether a role may access a branch inside an organization.
 *
 * This is deliberately a pure policy function. Route handlers should resolve
 * the authenticated user's organization and branch assignments first, then
 * pass those facts here. Missing organization or branch context fails closed.
 */
export function canAccessBranch(
  role: BranchScopeRole,
  context: BranchScope,
  target: { organizationId?: string | null; branchId?: string | null },
): boolean {
  if (!context.organizationId || !target.organizationId || context.organizationId !== target.organizationId) {
    return false;
  }

  if (!target.branchId) {
    return false;
  }

  switch (role) {
    case 'OWNER':
    case 'ADMIN':
    case 'ACCOUNTANT':
      return true;
    case 'MANAGER':
    case 'RECEPTIONIST':
    case 'CASHIER':
      return context.assignedBranchIds?.includes(target.branchId) ?? false;
    case 'DOCTOR':
    case 'ASSISTANT':
      return context.assignedBranchIds?.includes(target.branchId) ?? false;
    default:
      return false;
  }
}

/**
 * Branch IDs visible to the current role. Returning an empty list instead of
 * null makes it safe for callers to translate this directly into an IN
 * predicate. Organization-wide roles receive the explicit sentinel '*';
 * callers must translate it to an organization-scoped predicate, never to an
 * unrestricted query.
 */
export function visibleBranchIds(
  role: BranchScopeRole,
  context: BranchScope,
): readonly string[] | '*' {
  if (!context.organizationId) return [];

  if (role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT') {
    return '*';
  }

  return context.assignedBranchIds ?? [];
}
