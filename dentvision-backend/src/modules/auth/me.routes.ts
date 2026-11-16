import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { resolveUserPermissions } from '../../lib/resolvePermissions.js';
import { resolveOrganizationRoleKey } from '../../lib/authContext.js';
import { pagesForCaller, capabilitiesForPermissions } from '../../lib/permissions.js';
import { createClinicInvitation } from './clinicInvitations.service.js';
import { resolveClinicAccess as resolveClinicSubscriptionAccess } from '../billing/planEntitlements.js';

export const authMeRouter = Router();

/** Filter soft-archived clinic contexts from legacy auth discovery responses. */
async function excludeArchivedClinicMemberships<T extends { clinicId: string }>(memberships: T[]): Promise<T[]> {
  const clinicIds = [...new Set(memberships.map((membership) => membership.clinicId).filter(Boolean))];
  if (!clinicIds.length) return memberships;
  const archivedRows = await prisma.organization.findMany({
    where: { originalType: 'Clinic', originalId: { in: clinicIds }, archivedAt: { not: null } },
    select: { originalId: true },
  });
  const archivedClinicIds = new Set(archivedRows.map((row) => row.originalId).filter((id): id is string => Boolean(id)));
  return memberships.filter((membership) => !archivedClinicIds.has(membership.clinicId));
}

/** Staff invitations are clinic writes; fail closed if archive/trial state cannot be verified. */
async function ensureClinicContextWritableForInvitation(clinicId: string, res: any): Promise<boolean> {
  const archived = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId, archivedAt: { not: null } },
    select: { id: true },
  });
  if (archived) {
    res.status(410).json({ ok: false, error: 'Организация архивирована', code: 'ORGANIZATION_ARCHIVED' });
    return false;
  }
  const access = await resolveClinicSubscriptionAccess(clinicId);
  if (!access) {
    res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
    return false;
  }
  if (access.writeBlocked) {
    res.status(402).json({ ok: false, error: 'Клиника работает в режиме только для чтения после окончания пробного периода.', code: 'SUBSCRIPTION_EXPIRED' });
    return false;
  }
  return true;
}


authMeRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = req.user!;
  const allMemberships = await prisma.clinicMember.findMany({
    where: { userId: user.id },
    include: { clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const memberships = await excludeArchivedClinicMemberships(allMemberships);
  const activeMembership = user.clinicId
    ? memberships.find((membership) => membership.clinicId === user.clinicId) || null
    : null;
  const activeOrganization = user.organizationId
    ? await prisma.organization.findFirst({ where: { id: user.organizationId, archivedAt: null }, select: { name: true } })
    : null;

  // `/me` is also the session-hydration contract used by the frontend. It must
  // return the same effective IAM policy as login, otherwise a successful login
  // can be immediately overwritten by an empty `pages` array and every guarded
  // CRM route redirects to the AI workspace. `authenticate` has already resolved
  // the active organization/person role into req.user.role; using the persisted
  // global User.role here would over-grant a user who is an OWNER globally but a
  // DOCTOR/ADMIN in the currently selected organization.
  const effectiveRole = user.organizationId
    ? (await resolveOrganizationRoleKey(user.id, user.organizationId) || String(user.role || 'USER').toUpperCase())
    : String(user.role || 'USER').toUpperCase();
  const effectivePermissions = await resolveUserPermissions(
    user.id,
    user.organizationId || user.clinicId || null,
    effectiveRole,
  );
  const pages = pagesForCaller(effectivePermissions, effectiveRole);
  const capabilities = capabilitiesForPermissions(effectivePermissions, effectiveRole);

  return res.json({
    ok: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organizationOriginalId: user.organizationOriginalId,
        organizationType: user.organizationType,
        organizationName: activeOrganization?.name,
        personType: user.personType,
        effectiveRole,
      },
      memberships: memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        clinicId: membership.clinicId,
        branchId: membership.branchId,
        joinedAt: membership.joinedAt,
        clinic: membership.clinic,
      })),
      activeMembership: activeMembership
        ? {
            id: activeMembership.id,
            role: activeMembership.role,
            clinicId: activeMembership.clinicId,
            branchId: activeMembership.branchId,
            joinedAt: activeMembership.joinedAt,
            clinic: activeMembership.clinic,
          }
        : null,
      permissions: effectivePermissions,
      pages,
      capabilities,
      effectiveRole,
    },
  } satisfies ApiResponse);
});

authMeRouter.get('/my-clinics', authenticate, async (req: AuthRequest, res) => {
  const allMemberships = await prisma.clinicMember.findMany({
    where: { userId: req.user!.id },
    include: { clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const memberships = await excludeArchivedClinicMemberships(allMemberships);

  return res.json({
    ok: true,
    data: memberships.map((membership) => ({
      ...membership.clinic,
      membershipId: membership.id,
      role: membership.role,
      clinicId: membership.clinicId,
      branchId: membership.branchId,
      joinedAt: membership.joinedAt,
    })),
  } satisfies ApiResponse);
});

/**
 * Create a clinic employee invitation. This endpoint intentionally lives on
 * the /auth router because the web client uses /api/auth/invitations.
 * Membership ACL is enforced here rather than trusting clinicId from the UI.
 */
authMeRouter.post('/invitations', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = String(req.body?.clinicId || '').trim();
    if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId обязателен' } satisfies ApiResponse);

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId } },
      select: { id: true, role: true },
    });
    if (!membership) return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' } satisfies ApiResponse);
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для создания приглашений' } satisfies ApiResponse);
    }
    if (!(await ensureClinicContextWritableForInvitation(clinicId, res))) return;

    const roleMap: Record<string, UserRole> = {
      OWNER: 'OWNER',
      DIRECTOR: 'OWNER',
      ADMIN: 'ADMIN',
      ASSISTANT: 'ASSISTANT',
      MANAGER: 'MANAGER',
      LAB: 'LAB',
      STUDENT: 'STUDENT',
      DOCTOR: 'DOCTOR',
    };
    const requestedRole = String(req.body?.role || 'DOCTOR').trim().toUpperCase();
    const role = roleMap[requestedRole] || 'DOCTOR';
    if (role === 'OWNER' && membership.role !== 'OWNER') {
      return res.status(403).json({ ok: false, error: 'Только владелец может приглашать владельца' } satisfies ApiResponse);
    }

    const expiresInDays = Math.min(30, Math.max(1, Number(req.body?.expiresInDays) || 7));
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const code = await createClinicInvitation({ clinicId, email, role, expiresAt });

    return res.status(201).json({
      ok: true,
      data: { code, clinicId, email, role, expiresAt },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[auth/invitations]', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать приглашение' } satisfies ApiResponse);
  }
});
