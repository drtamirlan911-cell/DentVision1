import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
import { isGuestEmail } from '../lib/guestAiQuota.js';
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
        memberships: { select: { id: true, clinicId: true, status: true } },
      },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    }

    const guestByEmail = isGuestEmail(user.email);
    if (!guestByEmail) {
      try {
        const activeSession = await prisma.userSession.findFirst({
          where: { userId: user.id, expiredAt: { gt: new Date() } },
        });
        if (!activeSession) {
          console.warn(`[auth] no active session for user ${user.id} — allowing anyway (JWT valid)`);
        }
      } catch {
        console.warn('[auth] user_sessions table unavailable — skipping session check');
      }
    }

    const hasMembership = (user.memberships?.length || 0) > 0;
    const isGuest = guestByEmail && !hasMembership;

    // Verify that the clinicId from the JWT still has an active membership
    let effectiveClinicId = isGuest ? undefined : payload.clinicId;
    if (effectiveClinicId) {
      const activeMember = user.memberships?.find(
        (m) => m.clinicId === effectiveClinicId && m.status === 'active'
      );
      if (!activeMember) {
        effectiveClinicId = undefined;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      clinicId: effectiveClinicId,
      supplierId: isGuest ? undefined : payload.supplierId,
      supplierRole: isGuest ? undefined : payload.supplierRole,
      lecturerId: isGuest ? undefined : payload.lecturerId,
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
        isGuest,
      };
    }
  } catch { /* anonymous */ }
  next();
}
