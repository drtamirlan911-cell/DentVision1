export type ClinicStaffAuthorizationInput = {
  actorRole: string;
  currentMemberRole?: string | null;
  nextMemberRole?: string | null;
  ownerCount?: number;
  isSuperadmin?: boolean;
};

export type ClinicStaffAuthorizationDecision =
  | { ok: true }
  | { ok: false; status: 403 | 409; code: 'OWNER_REQUIRED' | 'LAST_OWNER' };

/**
 * Owner assignment, owner-profile mutation and owner transfer are governance
 * operations. Clinic ADMIN may manage ordinary staff but cannot grant, edit,
 * demote or remove the legal owner.
 */
export function authorizeClinicStaffMutation(
  input: ClinicStaffAuthorizationInput,
): ClinicStaffAuthorizationDecision {
  const actorRole = String(input.actorRole || '').toUpperCase();
  const currentRole = String(input.currentMemberRole || '').toUpperCase();
  const nextRole = String(input.nextMemberRole ?? input.currentMemberRole ?? '').toUpperCase();
  const isSuperadmin = input.isSuperadmin === true || actorRole === 'SUPERADMIN';
  const isOwner = actorRole === 'OWNER';

  if (isSuperadmin) return { ok: true };
  if (currentRole === 'OWNER' && !isOwner) {
    return { ok: false, status: 403, code: 'OWNER_REQUIRED' };
  }
  if (nextRole === 'OWNER' && !isOwner) {
    return { ok: false, status: 403, code: 'OWNER_REQUIRED' };
  }
  if (currentRole === 'OWNER' && nextRole !== 'OWNER') {
    if (!isOwner) return { ok: false, status: 403, code: 'OWNER_REQUIRED' };
    if (!Number.isInteger(input.ownerCount) || Number(input.ownerCount) <= 1) {
      return { ok: false, status: 409, code: 'LAST_OWNER' };
    }
  }

  return { ok: true };
}
