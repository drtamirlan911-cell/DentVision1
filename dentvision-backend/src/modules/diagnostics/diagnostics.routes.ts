import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { loadClinicAccess } from '../../middleware/planGate.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import * as svc from './diagnostics.service.js';
import { uid } from '../../lib/helpers.js';
import prisma from '../../lib/prisma.js';
import { assertOrgAccess } from '../../lib/orgContext.js';
import { IinValidationError } from '../../lib/patientIin.js';

/** Atomically claims an unpaid referral so concurrent payment handlers cannot double-settle it. */
export async function claimReferralPaid(referralId: string, data: { paid: boolean }): Promise<boolean> {
  const result = await (prisma as any).referral.updateMany({
    where: { id: referralId, paid: false },
    data,
  });
  return result.count === 1;
}

function sameOrgContext(user: AuthRequest['user'], type: 'DiagnosticCenter' | 'Laboratory', id: string): boolean {
  if (!user || !id) return false;
  if (user.role === 'SUPERADMIN') return true;
  const expected = type === 'DiagnosticCenter' ? 'DIAGNOSTIC_CENTER' : 'LABORATORY';
  return user.organizationId === id && (user as any).organizationType === expected;
}

/**
 * Referral access guard. `includeCenterLab` additionally admits staff of the
 * referral's executing DiagnosticCenter/Laboratory.
 */
export function requireReferralAccess(includeCenterLab = false) {
  return async (req: AuthRequest, res: any, next: any) => {
    try {
      const id = req.params.id || req.body?.referralId;
      if (!id) return res.status(400).json({ ok: false, error: 'Referral ID required' });
      const referral = await (prisma as any).referral.findUnique({ where: { id }, select: { clinicId: true, doctorId: true, centerId: true, labId: true } });
      if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' });
      if (referral.doctorId === req.user!.id) return next();
      if (await assertOrgAccess(req.user!, referral.clinicId)) return next();
      if (includeCenterLab) {
        if (referral.centerId && sameOrgContext(req.user, 'DiagnosticCenter', referral.centerId)) return next();
        if (referral.labId && sameOrgContext(req.user, 'Laboratory', referral.labId)) return next();
      }
      return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' });
    } catch {
      return res.status(500).json({ ok: false, error: 'Access check failed' });
    }
  };
}

export async function authorizeReferralListScope(user: AuthRequest['user'], scope: { clinicId?: string; centerId?: string; labId?: string }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (user?.role === 'SUPERADMIN') return { ok: true };
  const { clinicId, centerId, labId } = scope;
  if (!clinicId && !centerId && !labId) return { ok: false, status: 400, error: 'Укажите clinicId, centerId или labId' };
  if (centerId) {
    if (!sameOrgContext(user, 'DiagnosticCenter', centerId)) return { ok: false, status: 403, error: 'Нет доступа к центру' };
  }
  if (labId) {
    if (!sameOrgContext(user, 'Laboratory', labId)) return { ok: false, status: 403, error: 'Нет доступа к лаборатории' };
  }
  if (clinicId && !centerId && !labId && !(await assertOrgAccess(user!, clinicId))) return { ok: false, status: 403, error: 'Нет доступа к клинике' };
  return { ok: true };
}

export const diagnosticsRouter = Router();
diagnosticsRouter.post('/register', optionalAuth, async (req: AuthRequest, res) => {
  try { const data = await svc.createRegistrationRequest({ ...req.body, userId: (req.user as any)?.id }); return res.json({ ok: true, data } satisfies ApiResponse); }
  catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.use(authenticate);
diagnosticsRouter.get('/centers', async (req: AuthRequest, res) => { try { const { search, city } = req.query as any; return res.json({ ok: true, data: await svc.listCenters(search, city) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/centers/:id', async (req: AuthRequest, res) => { try { const data = await svc.getCenter(req.params.id as string); if (!data) return res.status(404).json({ ok: false, error: 'Center not found' } satisfies ApiResponse); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/centers', async (req: AuthRequest, res) => { try { const { name, city, address, phone, email } = req.body as any; const normalizedName = String(name || '').trim(); if (!normalizedName) return res.status(400).json({ ok: false, error: 'Название диагностического центра обязательно' }); const data = await svc.createCenter({ name: normalizedName, city: city ? String(city).trim() : undefined, address: address ? String(address).trim() : undefined, phone: phone ? String(phone).trim() : undefined, email: email ? String(email).trim().toLowerCase() : undefined }); const ownerGranted = await svc.grantDiagnosticsAccess('DiagnosticCenter', data.id, req.user!.id, 'owner'); if (!ownerGranted) return res.status(500).json({ ok: false, error: 'Не удалось назначить владельца центра' }); return res.status(201).json({ ok: true, data: { entity: data, organizationType: 'DIAGNOSTIC_CENTER', organizationId: data.id, role: 'owner', verification: 'PENDING' } } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.patch('/centers/:id', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.updateCenter(req.params.id as string, req.body) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/laboratories', async (req: AuthRequest, res) => { try { const { search } = req.query as any; return res.json({ ok: true, data: await svc.listLaboratories(search) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/laboratories/:id', async (req: AuthRequest, res) => { try { const data = await svc.getLaboratory(req.params.id as string); if (!data) return res.status(404).json({ ok: false, error: 'Laboratory not found' } satisfies ApiResponse); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/laboratories', async (req: AuthRequest, res) => { try { const { name, city, address, phone, email } = req.body as any; const normalizedName = String(name || '').trim(); if (!normalizedName) return res.status(400).json({ ok: false, error: 'Название лаборатории обязательно' }); const data = await svc.createLaboratory({ name: normalizedName, city: city ? String(city).trim() : undefined, address: address ? String(address).trim() : undefined, phone: phone ? String(phone).trim() : undefined, email: email ? String(email).trim().toLowerCase() : undefined }); const ownerGranted = await svc.grantDiagnosticsAccess('Laboratory', data.id, req.user!.id, 'owner'); if (!ownerGranted) return res.status(500).json({ ok: false, error: 'Не удалось назначить владельца лаборатории' }); return res.status(201).json({ ok: true, data: { entity: data, organizationType: 'LABORATORY', organizationId: data.id, role: 'owner', verification: 'PENDING' } } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.patch('/laboratories/:id', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.updateLaboratory(req.params.id as string, req.body) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/registrations', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.listRegistrationRequests(req.query.status as string) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/registrations/:id/approve', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.approveRegistrationRequest(req.params.id as string, req.user!.id) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/registrations/:id/reject', requireSuperadmin, async (req: AuthRequest, res) => { try { const { reason } = req.body; return res.json({ ok: true, data: await svc.rejectRegistrationRequest(req.params.id as string, req.user!.id, reason) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/seed-test-data', requireSuperadmin, async (_req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.seedTestData() } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/studies', async (req: AuthRequest, res) => { try { const { centerId, category } = req.query as any; return res.json({ ok: true, data: await svc.listStudies(centerId, category) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });