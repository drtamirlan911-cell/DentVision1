/**
 * Invite codes for organizations that are not clinics.
 *
 * Clinics have had `ClinicInvitation` and `POST /auth/join-clinic` since the
 * beginning. Diagnostic centres and laboratories had nothing: their member rows
 * were only ever written by `grantDiagnosticsAccess` when a superadmin approved
 * the founding registration request, so a centre could never gain a second
 * employee. The workspace even shipped a "join by invite code" button, but it
 * called an endpoint that did not exist.
 *
 * The validation rules and their status codes deliberately mirror
 * `/auth/join-clinic`, so the two invite flows behave the same way from the
 * outside.
 */

import crypto from 'crypto';

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { grantDiagnosticsAccess } from '../diagnostics/diagnostics.service.js';

/** Organization types this module can actually grant membership in. */
const DIAGNOSTIC_ORG_TYPES: Record<string, 'DiagnosticCenter' | 'Laboratory'> = {
  DIAGNOSTIC_CENTER: 'DiagnosticCenter',
  LABORATORY: 'Laboratory',
};

/** Roles a diagnostics invite may carry, in that module's own vocabulary. */
export const DIAGNOSTIC_INVITE_ROLES = ['admin', 'manager', 'radiologist', 'operator'] as const;

/** Roles that may invite others into the organization. */
const MEMBER_MANAGER_ROLES = ['owner', 'admin'];

export interface InvitationLike {
  email: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
}

export interface InvitationRejection {
  status: number;
  error: string;
}

/**
 * Why this invite cannot be used, or null when it can.
 *
 * Split out from the route so the rules are testable without a database — the
 * ordering matters (an expired *and* used code should read as used, which is
 * the more informative answer).
 */
export function rejectInvitation(
  invitation: InvitationLike | null,
  ctx: { now?: Date; userEmail?: string | null },
): InvitationRejection | null {
  if (!invitation) return { status: 404, error: 'Приглашение не найдено' };
  if (invitation.usedAt) return { status: 409, error: 'Приглашение уже использовано' };

  const now = ctx.now ?? new Date();
  if (invitation.expiresAt && new Date(invitation.expiresAt) < now) {
    return { status: 410, error: 'Приглашение истекло' };
  }

  // A targeted invite is a second factor, not a hint: without this check the
  // code alone would admit anyone who saw it.
  if (invitation.email && invitation.email.toLowerCase() !== (ctx.userEmail || '').toLowerCase()) {
    return { status: 403, error: 'Приглашение предназначено для другого адреса' };
  }

  return null;
}

/** Normalise a requested invite role, falling back to the narrowest one. */
export function normalizeDiagnosticInviteRole(role?: string): string {
  const wanted = String(role || '').toLowerCase();
  return (DIAGNOSTIC_INVITE_ROLES as readonly string[]).includes(wanted) ? wanted : 'operator';
}

/** Eight hex characters, the same shape clinic invitations already use. */
export function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * May this user hand out invitations for this organization?
 *
 * Read from the legacy member row rather than the unified graph on purpose:
 * `grantDiagnosticsAccess` deliberately leaves radiologists and operators
 * without a `PersonRole`, so a unified-only check would see no role at all and
 * could not tell an operator from an owner.
 */
export async function canManageMembers(
  userId: string,
  org: { id: string; type: string; originalId: string | null },
  isSuperadmin = false,
): Promise<boolean> {
  if (isSuperadmin) return true;
  const entityId = org.originalId || org.id;

  if (org.type === 'DIAGNOSTIC_CENTER') {
    const member = await prisma.diagnosticCenterMember.findFirst({
      where: { centerId: entityId, userId },
      select: { role: true },
    });
    return !!member && MEMBER_MANAGER_ROLES.includes(String(member.role).toLowerCase());
  }

  if (org.type === 'LABORATORY') {
    const member = await prisma.laboratoryMember.findFirst({
      where: { labId: entityId, userId },
      select: { role: true },
    });
    return !!member && MEMBER_MANAGER_ROLES.includes(String(member.role).toLowerCase());
  }

  return false;
}

/** Is this user already a member of the organization behind the invite? */
export async function isAlreadyMember(
  userId: string,
  org: { id: string; type: string; originalId: string | null },
): Promise<boolean> {
  const entityId = org.originalId || org.id;

  if (org.type === 'DIAGNOSTIC_CENTER') {
    return !!(await prisma.diagnosticCenterMember.findFirst({ where: { centerId: entityId, userId } }));
  }
  if (org.type === 'LABORATORY') {
    return !!(await prisma.laboratoryMember.findFirst({ where: { labId: entityId, userId } }));
  }
  return false;
}

export async function createInvitation(input: {
  organizationId: string;
  role?: string;
  email?: string;
  expiresInDays?: number;
  createdBy: string;
}) {
  const days = Number(input.expiresInDays) > 0 ? Number(input.expiresInDays) : 7;

  return prisma.organizationInvitation.create({
    data: {
      id: uid(),
      organizationId: input.organizationId,
      email: input.email?.trim() || null,
      role: normalizeDiagnosticInviteRole(input.role),
      code: generateInviteCode(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      createdBy: input.createdBy,
    },
  });
}

export interface AcceptResult {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  /** The mirrored entity's own id — what every scoped query needs. */
  entityId: string;
  role: string;
}

/**
 * Consume an invite code and grant membership.
 *
 * Throws `{ status, message }`-shaped errors so the route can answer with the
 * same codes `/auth/join-clinic` uses.
 */
export async function acceptInvitation(
  code: string,
  user: { id: string; email?: string },
): Promise<AcceptResult> {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { code },
    include: { organization: { select: { id: true, name: true, type: true, originalId: true } } },
  });

  const rejection = rejectInvitation(invitation, { userEmail: user.email });
  if (rejection) throw Object.assign(new Error(rejection.error), { status: rejection.status });

  const org = invitation!.organization;
  const entityType = DIAGNOSTIC_ORG_TYPES[org.type];
  if (!entityType) {
    // Refuse rather than half-join: there is no membership table to write for
    // the other organization types yet, and marking the code used would burn it
    // without granting anything.
    throw Object.assign(new Error('Этот тип организации пока не поддерживает приглашения'), { status: 400 });
  }

  const entityId = org.originalId || org.id;

  if (await isAlreadyMember(user.id, org)) {
    throw Object.assign(new Error('Вы уже состоите в этой организации'), { status: 409 });
  }

  const granted = await grantDiagnosticsAccess(entityType, entityId, user.id, invitation!.role);
  if (!granted) {
    throw Object.assign(new Error('Не удалось выдать доступ к организации'), { status: 500 });
  }

  // Only after the grant succeeded. Marking it first would burn the code on a
  // failure and leave the invitee with no way back in.
  await prisma.organizationInvitation.update({
    where: { code },
    data: { usedAt: new Date(), usedBy: user.id },
  });

  return {
    organizationId: org.id,
    organizationName: org.name,
    organizationType: org.type,
    entityId,
    role: invitation!.role,
  };
}
