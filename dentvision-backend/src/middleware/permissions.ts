import type { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { roleHasPermission, type PermissionKey } from '../lib/permissions.js';
import type { AuthRequest } from '../types/index.js';

/**
 * Middleware: require a specific permission key.
 * Checks against DB Role/Permission tables first, falls back to hardcoded map.
 */
export function requirePermission(...keys: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
      }

      // SUPERADMIN bypass
      if (user.role === 'SUPERADMIN') return next();

      // Try DB-based permission check via Person -> PersonRole -> Role -> Permission
      if (user.organizationId || user.clinicId) {
        const scopeId = user.organizationId || user.clinicId;
        const person = await prisma.person.findFirst({
          where: {
            userId: user.id,
            organizationId: scopeId,
          },
          include: {
            personRoles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        });

        if (person) {
          const userPerms = new Set<string>();
          for (const pr of person.personRoles) {
            for (const rp of pr.role.permissions) {
              userPerms.add(rp.permission.key);
            }
          }
          const hasAll = keys.every((k) => userPerms.has(k));
          if (hasAll) return next();
        }
      }

      // Fallback to hardcoded permission map
      for (const key of keys) {
        if (roleHasPermission(user.role, key as PermissionKey)) return next();
      }

      return res.status(403).json({ ok: false, error: 'Недостаточно прав', code: 'INSUFFICIENT_PERMISSIONS' });
    } catch (error) {
      console.error('[permissions] error:', error);
      return res.status(500).json({ ok: false, error: 'Ошибка проверки прав' });
    }
  };
}

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
