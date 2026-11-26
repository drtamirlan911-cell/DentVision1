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
import { syncPersonFromSupplierMember, syncPersonFromLecturer } from '../../lib/syncMembership.js';
import { getOrCreateWallet } from '../finance/finance.service.js';

/** Organization types this module can actually grant membership in. */
const DIAGNOSTIC_ORG_TYPES: Record<string, 'DiagnosticCenter' | 'Laboratory'> = {
  DIAGNOSTIC_CENTER: 'DiagnosticCenter',
  LABORATORY: 'Laboratory',
};

/** Roles a diagnostics invite may carry, in that module's own vocabulary. */
export const DIAGNOSTIC_INVITE_ROLES = ['admin', 'manager', 'radiologist', 'operator', 'diagnostic_reception', 'radiology_technician', 'diagnostic_finance', 'diagnostic_quality'] as const;

export const MEDICAL_LAB_INVITE_ROLES = [
  'medical_lab_admin', 'medical_lab_manager', 'medical_lab_reception',
  'medical_lab_technician', 'medical_lab_validator', 'medical_lab_doctor',
  'medical_lab_finance', 'medical_lab_quality',
] as const;

export const DENTAL_LAB_INVITE_ROLES = [
  'dental_lab_admin', 'dental_lab_manager', 'lab_coordinator',
  'dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician',
  'qc_specialist', 'lab_finance',
] as const;

/** Employer invitations grant scoped hiring access, never ownership or platform roles. */
export const EMPLOYER_INVITE_ROLES = ['employer_recruiter', 'employer_viewer'] as const;

/** Supplier company employees receive the existing manager capability; ownership is never inviteable. */
export const SUPPLIER_INVITE_ROLES = ['manager'] as const;

/** Academy owners may invite professional lecturers; ownership and platform roles are not inviteable. */
export const ACADEMY_INVITE_ROLES = ['lecturer'] as const;

/** Roles that may invite others into the organization. */
const MEMBER_MANAGER_ROLES = ['owner', 'admin'];

export interface InvitationLike {
  email: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  revokedAt?: Date | null;
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
  if (invitation.revokedAt) return { status: 410, error: 'Приглашение отозвано' };

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

export function laboratoryTypeFromSettings(settings: unknown): 'DENTAL_LAB' | 'MEDICAL_LAB' {
  const value = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? String((settings as Record<string, unknown>).laboratoryType || '').trim().toUpperCase()
    : '';
  return value === 'DENTAL_LAB' ? 'DENTAL_LAB' : 'MEDICAL_LAB';
}

/** Lab invitations use the vertical pinned in Organization.settings, never a caller-supplied type. */
export function normalizeLaboratoryInviteRole(role?: string, laboratoryType?: string): string {
  const dental = String(laboratoryType || '').trim().toUpperCase() === 'DENTAL_LAB';
  const allowed = dental ? DENTAL_LAB_INVITE_ROLES : MEDICAL_LAB_INVITE_ROLES;
  const wanted = String(role || '').trim().toLowerCase();
  return (allowed as readonly string[]).includes(wanted)
    ? wanted
    : dental ? 'dental_technician' : 'medical_lab_technician';
}

export function normalizeEmployerInviteRole(role?: string): string {
  const wanted = String(role || '').toLowerCase();
  return (EMPLOYER_INVITE_ROLES as readonly string[]).includes(wanted) ? wanted : 'employer_viewer';
}

/** Suppliers currently have one non-owner team permission set: manager. */
export function normalizeSupplierInviteRole(role?: string): string {
  const wanted = String(role || '').trim().toLowerCase();
  return (SUPPLIER_INVITE_ROLES as readonly string[]).includes(wanted) ? wanted : 'manager';
}

/** Strict role validation for owner-managed member changes. Owner/platform roles are never assignable. */
export function isOrganizationMemberRoleAllowed(
  organization: { type: string; settings?: unknown },
  role: string,
): boolean {
  const wanted = String(role || '').trim().toLowerCase();
  if (organization.type === 'DIAGNOSTIC_CENTER') {
    return (DIAGNOSTIC_INVITE_ROLES as readonly string[]).includes(wanted);
  }
  if (organization.type === 'LABORATORY') {
    const allowed = laboratoryTypeFromSettings(organization.settings) === 'DENTAL_LAB'
      ? DENTAL_LAB_INVITE_ROLES
      : MEDICAL_LAB_INVITE_ROLES;
    return (allowed as readonly string[]).includes(wanted);
  }
  return false;
}

/** Eight hex characters, the same shape clinic invitations already use. */
export function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * May this user hand out invitations for this organization?
 *
 * Read from the legacy member row rather than the unified graph on purpose:
 * this table is the canonical membership/manager boundary for diagnostics
 * invites. Scoped PersonRole rows provide capabilities for each specialist,
 * but must not allow a clinical operator or radiologist to invite colleagues.
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

  if (org.type === 'ACADEMY') {
    return !!(await prisma.academy.findFirst({
      where: { id: entityId, ownerId: userId },
      select: { id: true },
    }));
  }

  if (org.type === 'SUPPLIER_COMPANY') {
    const member = await prisma.supplierMember.findFirst({
      where: { supplierId: entityId, userId },
      select: { role: true },
    });
    return !!member && MEMBER_MANAGER_ROLES.includes(String(member.role).toLowerCase());
  }

  if (org.type === 'EMPLOYER') {
    const owner = await prisma.personRole.findFirst({
      where: {
        scopeType: 'organization',
        scopeId: org.id,
        person: { userId },
        role: { key: 'employer_owner' },
      },
      select: { id: true },
    });
    return !!owner;
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
  if (org.type === 'ACADEMY') {
    return !!(await prisma.lecturer.findFirst({
      where: { academyId: entityId, userId },
      select: { id: true },
    }));
  }
  if (org.type === 'SUPPLIER_COMPANY') {
    return !!(await prisma.supplierMember.findFirst({
      where: { supplierId: entityId, userId },
      select: { id: true },
    }));
  }
  if (org.type === 'EMPLOYER') {
    return !!(await prisma.personRole.findFirst({
      where: { scopeType: 'organization', scopeId: org.id, person: { userId } },
      select: { id: true },
    }));
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
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, type: true, archivedAt: true, settings: true },
  });
  if (!organization || organization.archivedAt) {
    throw Object.assign(new Error('Организация не найдена'), { status: 404 });
  }
  let role: string;
  if (organization.type === 'EMPLOYER') role = normalizeEmployerInviteRole(input.role);
  else if (organization.type === 'ACADEMY') role = 'lecturer';
  else if (organization.type === 'SUPPLIER_COMPANY') role = normalizeSupplierInviteRole(input.role);
  else if (organization.type === 'LABORATORY') role = normalizeLaboratoryInviteRole(input.role, laboratoryTypeFromSettings(organization.settings));
  else if (organization.type === 'DIAGNOSTIC_CENTER') role = normalizeDiagnosticInviteRole(input.role);
  else throw Object.assign(new Error('Этот тип организации пока не поддерживает приглашения'), { status: 400 });
  const days = Number(input.expiresInDays) > 0 ? Number(input.expiresInDays) : 7;

  return prisma.organizationInvitation.create({
    data: {
      id: uid(),
      organizationId: input.organizationId,
      email: input.email?.trim() || null,
      role,
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
    include: { organization: { select: { id: true, name: true, type: true, originalId: true, archivedAt: true, settings: true } } },
  });

  const rejection = rejectInvitation(invitation, { userEmail: user.email });
  if (rejection) throw Object.assign(new Error(rejection.error), { status: rejection.status });

  const org = invitation!.organization;
  if (org.archivedAt) throw Object.assign(new Error('Организация архивирована'), { status: 404 });
  const entityType = DIAGNOSTIC_ORG_TYPES[org.type];
  const entityId = org.originalId || org.id;

  if (await isAlreadyMember(user.id, org)) {
    throw Object.assign(new Error('Вы уже состоите в этой организации'), { status: 409 });
  }

  if (org.type === 'LABORATORY') {
    const laboratoryType = laboratoryTypeFromSettings(org.settings);
    const expectedRole = normalizeLaboratoryInviteRole(invitation!.role, laboratoryType);
    if (expectedRole !== String(invitation!.role || '').trim().toLowerCase()) {
      throw Object.assign(new Error('Роль приглашения не соответствует типу лаборатории'), { status: 400 });
    }

    const granted = await grantDiagnosticsAccess('Laboratory', entityId, user.id, expectedRole);
    if (!granted) {
      throw Object.assign(new Error('Не удалось выдать доступ к лаборатории'), { status: 500 });
    }

    const claimed = await prisma.organizationInvitation.updateMany({
      where: { code, usedAt: null, revokedAt: null },
      data: { usedAt: new Date(), usedBy: user.id },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error('Приглашение уже использовано'), { status: 409 });
    }

    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationType: org.type,
      entityId,
      role: expectedRole,
    };
  }

  if (org.type === 'ACADEMY') {
    if (!(ACADEMY_INVITE_ROLES as readonly string[]).includes(invitation!.role)) {
      throw Object.assign(new Error('Недопустимая роль приглашения академии'), { status: 400 });
    }

    const academy = await prisma.academy.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!academy) throw Object.assign(new Error('Академия не найдена'), { status: 404 });

    let lecturerId = '';
    try {
      await prisma.$transaction(async (tx) => {
        const account = await tx.user.findUnique({
          where: { id: user.id },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
        if (!account) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });

        const existing = await tx.lecturer.findUnique({
          where: { userId: user.id },
          select: { id: true, academyId: true },
        });
        if (existing?.academyId && existing.academyId !== entityId) {
          throw Object.assign(new Error('Профиль лектора уже привязан к другой академии'), { status: 409 });
        }

        const lecturer = existing
          ? await tx.lecturer.update({
              where: { id: existing.id },
              data: { academyId: entityId },
            })
          : await tx.lecturer.create({
              data: {
                id: uid(),
                userId: account.id,
                academyId: entityId,
                level: 'new',
              },
            });
        lecturerId = lecturer.id;

        await syncPersonFromLecturer(lecturer.id, account.id, entityId, tx);

        const claimed = await tx.organizationInvitation.updateMany({
          where: { code, usedAt: null, revokedAt: null },
          data: { usedAt: new Date(), usedBy: user.id },
        });
        if (claimed.count !== 1) {
          throw Object.assign(new Error('Приглашение уже использовано'), { status: 409 });
        }
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw Object.assign(new Error('Профиль лектора уже существует или приглашение было использовано'), { status: 409 });
      }
      throw error;
    }

    // Wallet creation mirrors self-registration. It is a non-blocking derived
    // account and does not affect the atomic Academy membership grant.
    await getOrCreateWallet('LECTURER', lecturerId).catch(() => null);

    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationType: org.type,
      entityId: lecturerId,
      role: 'lecturer',
    };
  }

  if (org.type === 'SUPPLIER_COMPANY') {
    if (!(SUPPLIER_INVITE_ROLES as readonly string[]).includes(invitation!.role)) {
      throw Object.assign(new Error('Недопустимая роль приглашения поставщика'), { status: 400 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const member = await tx.supplierMember.create({
          data: { id: uid(), supplierId: entityId, userId: user.id, role: invitation!.role },
        });
        // The supplier workspace reads SupplierMember; the canonical Person graph
        // powers organization context, branch scope and audit-aware identity.
        await syncPersonFromSupplierMember(member.id, entityId, user.id, tx);
        const claimed = await tx.organizationInvitation.updateMany({
          where: { code, usedAt: null, revokedAt: null },
          data: { usedAt: new Date(), usedBy: user.id },
        });
        if (claimed.count !== 1) {
          throw Object.assign(new Error('Приглашение уже использовано'), { status: 409 });
        }
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw Object.assign(new Error('Вы уже состоите в этой организации'), { status: 409 });
      }
      throw error;
    }

    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationType: org.type,
      entityId,
      role: invitation!.role,
    };
  }

  if (org.type === 'EMPLOYER') {
    if (!(EMPLOYER_INVITE_ROLES as readonly string[]).includes(invitation!.role)) {
      throw Object.assign(new Error('Недопустимая роль приглашения работодателя'), { status: 400 });
    }
    const granted = await prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!account) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
      const existingPerson = await tx.person.findFirst({
        where: { userId: user.id, organizationId: org.id },
        select: { id: true },
      });
      const personId = existingPerson?.id || uid();
      if (!existingPerson) {
        await tx.person.create({
          data: {
            id: personId,
            fullName: [account.firstName, account.lastName].filter(Boolean).join(' ') || account.email || 'Сотрудник',
            personType: 'STAFF',
            organizationId: org.id,
            userId: account.id,
            email: account.email,
            originalType: 'OrganizationInvite',
            originalId: `${org.id}:${user.id}`,
          },
        });
      }
      const role = await tx.role.findUnique({ where: { key: invitation!.role } });
      if (!role) throw Object.assign(new Error('Роль приглашения не найдена'), { status: 500 });
      const scopeKey = `organization:${org.id}`;
      await tx.personRole.upsert({
        where: { personId_roleId_scopeKey: { personId, roleId: role.id, scopeKey } },
        update: { scopeType: 'organization', scopeId: org.id },
        create: { id: uid(), personId, roleId: role.id, scopeType: 'organization', scopeId: org.id, scopeKey },
      });
      const branch = await tx.branch.findFirst({
        where: { organizationId: org.id, active: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (branch) {
        await tx.branchMember.upsert({
          where: { personId_branchId: { personId, branchId: branch.id } },
          update: {},
          create: { id: uid(), personId, branchId: branch.id },
        });
      }
      const claimed = await tx.organizationInvitation.updateMany({
        where: { code, usedAt: null, revokedAt: null },
        data: { usedAt: new Date(), usedBy: user.id },
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error('Приглашение уже использовано'), { status: 409 });
      }
      return true;
    });
    if (!granted) throw Object.assign(new Error('Не удалось выдать доступ к организации'), { status: 500 });
    return { organizationId: org.id, organizationName: org.name, organizationType: org.type, entityId: org.id, role: invitation!.role };
  }

  if (!entityType) {
    // Refuse rather than half-join: there is no membership table to write for
    // unsupported organization types, and marking the code used would burn it.
    throw Object.assign(new Error('Этот тип организации пока не поддерживает приглашения'), { status: 400 });
  }

  const granted = await grantDiagnosticsAccess(entityType, entityId, user.id, invitation!.role);
  if (!granted) {
    throw Object.assign(new Error('Не удалось выдать доступ к организации'), { status: 500 });
  }

  // Only after the grant succeeded. Marking it first would burn the code on a
  // failure and leave the invitee with no way back in.
  const claimed = await prisma.organizationInvitation.updateMany({
    where: { code, usedAt: null, revokedAt: null },
    data: { usedAt: new Date(), usedBy: user.id },
  });
  if (claimed.count !== 1) {
    throw Object.assign(new Error('Приглашение уже использовано'), { status: 409 });
  }

  return {
    organizationId: org.id,
    organizationName: org.name,
    organizationType: org.type,
    entityId,
    role: invitation!.role,
  };
}
