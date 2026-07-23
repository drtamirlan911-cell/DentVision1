import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
import { isGuestEmail } from '../lib/guestAiQuota.js';
import type { AuthRequest, AuthUser } from '../types/index.js';

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }

    const token = header.slice(7);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        memberships: { select: { id: true }, take: 1 },
      },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    }

    // Verify user has at least one active session; if all sessions are
    // expired/revoked, the JWT is stale and must be rejected.
    const guestByEmail = isGuestEmail(user.email);
    if (!guestByEmail) {
      const activeSession = await prisma.userSession.findFirst({
        where: { userId: user.id, expiredAt: { gt: new Date() } },
      });
      if (!activeSession) {
        return res.status(401).json({ ok: false, error: 'Сессия истекла, выполните вход заново' });
      }
    }
    const hasMembership = (user.memberships?.length || 0) > 0;
    const isGuest = guestByEmail && !hasMembership;

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      // Guests never carry a clinic scope from a stolen JWT claim.
      clinicId: isGuest ? undefined : payload.clinicId,
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
    if (header?.startsWith('Bearer ')) {
      const payload = verifyAccessToken(header.slice(7));
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
