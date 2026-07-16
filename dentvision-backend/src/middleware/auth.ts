import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
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
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      clinicId: payload.clinicId,
    };

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
      req.user = { id: payload.sub, email: payload.email, role: payload.role, firstName: '', lastName: '', clinicId: payload.clinicId };
    }
  } catch {}
  next();
}
