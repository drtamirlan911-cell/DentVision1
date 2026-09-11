import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { optionalAuth } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { loadClinicAccess } from '../../middleware/planGate.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import * as svc from './diagnostics.service.js';
import { uid } from '../../lib/helpers.js';
import prisma from '../../lib/prisma.js';
import { assertOrgAccess } from '../../lib/orgContext.js';
import { IinValidationError } from '../../lib/patientIin.js';

// C3: Verify user has clinic membership for the referral's clinic
/**
 * Referral access guard. `includeCenterLab` additionally admits staff of the
 * referral's executing DiagnosticCenter/Laboratory — required for the
 * "inbox" side of the flow (view/status/files/comments/AI-draft); the
 * referring-clinic-only variant stays reserved for actions that belong to the
 * referring side alone (delete, final sign-off into the patient's card).
 */
export function requireReferralAccess(includeCenterLab = false) {
  return async (req: AuthRequest, res: any, next: any) => {
    try {
      const id = req.params.id || req.body?.referralId;
      if (!id) return res.status(400).json({ ok: false, error: 'Referral ID required' });
      const referral = await (prisma as any).referral.findUnique({
        where: { id },
        select: { clinicId: true, doctorId: true, centerId: true, labId: true },
      });
      if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' });

      if (referral.doctorId === req.user!.id) return next();
      if (await assertOrgAccess(req.user!, referral.clinicId)) return next();
      if (includeCenterLab) {
        if (referral.centerId && hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', referral.centerId)) return next();
        if (referral.labId && hasOrgAccess(req.user, 'LABORATORY', referral.labId)) return next();
      }
      return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' });
    } catch {
      res.status(500).json({ ok: false, error: 'Access check failed' });
    }
  };
}

/**
 * Authorization for GET /referrals (the list/"inbox" query). Without this,
 * listReferrals({}) with no recognized filter returns every referral on the
 * platform — patient names, IINs, diagnoses — to any authenticated caller,
 * and an explicit clinicId/centerId/labId could belong to a tenant the
 * caller has nothing to do with. Every non-superadmin query must be scoped
 * to a tenant the caller is actually a member of.
 */
export async function authorizeReferralListScope(
  user: AuthRequest['user'],
  scope: { clinicId?: string; centerId?: string; labId?: string },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (user?.role === 'SUPERADMIN') return { ok: true };
  const { clinicId, centerId, labId } = scope;
  if (!clinicId && !centerId && !labId) {
    return { ok: false, status: 400, error: 'Укажите clinicId, centerId или labId' };
  }
  if (centerId && !hasOrgAccess(user, 'DIAGNOSTIC_CENTER', centerId)) {
    return { ok: false, status: 403, error: 'Нет доступа к центру' };
  }
  if (labId && !hasOrgAccess(user, 'LABORATORY', labId)) {
    return { ok: false, status: 403, error: 'Нет доступа к лаборатории' };
  }
  if (clinicId && !centerId && !labId) {
    if (!(await assertOrgAccess(user!, clinicId))) return { ok: false, status: 403, error: 'Нет доступа к клинике' };
  }
  return { ok: true };
}

export const diagnosticsRouter = Router();

// Public registration request (must be before authenticate middleware).
// optionalAuth captures the logged-in applicant (so access is granted on approve).
diagnosticsRouter.post('/register', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const data = await svc.createRegistrationRequest({ ...req.body, userId: (req.user as any)?.id });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// All routes below require authentication
diagnosticsRouter.use(authenticate);

// ─── Centers ───

diagnosticsRouter.get('/centers', async (req: AuthRequest, res) => {
  try {
    const { search, city } = req.query as any;
    const data = await svc.listCenters(search, city);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/centers/:id', async (req: AuthRequest, res) => {
  try {
    const data = await svc.getCenter(req.params.id as string);
    if (!data) return res.status(404).json({ ok: false, error: 'Center not found' } satisfies ApiResponse);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// Self-service organization onboarding: an authenticated participant creates
// their diagnostic center and becomes its owner immediately. Verification and
// regulated-operation gates remain separate from account/org creation.
diagnosticsRouter.post('/centers', async (req: AuthRequest, res) => {
  try {
    const { name, city, address, phone, email } = req.body as {
      name?: string; city?: string; address?: string; phone?: string; email?: string;
    };
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return res.status(400).json({ ok: false, error: 'Название диагностического центра обязательно' });

    const data = await svc.createCenter({
      name: normalizedName,
      city: city ? String(city).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
    });
    const ownerGranted = await svc.grantDiagnosticsAccess('DiagnosticCenter', data.id, req.user!.id, 'owner');
    if (!ownerGranted) return res.status(500).json({ ok: false, error: 'Не удалось назначить владельца центра' });

    return res.status(201).json({
      ok: true,
      data: { entity: data, organizationType: 'DIAGNOSTIC_CENTER', organizationId: data.id, role: 'owner', verification: 'PENDING' },
    } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/centers/:id', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.updateCenter(req.params.id as string, req.body);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Laboratories ───

diagnosticsRouter.get('/laboratories', async (req: AuthRequest, res) => {
  try {
    const { search } = req.query as any;
    const data = await svc.listLaboratories(search);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/laboratories/:id', async (req: AuthRequest, res) => {
  try {
    const data = await svc.getLaboratory(req.params.id as string);
    if (!data) return res.status(404).json({ ok: false, error: 'Laboratory not found' } satisfies ApiResponse);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// Self-service organization onboarding for dental laboratories. The owner is
// linked at creation time; DentVision administration is not required.
diagnosticsRouter.post('/laboratories', async (req: AuthRequest, res) => {
  try {
    const { name, city, address, phone, email } = req.body as {
      name?: string; city?: string; address?: string; phone?: string; email?: string;
    };
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return res.status(400).json({ ok: false, error: 'Название лаборатории обязательно' });

    const data = await svc.createLaboratory({
      name: normalizedName,
      city: city ? String(city).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
    });
    const ownerGranted = await svc.grantDiagnosticsAccess('Laboratory', data.id, req.user!.id, 'owner');
    if (!ownerGranted) return res.status(500).json({ ok: false, error: 'Не удалось назначить владельца лаборатории' });

    return res.status(201).json({
      ok: true,
      data: { entity: data, organizationType: 'LABORATORY', organizationId: data.id, role: 'owner', verification: 'PENDING' },
    } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/laboratories/:id', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.updateLaboratory(req.params.id as string, req.body);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/registrations', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string;
    const data = await svc.listRegistrationRequests(status);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/registrations/:id/approve', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.approveRegistrationRequest(req.params.id as string, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/registrations/:id/reject', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const data = await svc.rejectRegistrationRequest(req.params.id as string, req.user!.id, reason);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Seed test data (superadmin only) ───

diagnosticsRouter.post('/seed-test-data', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const data = await svc.seedTestData();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Studies ───

diagnosticsRouter.get('/studies', async (req: AuthRequest, res) => {
  try {
    const { centerId, category } = req.query as any;
    const data = await svc.listStudies(centerId, category);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});