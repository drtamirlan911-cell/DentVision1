import type { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../types/index.js';
import type { UserRole } from '@prisma/client';
import { permissionsSatisfy, roleHasPermission, LEGACY_KEY_MAP, type PermissionKey } from '../lib/permissions.js';
import { resolveUserPermissions } from '../lib/resolvePermissions.js';

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
 * Clinical write boundary for legacy medical routes.
 *
 * `patient.write` is intentionally broad because administrators need it for
 * operational patient management. It must not, however, become an implicit
 * clinical sign-off permission. Treatment plans, odontogram writes and
 * AI/diagnostic surface findings are clinical decisions and therefore require
 * the dedicated `medical.manage` permission.
 *
 * Visit creation/update remains available for administrative documentation,
 * but a non-clinical role cannot submit diagnosis or treatment content through
 * that route. Doctor/Owner retain the existing clinical workflow.
 */
export function requiresClinicalMedicalManage(req: AuthRequest, keys: string[]): boolean {
  if (req.user?.role === 'SUPERADMIN') return false;

  const method = req.method.toUpperCase();
  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  if (!isWrite) return keys.includes('medical.manage');

  const path = req.path || '';
  const treatmentPlanWrite = /^\/treatment-plan(?:\/|$)/.test(path);
  const odontogramWrite = /^\/teeth(?:\/|$)/.test(path);
  const visitWrite = /^\/visits(?:\/|$)/.test(path);

  if (treatmentPlanWrite || odontogramWrite) return true;

  if (visitWrite) {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    return body.diagnosis !== undefined || body.treatment !== undefined;
  }

  // Existing callers of the explicit clinical permission keep its semantics.
  return keys.includes('medical.manage');
}

/**
 * Requires the authenticated user's permissions to grant ALL of the given keys.
 * Source of truth: the DB Person → PersonRole → Role → Permission graph, merged
 * with the canonical scoped role baseline. This is important for compound
 * clinic roles: one person may be OWNER and DOCTOR in the same organization.
 *
 * The resolver is deliberately used here instead of duplicating a direct
 * PersonRole query. The old implementation treated the DB role graph as an
 * exclusive replacement for the canonical role matrix. A stale/incomplete
 * PersonRole assignment could therefore remove `medical.manage` from an OWNER,
 * while the rest of the IAM stack correctly resolved that permission. That made
 * the treatment-plan approval button appear usable but return 403.
 */
export function requirePermission(...keys: (PermissionKey | string)[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
      }

      if (req.user.role === 'SUPERADMIN') return next();

      const effectiveKeys = requiresClinicalMedicalManage(req, keys)
        ? [...keys.filter((key) => key !== 'patient.write' && key !== 'medical.write'), 'medical.manage']
        : keys;

      const scopeId = req.user.organizationId || req.user.clinicId;
      const permissions = await resolveUserPermissions(
        req.user.id,
        scopeId,
        req.user.role,
      );
      const granted = new Set(permissions);
      const resolved = effectiveKeys.map((key) => (LEGACY_KEY_MAP as Record<string, string>)[key] || key);

      if (resolved.every((key) => permissionsSatisfy(granted, key))) return next();

      // Preserve the legacy fallback only when the unified resolver has no
      // usable grants at all. This keeps legacy-only users operational without
      // allowing an empty scoped policy to manufacture new permissions.
      if (permissions.length === 0) {
        const allowed = effectiveKeys.every((key) => roleHasPermission(req.user!.role, key));
        if (allowed) return next();
      }

      return res.status(403).json({ ok: false, error: 'Недостаточно прав' });
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
