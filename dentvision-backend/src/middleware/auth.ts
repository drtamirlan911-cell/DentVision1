import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
import { isGuestEmail } from '../lib/guestAiQuota.js';
import { setCsrfCookie } from './csrf.js';
import type { AuthRequest, AuthUser } from '../types/index.js';
import type { UserRole } from '@prisma/client';

const ROLE_KEY_MAP: Record<string, UserRole> = {
  SUPERADMIN: 'SUPERADMIN', superadmin: 'SUPERADMIN',
  OWNER: 'OWNER', owner: 'OWNER', org_owner: 'OWNER', DIRECTOR: 'OWNER', director: 'OWNER',
  ADMIN: 'ADMIN', admin: 'ADMIN', org_admin: 'ADMIN',
  MANAGER: 'MANAGER', manager: 'MANAGER',
  DOCTOR: 'DOCTOR', doctor: 'DOCTOR',
  ASSISTANT: 'ASSISTANT', assistant: 'ASSISTANT',
  CASHIER: 'CASHIER', cashier: 'CASHIER',
  LAB: 'LAB', lab: 'LAB',
  STUDENT: 'STUDENT', student: 'STUDENT',
  SUPPORT: 'SUPPORT', support: 'SUPPORT',
  // Partner-only roles live in the unified Role table but have no UserRole enum
  // equivalent. STUDENT is the least-privileged compatibility identity; the
  // actual seller/lecturer permissions remain authoritative in PersonRole.
  SELLER: 'STUDENT', seller: 'STUDENT',
  LECTURER: 'STUDENT', lecturer: 'STUDENT',
};

const ROLE_PRIORITY: Record<UserRole, number> = {
  SUPERADMIN: 100, OWNER: 90, ADMIN: 80, MANAGER: 70, DOCTOR: 60,
  LAB: 50, ASSISTANT: 40, CASHIER: 30, STUDENT: 20, SUPPORT: 10,
};

function normalizeScopedRole(roleKey: string): UserRole | undefined {
  return ROLE_KEY_MAP[roleKey] || ROLE_KEY_MAP[roleKey.toUpperCase()];
}

/** Merge canonical BranchMember assignments with legacy clinic memberships. */
export function mergeBranchIds(unifiedBranchIds: readonly string[], legacyBranchIds: readonly string[]): string[] {
  return Array.from(new Set([...unifiedBranchIds, ...legacyBranchIds].filter(Boolean)));
}

export function resolveActivePersonRole(
  personRoles: Array<{ scopeType: string | null; scopeId: string | null; role: { key: string } }>,
  organizationId: string,
): UserRole | undefined {
  const activeRoles = personRoles
    .filter((pr) => {
      if (pr.scopeType === 'organization' && pr.scopeId && pr.scopeId !== organizationId) return false;
      if (pr.scopeId && pr.scopeId !== organizationId) return false;
      return true;
    })
    .map((pr) => normalizeScopedRole(pr.role.key))
    .filter((role): role is UserRole => Boolean(role));

  return activeRoles.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0];
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    let token = '';
    if (header?.startsWith('Bearer ')) token = header.slice(7);
    else if (req.cookies?.accessToken) token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        memberships: { select: { id: true, clinicId: true, role: true, branchId: true } },
      },
    });
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

    setCsrfCookie(res);
    const guestByEmail = isGuestEmail(user.email);
    if (!guestByEmail) {
      if (!payload.sessionId) return res.status(401).json({ ok: false, error: 'Сессия отсутствует или недействительна' });
      try {
        const activeSession = await prisma.userSession.findFirst({
          where: { id: payload.sessionId, userId: user.id, expiredAt: { gt: new Date() } },
        });
        if (!activeSession) return res.status(401).json({ ok: false, error: 'Сессия истекла или отозвана' });
      } catch {
        return res.status(401).json({ ok: false, error: 'Unable to verify session' });
      }
    }

    const hasMembership = (user.memberships?.length || 0) > 0;
    const isGuest = guestByEmail && !hasMembership;
    let effectiveOrgId: string | undefined;
    let effectiveOrgType: string | undefined;
    let effectivePersonType: string | undefined;
    let effectiveClinicId: string | undefined;
    let effectiveSupplierId: string | undefined;
    let unifiedBranchIds: string[] = [];
    let effectiveRole = user.role;

    if (!isGuest) {
      if (payload.organizationId) {
        const person = await prisma.person.findFirst({
          where: { userId: user.id, organizationId: payload.organizationId },
          include: {
            organization: { select: { type: true, originalId: true } },
            personRoles: { select: { scopeType: true, scopeId: true, role: { select: { key: true } } } },
            branchMemberships: { select: { branchId: true } },
          },
        });
        if (person?.organization) {
          const scopedRole = resolveActivePersonRole(person.personRoles, payload.organizationId);
          if (!scopedRole) {
            return res.status(403).json({ ok: false, error: 'У вас нет активной роли в этой организации' });
          }
          effectiveOrgId = payload.organizationId;
          effectiveOrgType = person.organization.type;
          effectivePersonType = person.personType;
          effectiveRole = scopedRole;
          unifiedBranchIds = person.branchMemberships.map((membership) => membership.branchId);
          if (person.organization.type === 'CLINIC') effectiveClinicId = person.organization.originalId || undefined;
        }
      }

      if (!effectiveClinicId && payload.clinicId) {
        const activeMember = user.memberships?.find((m) => m.clinicId === payload.clinicId);
        if (activeMember) {
          effectiveClinicId = payload.clinicId;
          effectiveOrgId = payload.clinicId;
          effectiveOrgType = 'CLINIC';
          effectiveRole = activeMember.role;
        }
      }
      if (!effectiveOrgId && payload.supplierId) effectiveSupplierId = payload.supplierId;
    }

    const activeMembership = effectiveClinicId
      ? user.memberships?.find((m) => m.clinicId === effectiveClinicId)
      : undefined;
    const legacyBranchIds = user.memberships
      ?.filter((membership) => membership.clinicId === effectiveClinicId && membership.branchId)
      .map((membership) => membership.branchId as string) || [];
    const branchIds = mergeBranchIds(unifiedBranchIds, legacyBranchIds);
    const assignedBranchId = unifiedBranchIds[0] || activeMembership?.branchId || undefined;

    req.user = {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: effectiveRole, clinicId: effectiveClinicId,
      supplierId: isGuest ? undefined : (payload.supplierId || effectiveSupplierId),
      supplierRole: isGuest ? undefined : payload.supplierRole,
      lecturerId: isGuest ? undefined : payload.lecturerId,
      organizationId: effectiveOrgId, organizationType: effectiveOrgType, personType: effectivePersonType,
      branchIds, assignedBranchId, sessionId: payload.sessionId, isGuest,
    } satisfies AuthUser;
    next();
  } catch (err: any) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : undefined;
    return res.status(401).json({ ok: false, error: 'Невалидный токен', code });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken || '';
    if (token) {
      const payload = verifyAccessToken(token);
      const email = String(payload.email || '');
      const guestByEmail = isGuestEmail(email);
      const roleUpper = String(payload.role || '').toUpperCase();
      const isGuest = guestByEmail || roleUpper === 'GUEST' || (payload.isGuest === true && (!email || guestByEmail));
      req.user = {
        id: payload.sub, email, role: payload.role, firstName: '', lastName: '',
        clinicId: isGuest ? undefined : payload.clinicId,
        organizationId: isGuest ? undefined : payload.organizationId,
        organizationType: isGuest ? undefined : payload.organizationType,
        personType: isGuest ? undefined : payload.personType, isGuest,
      };
    }
  } catch { /* anonymous */ }
  next();
}
