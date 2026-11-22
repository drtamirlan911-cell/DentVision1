export type SettlementOwnerType = 'CENTER' | 'LAB';

export interface ActivePartnerSettlementScope {
  ownerType: SettlementOwnerType;
  ownerId: string;
}

export interface ActivePartnerSettlementUser {
  organizationType?: string | null;
  organizationId?: string | null;
  organizationOriginalId?: string | null;
}

/**
 * Resolve settlement ownership only from the authenticated active IAM context.
 * Do not accept ownerType/ownerId from a partner request body or query string.
 */
export function resolveActivePartnerSettlementScope(
  user: ActivePartnerSettlementUser | null | undefined,
): ActivePartnerSettlementScope | null {
  if (!user) return null;

  const organizationType = String(user.organizationType || '').trim().toUpperCase();
  const ownerId = String(user.organizationOriginalId || user.organizationId || '').trim();
  if (!ownerId) return null;

  if (organizationType === 'DIAGNOSTIC_CENTER') return { ownerType: 'CENTER', ownerId };
  if (organizationType === 'LABORATORY') return { ownerType: 'LAB', ownerId };
  return null;
}

export function settlementBelongsToActiveScope(
  scope: ActivePartnerSettlementScope | null | undefined,
  settlement: { ownerType: string; ownerId: string } | null | undefined,
): boolean {
  return Boolean(
    scope
    && settlement
    && settlement.ownerType === scope.ownerType
    && settlement.ownerId === scope.ownerId,
  );
}
