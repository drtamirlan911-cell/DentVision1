import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import type { UserRole } from '@prisma/client';
import { roleHasPermission, type PermissionKey } from '../lib/permissions.js';

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
 * Requires the authenticated user's role to grant ALL of the given permissions.
 * Deny-by-default: unknown roles/permissions are rejected.
 */
export function requirePermission(...keys: PermissionKey[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const allowed = keys.every((k) => roleHasPermission(req.user!.role, k));
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав' });
    }
    next();
  };
}

export function requireSuperadmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ ok: false, error: 'Требуются права суперадмина' });
  }
  next();
}
