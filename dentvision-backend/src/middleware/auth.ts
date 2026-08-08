import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
import { isGuestEmail } from '../lib/guestAiQuota.js';
import { setCsrfCookie } from './csrf.js';
import type { AuthRequest, AuthUser } from '../types/index.js';

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    let token = '';
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        memberships: { select: { id: true, clinicId: true, role: true } },
      },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    }

    // Refresh CSRF token on every authenticated request
    setCsrfCookie(res);

    const guestByEmail = isGuestEmail(user.email);
    if (!guestByEmail && payload.sessionId) {
      try {
        const activeSession = await prisma.userSession.findFirst({
          where: { id: payload.sessionId, userId: user.id, expiredAt: { gt: new Date() } },
        });
        if (!activeSession) {
          return res.status(401).json({ ok: false, error: 'Сессия истекла или отозвана' });
        }
      } catch {
        console.warn('[auth] user_sessions table unavailable — skipping session check');
      }
    }

    const hasMembership = (user.memberships?.length || 0) > 0;
    const isGuest = guestByEmail && !hasMembership;

    // Resolve active context: try organizationId first (unified), fallback to clinicId
    let effectiveOrgId: string | undefined;
    let effectiveOrgType: string | undefined;
    let effectivePersonType: string | undefined;
    let effectiveClinicId: string | undefined;
    let effectiveSupplierId: string | undefined;
    let effectiveRole = user.role;

    if (!isGuest) {
      // 1) Try unified Organization context from JWT
      if (payload.organizationId) {
        const person = await prisma.person.findFirst({
          where: { userId: user.id, organizationId: payload.organizationId },
          include: { organization: { select: { type: true, originalId: true } } },
        });
        if (person && person.organization) {
          effectiveOrgId = payload.organizationId;
          effectiveOrgType = person.organization.type;
          effectivePersonType = person.personType;
          if (person.organization.type === 'CLINIC') {
            // Organization.id is a fresh id — the clinic's own id lives in
            // originalId. Using the organization id here handed every
            // clinic-scoped query an id that matches no Clinic row.
            effectiveClinicId = person.organization.originalId || undefined;
          }
        }
      }

      // 2) Fallback: legacy clinicId from JWT → ClinicMember
      if (!effectiveClinicId && payload.clinicId) {
        const activeMember = user.memberships?.find(
          (m) => m.clinicId === payload.clinicId,
        );
        if (activeMember) {
          effectiveClinicId = payload.clinicId;
          effectiveOrgId = payload.clinicId;
          effectiveOrgType = 'CLINIC';
          // A user may have a different role in each clinic. The scoped
          // membership role must win over the global User.role.
          effectiveRole = activeMember.role;
        }
      }

      // 3) Fallback: supplierId from JWT
      if (!effectiveOrgId && payload.supplierId) {
        effectiveSupplierId = payload.supplierId;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: effectiveRole,
      clinicId: effectiveClinicId,
      supplierId: isGuest ? undefined : (payload.supplierId || effectiveSupplierId),
      supplierRole: isGuest ? undefined : payload.supplierRole,
      lecturerId: isGuest ? undefined : payload.lecturerId,
      organizationId: effectiveOrgId,
      organizationType: effectiveOrgType,
      personType: effectivePersonType,
      sessionId: payload.sessionId,
      isGuest,
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
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : req.cookies?.accessToken || '';
    if (token) {
      const payload = verifyAccessToken(token);
      const email = String(payload.email || '');
      const guestByEmail = isGuestEmail(email);
      const roleUpper = String(payload.role || '').toUpperCase();
      // Without DB lookup, only trust explicit guest signals — never treat
      // missing isGuest on a real email as staff elevation for guests.
      const isGuest =
        guestByEmail ||
        roleUpper === 'GUEST' ||
        (payload.isGuest === true && (!email || guestByEmail));

      req.user = {
        id: payload.sub,
        email,
        role: payload.role,
        firstName: '',
        lastName: '',
        clinicId: isGuest ? undefined : payload.clinicId,
        organizationId: isGuest ? undefined : payload.organizationId,
        organizationType: isGuest ? undefined : payload.organizationType,
        personType: isGuest ? undefined : payload.personType,
        isGuest,
      };
    }
  } catch { /* anonymous */ }
  next();
}
