import type { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../types/index.js';
import type { UserRole } from '@prisma/client';
import { roleHasPermission, LEGACY_KEY_MAP, type PermissionKey } from '../lib/permissions.js';

const ROLE_HIERARCHY: Record<string, number> = {
  SUPERADMIN: 5,
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 3,
  DOCTOR: 2,
  LAB: 2,
  ASSISTANT: 1,
  STUDENT: 1,
};

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав' });
    }
    next();
  };
}

export function requireMinRole(minRole: UserRole) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав' });
    }
    next();
  };
}

/**
 * Requires the authenticated user's permissions to grant ALL of the given keys.
 * Source of truth: the DB Person → PersonRole → Role → Permission graph (backfilled
 * by migrate-unified-schema.ts), with a hardcoded fallback to the shared role
 * matrix for users/personas not yet present in the unified tables.
 * Deny-by-default: unknown roles/permissions are rejected.
 */
export function requirePermission(...keys: (PermissionKey | string)[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
      }

      // SUPERADMIN bypass
      if (req.user.role === 'SUPERADMIN') return next();

      // DB-based check via Person → PersonRole → Role → Permission.
      const scopeId = req.user.organizationId || req.user.clinicId;
      if (scopeId) {
        const person = await prisma.person.findFirst({
          where: { userId: req.user.id, organizationId: scopeId },
          include: {
            personRoles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        });
        if (person) {
          const userPerms = new Set<string>();
          for (const pr of person.personRoles) {
            for (const rp of pr.role.permissions) userPerms.add(rp.permission.key);
          }
          // Map legacy route keys (e.g. 'patient.read') to DB vocabulary (e.g. 'patients.read')
          // so the Person→Role→Permission graph is actually used instead of always
          // falling through to the matrix fallback.
          const resolved = keys.map((k) => (LEGACY_KEY_MAP as Record<string, string>)[k] || k);
          if (resolved.every((k) => userPerms.has(k))) return next();
        }
      }

      // Fallback to the hardcoded role matrix.
      const allowed = keys.every((k) => roleHasPermission(req.user!.role, k));
      if (!allowed) {
        return res.status(403).json({ ok: false, error: 'Недостаточно прав' });
      }
      next();
    } catch (error) {
      console.error('[requirePermission] error:', error);
      return res.status(500).json({ ok: false, error: 'Ошибка проверки прав' });
    }
  };
}

export function requireSuperadmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ ok: false, error: 'Требуются права суперадмина' });
  }
  next();
}
