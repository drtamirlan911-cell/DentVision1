/**
 * Clinic cash payments must be visible only in the branch boundary that was
 * verified by authentication or re-read from their canonical invoice/visit.
 * Client-supplied metadata is never sufficient without an active allow-list.
 */
export function canAccessClinicPaymentBranch(input: {
  role: string | null | undefined;
  activeBranchIds: readonly string[] | null | undefined;
  referenceBranchId?: string | null;
  persistedBranchId?: string | null;
}): boolean {
  if (String(input.role || '').toUpperCase() === 'SUPERADMIN') return true;
  const allowed = new Set((input.activeBranchIds ?? []).filter((id) => typeof id === 'string' && id.length > 0));
  if (allowed.size === 0) return false;
  const branchId = input.referenceBranchId || input.persistedBranchId;
  return Boolean(branchId && allowed.has(branchId));
}
