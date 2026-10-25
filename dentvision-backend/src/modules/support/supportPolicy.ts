export type SupportActorIdentity = { id?: string | null; role?: unknown } | null | undefined;

export function isSupportStaffRole(role: unknown): boolean {
  return role === 'SUPPORT' || role === 'SUPERADMIN';
}

/**
 * Ticket visibility policy. Staff access is granted by the server-authenticated
 * platform role; requesters may only see tickets linked to their own user ID.
 * A ticket ID, organization ID, or client-supplied role is not authorization.
 */
export function canReadSupportTicket(actor: SupportActorIdentity, requesterUserId: string | null): boolean {
  if (isSupportStaffRole(actor?.role)) return true;
  return typeof actor?.id === 'string' && actor.id.length > 0 && requesterUserId === actor.id;
}
