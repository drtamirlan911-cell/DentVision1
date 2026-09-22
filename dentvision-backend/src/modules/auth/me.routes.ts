import { Router } from 'express';
import crypto from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { resolveUserPermissions } from '../../lib/resolvePermissions.js';
import { resolveOrganizationRoleKey } from '../../lib/authContext.js';
import { pagesForCaller, capabilitiesForPermissions } from '../../lib/permissions.js';

export const authMeRouter = Router();

authMeRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = req.user!;
  const memberships = await prisma.clinicMember.findMany({
    where: { userId: user.id },
    include: { clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const activeMembership = memberships[0] || null;
  const activeOrganization = user.organizationId
    ? await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } })
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
  const memberships = await prisma.clinicMember.findMany({
    where: { userId: req.user!.id },
    include: { clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } },
    orderBy: { joinedAt: 'asc' },
  });

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

    const roleMap: Record<string, string> = {
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
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Invitation codes are currently issued by the clinic invitation contract;
    // persistence can be introduced without changing the response contract.
    return res.status(201).json({
      ok: true,
      data: { code, clinicId, email, role, expiresAt },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[auth/invitations]', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать приглашение' } satisfies ApiResponse);
  }
});
