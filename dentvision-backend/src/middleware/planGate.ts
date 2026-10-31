/**
 * Express helpers for SaaS plan gating.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { applyCorsHeaders } from '../lib/cors.js';
import prisma from '../lib/prisma.js';
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

/** Resolve clinicId from user context (organizationId when CLINIC, or legacy clinicId). */
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
    APPOINTMENT_OUTSIDE_CLINIC: 'Указанная запись не относится к выбранному пациенту или клинике',
    INVOICE_OUTSIDE_CLINIC: 'Указанный счёт не относится к выбранному пациенту или клинике',
  };
  return res.status(403).json({ ok: false, error: messages[error.code] || 'Ссылка на объект другой клиники запрещена', code: error.code });
}

/** Validate JSON-stored treatment-plan references before CRM routes persist them. */
async function guardTreatmentPlanReferences(req: AuthRequest, res: Response): Promise<boolean> {
  if (req.user?.role === 'SUPERADMIN') return true;
  const clinicId = effectiveClinicId(req.user);
  if (!clinicId) return true;
  const path = String(req.path || '');
  try {
    if (req.method === 'POST' && path === '/treatment-plans') {
      const doctorId = typeof req.body?.doctorId === 'string' ? req.body.doctorId : null;
      await assertTreatmentPlanDoctorInClinic(doctorId, clinicId);
    }
    const stagePath = req.method === 'PATCH' ? path.match(/^\/treatment-plans\/([^/]+)\/stages\/[^/]+$/) : null;
    if (stagePath) {
      // Resolve the patient from the stored, clinic-scoped plan. Never trust a
      // client-supplied patientId when validating linked appointment/invoice IDs.
      const plan = await prisma.treatmentPlan.findFirst({
        where: { id: stagePath[1], patient: { clinicId } },
        select: { id: true, patientId: true },
      });
      if (!plan) {
        applyCorsHeaders(req, res);
        res.status(404).json({ ok: false, error: 'План лечения не найден', code: 'TREATMENT_PLAN_NOT_FOUND' });
        return false;
      }
      const appointmentId = typeof req.body?.appointmentId === 'string' ? req.body.appointmentId : null;
      const invoiceId = typeof req.body?.invoiceId === 'string' ? req.body.invoiceId : null;
      await assertTreatmentPlanReferencesInClinic(clinicId, { patientId: plan.patientId, appointmentId, invoiceId });
    }
    return true;
  } catch (error) {
    if (error instanceof TreatmentPlanReferenceError) {
      sendTreatmentPlanReferenceError(req, res, error);
      return false;
    }
    console.error('[planGate] treatment plan reference validation failed', error);
    applyCorsHeaders(req, res);
    res.status(503).json({ ok: false, error: 'Не удалось проверить принадлежность объекта клинике. Повторите запрос.', code: 'CLINIC_REFERENCE_VALIDATION_UNAVAILABLE' });
    return false;
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
    applyCorsHeaders(req, res);
    return res.status(503).json({
      ok: false,
      error: 'Не удалось подтвердить доступ клиники. Повторите запрос.',
      code: 'CLINIC_ACCESS_VALIDATION_UNAVAILABLE',
    });
  }
}

export async function requireClinicWritable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = effectiveClinicId(req.user);
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' });
    const access = req.clinicAccess || await resolveClinicAccess(clinicId);
    if (!access) return res.status(403).json({ ok: false, error: 'Не удалось подтвердить доступ к клинике', code: 'CLINIC_ACCESS_UNVERIFIED' });
    req.clinicAccess = access;
    assertClinicWritable(access);
    return next();
  } catch (e) {
    if (e instanceof PlanGateError) return sendPlanError(req, res, e);
    console.error('[planGate] requireClinicWritable', e);
    return res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
  }
}

/** Block mutating HTTP methods when subscription is expired (reads stay open). */
export async function blockClinicWrites(req: AuthRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const cid = effectiveClinicId(req.user);
  // This middleware is also mounted on multi-tenant routers. Partner workspaces
  // without a clinic subscription are left to their own authorization checks.
  if (!cid) return next();
  if (!req.clinicAccess) {
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
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === 'SUPERADMIN' || req.user?.isGuest) return next();
    const clinicId = effectiveClinicId(req.user);
    if (!clinicId) return next();
    try {
      const access = req.clinicAccess || await resolveClinicAccess(clinicId);
      if (!access) return res.status(503).json({ ok: false, error: 'Не удалось подтвердить доступ к клинике', code: 'CLINIC_ACCESS_UNVERIFIED' });
      req.clinicAccess = access;
      const readOnlyRequest = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
      if (access.expired && access.status === 'expired' && access.active && readOnlyRequest) return next();
      if (access.writeBlocked) assertClinicWritable(access);
      assertFeature(access, feature);
      return next();
    } catch (e) {
      if (e instanceof PlanGateError) return sendPlanError(req, res, e);
      console.error('[planGate] requirePlanFeature', e);
      return res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
    }
  };
}

export async function guardPatientCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = effectiveClinicId(req.user);
    if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId));
    if (!access) return next();
    req.clinicAccess = access;
    assertPatientSlot(access);
    next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function guardUserCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = String(req.params.id || effectiveClinicId(req.user) || '');
    if (!clinicId) return next();
    const access = await resolveClinicAccess(clinicId);
    if (!access) return next();
    req.clinicAccess = access;
    assertUserSlot(access);
    next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function guardAiAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'SUPERADMIN') return next();
    if (req.user?.isGuest || !req.user?.id) return next();
    const clinicId = effectiveClinicId(req.user);
    if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId));
    if (!access) return res.status(503).json({ ok: false, error: 'Не удалось подтвердить доступ к клинике', code: 'CLINIC_ACCESS_UNVERIFIED' });
    req.clinicAccess = access;
    const method = req.method.toUpperCase();
    if (access.expired && access.status === 'expired' && access.active && ['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
    if (access.writeBlocked) assertClinicWritable(access);
    if (process.env.DEMO_CLINIC_ID && clinicId === process.env.DEMO_CLINIC_ID) return next();
    if (String(access.clinicPlan || '').toUpperCase() === 'DEMO' && !access.writeBlocked) return next();
    const path = String(req.path || req.url || '');
    const softRead = method === 'GET' && (/proactive|threads|history|digital-twin|briefing|memory/i.test(path));
    if (softRead) return next();
    if (method === 'GET' || method === 'HEAD') assertFeature(access, 'ai');
    else assertAiAllowed(access);
    next();
  } catch (e) { return sendPlanError(req, res, e); }
}

export async function guardAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'SUPERADMIN') return next();
    const clinicId = effectiveClinicId(req.user);
    if (!clinicId) return next();
    const access = req.clinicAccess || (await resolveClinicAccess(clinicId));
    if (!access) return res.status(503).json({ ok: false, error: 'Не удалось подтвердить доступ к клинике', code: 'CLINIC_ACCESS_UNVERIFIED' });
    req.clinicAccess = access;
    const readOnlyRequest = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
    if (access.expired && access.status === 'expired' && access.active && readOnlyRequest) return next();
    if (access.writeBlocked) assertClinicWritable(access);
    assertFeature(access, 'analytics');
    next();
  } catch (e) {
    if (e instanceof PlanGateError) return sendPlanError(req, res, e);
    console.error('[planGate] guardAnalytics', e);
    return res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
  }
}

export { sendPlanError, PlanGateError };
