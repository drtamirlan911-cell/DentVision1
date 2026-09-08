/**
 * Express helpers for SaaS plan gating.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { applyCorsHeaders } from '../lib/cors.js';
import { getClinicId } from '../lib/orgContext.js';
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
import {
  assertTreatmentPlanDoctorInClinic,
  assertTreatmentPlanReferencesInClinic,
  TreatmentPlanReferenceError,
} from '../modules/crm/treatmentPlanSecurity.js';

function effectiveClinicId(user: AuthRequest['user']): string | undefined {
  return getClinicId(user!);
}

function sendPlanError(req: AuthRequest, res: Response, err: unknown) {
  applyCorsHeaders(req, res);
  if (err instanceof PlanGateError) {
    return res.status(err.status).json({ ok: false, error: err.message, code: err.code, data: err.data });
  }
  throw err;
}

function sendTreatmentPlanReferenceError(req: AuthRequest, res: Response, error: TreatmentPlanReferenceError) {
  applyCorsHeaders(req, res);
  const messages: Record<string, string> = {
    DOCTOR_OUTSIDE_CLINIC: 'Указанный врач не относится к выбранной клинике',
    APPOINTMENT_OUTSIDE_CLINIC: 'Указанная запись не относится к выбранной клинике',
    INVOICE_OUTSIDE_CLINIC: 'Указанный счёт не относится к выбранной клинике',
  };
  return res.status(403).json({ ok: false, error: messages[error.code] || 'Ссылка на объект другой клиники запрещена', code: error.code });
}

async function guardTreatmentPlanReferences(req: AuthRequest, res: Response): Promise<boolean> {
  const clinicId = effectiveClinicId(req.user);
  if (!clinicId) return true;
  const path = String(req.path || '');
  try {
    if (req.method === 'POST' && path === '/treatment-plans') {
      const doctorId = typeof req.body?.doctorId === 'string' ? req.body.doctorId : null;
      await assertTreatmentPlanDoctorInClinic(doctorId, clinicId);
    }
    if (req.method === 'PATCH' && /^\/treatment-plans\/[^/]+\/stages\/[^/]+$/.test(path)) {
      const appointmentId = typeof req.body?.appointmentId === 'string' ? req.body.appointmentId : null;
      const invoiceId = typeof req.body?.invoiceId === 'string' ? req.body.invoiceId : null;
      await assertTreatmentPlanReferencesInClinic(clinicId, { appointmentId, invoiceId });
    }
    return true;
  } catch (error) {
    if (error instanceof TreatmentPlanReferenceError) {
      sendTreatmentPlanReferenceError(req, res, error);
      return false;
    }
    throw error;
  }
}

/** Attach resolved clinic access to req (SUPERADMIN bypasses write blocks). */
export async function loadClinicAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clinicId = effectiveClinicId(req.user);
    if (!clinicId) return next();
    const access = await resolveClinicAccess(clinicId);
    if (access && req.user?.role === 'SUPERADMIN') {
      access.writeBlocked = false;
      access.expired = false;
      access.limits = { patientsReached: false, usersReached: false, aiQuotaReached: false };
      access.approaching = { patients: false, users: false, ai: false };
    }
    if (access) req.clinicAccess = access;
    if (!(await guardTreatmentPlanReferences(req, res))) return;
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
      if (!effectiveClinicId(req.user)) return res.status(400).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' });
      return next();
    }
    assertClinicWritable(access);
    next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function blockClinicWrites(req: AuthRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const cid = effectiveClinicId(req.user);
  if (!req.clinicAccess && cid) {
    try {
      const access = await resolveClinicAccess(cid);
      if (access) {
        if (req.user?.role === 'SUPERADMIN') { access.writeBlocked = false; access.expired = false; }
        req.clinicAccess = access;
      }
    } catch (e) { console.error('[planGate] blockClinicWrites', e); }
  }
  return requireClinicWritable(req, res, next);
}

export function requirePlanFeature(feature: PlanFeature) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role === 'SUPERADMIN' || req.user?.isGuest) return next();
      const access = req.clinicAccess;
      if (!access) return next();
      assertFeature(access, feature); next();
    } catch (e) { return sendPlanError(req, res, e); }
  };
}

export async function guardPatientCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = effectiveClinicId(req.user); if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId)); if (!access) return next();
    req.clinicAccess = access; assertPatientSlot(access); next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function guardUserCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = String(req.params.id || effectiveClinicId(req.user) || ''); if (!clinicId) return next();
    const access = await resolveClinicAccess(clinicId); if (!access) return next();
    req.clinicAccess = access; assertUserSlot(access); next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function guardAiAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || req.user?.isGuest || !req.user?.id) return next();
    const clinicId = effectiveClinicId(req.user); if (!clinicId) return next();
    if (process.env.DEMO_CLINIC_ID && clinicId === process.env.DEMO_CLINIC_ID) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId)); if (!access) return next();
    req.clinicAccess = access;
    if (String(access.clinicPlan || '').toUpperCase() === 'DEMO') return next();
    const method = req.method.toUpperCase(); const path = String(req.path || req.url || '');
    const softRead = method === 'GET' && (/proactive|threads|history|digital-twin|briefing|memory/i.test(path));
    if (softRead) return next();
    if (method === 'GET' || method === 'HEAD') assertFeature(access, 'ai'); else assertAiAllowed(access);
    next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function guardAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = effectiveClinicId(req.user); if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId)); if (!access) return next();
    req.clinicAccess = access; assertFeature(access, 'analytics'); next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export { sendPlanError, PlanGateError };
