/**
 * Express helpers for SaaS plan gating.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { applyCorsHeaders } from '../lib/cors.js';
import {
  PlanGateError,
  resolveClinicAccess,
  assertClinicWritable,
  assertFeature,
  assertPatientSlot,
  assertUserSlot,
  assertAiAllowed,
  type PlanFeature,
} from '../modules/billing/planEntitlements.js';

function sendPlanError(req: AuthRequest, res: Response, err: unknown) {
  applyCorsHeaders(req, res);
  if (err instanceof PlanGateError) {
    return res.status(err.status).json({
      ok: false,
      error: err.message,
      code: err.code,
      data: err.data,
    });
  }
  throw err;
}

/** Attach resolved clinic access to req (SUPERADMIN bypasses write blocks). */
export async function loadClinicAccess(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return next();
    const access = await resolveClinicAccess(clinicId);
    if (access && req.user?.role === 'SUPERADMIN') {
      access.writeBlocked = false;
      access.expired = false;
      access.limits = { patientsReached: false, usersReached: false, aiQuotaReached: false };
      access.approaching = { patients: false, users: false, ai: false };
    }
    if (access) req.clinicAccess = access;
    next();
  } catch (e) {
    console.error('[planGate] loadClinicAccess', e);
    next();
  }
}

export function requireClinicWritable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const access = req.clinicAccess;
    if (!access) {
      if (!req.user?.clinicId) {
        return res.status(400).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' });
      }
      return next();
    }
    assertClinicWritable(access);
    next();
  } catch (e) {
    return sendPlanError(req, res, e);
  }
}

/** Block mutating HTTP methods when subscription is expired (reads stay open). */
export async function blockClinicWrites(req: AuthRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  if (!req.clinicAccess && req.user?.clinicId) {
    try {
      const access = await resolveClinicAccess(req.user.clinicId);
      if (access) {
        if (req.user?.role === 'SUPERADMIN') {
          access.writeBlocked = false;
          access.expired = false;
        }
        req.clinicAccess = access;
      }
    } catch (e) {
      console.error('[planGate] blockClinicWrites', e);
    }
  }
  return requireClinicWritable(req, res, next);
}

export function requirePlanFeature(feature: PlanFeature) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role === 'SUPERADMIN') return next();
      if (req.user?.isGuest) return next();
      const access = req.clinicAccess;
      if (!access) return next();
      assertFeature(access, feature);
      next();
    } catch (e) {
      return sendPlanError(req, res, e);
    }
  };
}

export async function guardPatientCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = req.user?.clinicId;
    if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId));
    if (!access) return next();
    req.clinicAccess = access;
    assertPatientSlot(access);
    next();
  } catch (e) {
    return sendPlanError(req, res, e);
  }
}

export async function guardUserCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = String(req.params.id || req.user?.clinicId || '');
    if (!clinicId) return next();
    const access = await resolveClinicAccess(clinicId);
    if (!access) return next();
    req.clinicAccess = access;
    assertUserSlot(access);
    next();
  } catch (e) {
    return sendPlanError(req, res, e);
  }
}

export async function guardAiAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    if (req.user?.isGuest || !req.user?.id) return next();
    const clinicId = req.user?.clinicId;
    if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId));
    if (!access) return next();
    req.clinicAccess = access;
    const method = req.method.toUpperCase();
    const path = String(req.path || req.url || '');
    // Soft reads (tips / thread restore) must not hard-block the shell on starter.
    const softRead =
      method === 'GET' &&
      (/proactive|threads|history|digital-twin|briefing|memory/i.test(path));
    if (softRead) {
      // Allow through; UI can still show upgrade prompts from billing banner.
      return next();
    }
    if (method === 'GET' || method === 'HEAD') {
      assertFeature(access, 'ai');
    } else {
      assertAiAllowed(access);
    }
    next();
  } catch (e) {
    return sendPlanError(req, res, e);
  }
}

export async function guardAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = req.user?.clinicId;
    if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId));
    if (!access) return next();
    req.clinicAccess = access;
    assertFeature(access, 'analytics');
    next();
  } catch (e) {
    return sendPlanError(req, res, e);
  }
}

export { sendPlanError, PlanGateError };
