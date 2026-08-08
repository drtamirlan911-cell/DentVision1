/**
 * Permission middleware — single source of truth lives in ./rbac.ts.
 * This module re-exports it so existing imports keep working, and adds the
 * org-scoped person guard used by org-aware routes.
 */
import type { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../types/index.js';

export { requirePermission } from './rbac.js';

/**
 * Middleware: require the user to have a Person record (any type) in the given organization.
 */
export function requirePersonScope(orgId: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
      }

      if (user.role === 'SUPERADMIN') return next();

      const person = await prisma.person.findFirst({
        where: { userId: user.id, organizationId: orgId },
      });

      if (!person) {
        return res.status(403).json({ ok: false, error: 'У вас нет доступа к этой организации' });
      }

      next();
    } catch (error) {
      console.error('[requirePersonScope] error:', error);
      return res.status(500).json({ ok: false, error: 'Ошибка проверки доступа' });
    }
  };
}
