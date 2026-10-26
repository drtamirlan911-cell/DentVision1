export type ReferralListScope = {
  clinicId?: string;
  centerId?: string;
  labId?: string;
};

export type ReferralListPrincipal = {
  clinicId?: string | null;
  organizationType?: string | null;
  organizationOriginalId?: string | null;
};

/**
 * Resolve omitted list filters from the server-verified active context.
 *
 * Explicit query filters are preserved for backward compatibility, but the route
 * still authorizes them against req.user before executing the query. This helper
 * grants no access by itself; it only avoids asking a scoped workspace to repeat
 * its already-authenticated tenant identifier on every list request.
 */
export function resolveReferralListScope(
  principal: ReferralListPrincipal | null | undefined,
  requested: ReferralListScope = {},
): ReferralListScope {
  if (requested.clinicId || requested.centerId || requested.labId) return { ...requested };

  const organizationType = String(principal?.organizationType || '').trim().toUpperCase();
  const organizationOriginalId = String(principal?.organizationOriginalId || '').trim();

  if (organizationType === 'DIAGNOSTIC_CENTER' && organizationOriginalId) {
    return { centerId: organizationOriginalId };
  }
  if (organizationType === 'LABORATORY' && organizationOriginalId) {
    return { labId: organizationOriginalId };
  }
  if (principal?.clinicId) return { clinicId: principal.clinicId };

  // A platform-level principal without an active tenant stays unscoped; the
  // caller's existing authorization policy decides whether that is permitted.
  return {};
}
