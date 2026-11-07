import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { resolveReferralListScope } from './referral-list-scope.js';
import * as svc from './diagnostics.service.js';
import prisma from '../../lib/prisma.js';
import { assertClinicOrgAccess, assertOrgAccess, resolveClinicAccess } from '../../lib/orgContext.js';
import { resolveClinicAccess as resolveClinicSubscriptionAccess } from '../billing/planEntitlements.js';
import { IinValidationError } from '../../lib/patientIin.js';
import { canAccessReferralBranch } from '../../lib/diagnosticReferralBranchPolicy.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS, LAB_RESULT_SIGNER_ROLE_KEYS, hasScopedPartnerSignerRole } from './signingAuthorization.js';

export async function claimReferralPaid(referralId: string, data: { paid: boolean; paidAt?: Date; cost?: number }): Promise<boolean> { const result = await (prisma as any).referral.updateMany({ where: { id: referralId, paid: false }, data }); return result.count === 1; }

/**
 * Trial expiry blocks clinic-side writes to referrals, while diagnostic-center
 * and laboratory actors may still finish existing partner workflows. That
 * preserves already-ordered diagnostics and their audit trail without letting
 * the expired clinic itself create/change its business data.
 */
async function ensureClinicSubscriptionWritableIfClinicActor(req: AuthRequest, res: any, clinicId: string): Promise<boolean> {
  if (req.user?.role === 'SUPERADMIN') return true;
  try {
    const isClinicActor = await assertClinicOrgAccess(req.user!, clinicId);
    if (!isClinicActor) return true;
    const access = await resolveClinicSubscriptionAccess(clinicId);
    if (!access) {
      res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
      return false;
    }
    if (access.writeBlocked) {
      res.status(402).json({ ok: false, error: 'Клиника работает в режиме только для чтения после окончания пробного периода.', code: 'SUBSCRIPTION_EXPIRED' });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[diagnostics] clinic write gate', error);
    res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
    return false;
  }
}

function sameOrgContext(user: AuthRequest['user'], type: 'DiagnosticCenter' | 'Laboratory', id: string): boolean { if (!user || !id) return false; if (user.role === 'SUPERADMIN') return true; const expected = type === 'DiagnosticCenter' ? 'DIAGNOSTIC_CENTER' : 'LABORATORY'; const entityId = (user as any).organizationOriginalId || user.organizationId; return entityId === id && (user as any).organizationType === expected; }
function canManagePartnerBilling(user: AuthRequest['user']): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (['SUPERADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'DIRECTOR', 'CASHIER'].includes(role)) return true;
  // Partner-specific roles follow the same financial-control suffixes while
  // keeping registrars/operators out of money-state mutations.
  return /_(OWNER|ADMIN|MANAGER|DIRECTOR|CASHIER|FINANCE)$/.test(role);
}
function canManagePartnerCatalog(user: AuthRequest['user']): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (['SUPERADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(role)) return true;
  // Catalog/pricing is a privileged configuration mutation, not a cashier
  // collection action. Partner-specific cashier roles must not reach it.
  return /_(OWNER|ADMIN|MANAGER|DIRECTOR|FINANCE)$/.test(role);
}
async function referralBranchAllowed(user: AuthRequest['user'], referral: { clinicId: string; branchId?: string | null }): Promise<boolean> { if (user.role === 'SUPERADMIN') return true; return canAccessReferralBranch(user, { clinicId: referral.clinicId, branchId: referral.branchId ?? null }); }
async function referralListBranchIds(user: AuthRequest['user'], clinicId?: string): Promise<string[] | undefined> {
  if (!clinicId || user.role === 'SUPERADMIN') return undefined;
  if (!(await assertClinicOrgAccess(user, clinicId))) return undefined;
  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null }>>`
    SELECT "branch_id" FROM "clinic_members"
    WHERE "userId" = ${user.id} AND "clinicId" = ${clinicId}
    LIMIT 1
  `;
  if (!membership[0]) return [];
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    const branches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM branches WHERE clinic_id = ${clinicId} AND active = true
    `;
    return branches.map((b) => b.id);
  }
  return [...new Set([membership[0].branch_id, user.assignedBranchId, ...(user.branchIds ?? [])].filter((id): id is string => Boolean(id)))];
}
export function requireReferralAccess(includeCenterLab = false) { return async (req: AuthRequest, res: any, next: any) => { try { const id = req.params.id || req.body?.referralId; if (!id) return res.status(400).json({ ok: false, error: 'Referral ID required' }); const referral = await (prisma as any).referral.findUnique({ where: { id }, select: { clinicId: true, branchId: true, doctorId: true, centerId: true, labId: true } }); if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' }); const isWriteRequest = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase()); if (req.user!.role === 'SUPERADMIN') return next(); if (referral.doctorId === req.user!.id) { if (await referralBranchAllowed(req.user!, referral)) { if (isWriteRequest && !(await ensureClinicSubscriptionWritableIfClinicActor(req, res, referral.clinicId))) return; return next(); } return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу направления' }); } if (await assertClinicOrgAccess(req.user!, referral.clinicId)) { if (await referralBranchAllowed(req.user!, referral)) { if (isWriteRequest && !(await ensureClinicSubscriptionWritableIfClinicActor(req, res, referral.clinicId))) return; return next(); } return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу направления' }); } if (includeCenterLab) { if (referral.centerId && sameOrgContext(req.user, 'DiagnosticCenter', referral.centerId)) return next(); if (referral.labId && sameOrgContext(req.user, 'Laboratory', referral.labId)) return next(); } return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' }); } catch { return res.status(500).json({ ok: false, error: 'Access check failed' }); } }; }
export async function authorizeReferralListScope(user: AuthRequest['user'], scope: { clinicId?: string; centerId?: string; labId?: string }): Promise<{ ok: boolean; status?: number; error?: string }> { if (user?.role === 'SUPERADMIN') return { ok: true }; const { clinicId, centerId, labId } = scope; if (!clinicId && !centerId && !labId) return { ok: false, status: 400, error: 'Укажите clinicId, centerId или labId' }; if (centerId && !sameOrgContext(user, 'DiagnosticCenter', centerId)) return { ok: false, status: 403, error: 'Нет доступа к центру' }; if (labId && !sameOrgContext(user, 'Laboratory', labId)) return { ok: false, status: 403, error: 'Нет доступа к лаборатории' }; if (clinicId && !centerId && !labId && !(await assertClinicOrgAccess(user!, clinicId))) return { ok: false, status: 403, error: 'Нет доступа к клинике' }; return { ok: true }; }
async function patientBelongsToClinic(patientId: string | undefined, clinicId: string): Promise<boolean> { if (!patientId) return true; const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } }); return !!patient && patient.clinicId === clinicId; }
async function patientBranch(patientId: string | undefined, clinicId: string): Promise<string | null> { if (!patientId) return null; const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true, branchId: true } }); return patient?.clinicId === clinicId ? patient.branchId : null; }
export const diagnosticsRouter = Router();
diagnosticsRouter.post('/register', optionalAuth, async (req: AuthRequest, res) => { try { const data = await svc.createRegistrationRequest({ ...req.body, userId: (req.user as any)?.id }); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.use(authenticate);

diagnosticsRouter.get('/stats', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    // Reuse the canonical diagnostics dashboard read model so the platform view
    // includes pending/completed/overdue and recent referrals, not just totals.
    const [base, groups] = await Promise.all([
      svc.getDashboardStats({}),
      prisma.referral.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const byStatus = groups.reduce<Record<string, number>>((result, group) => {
      result[String(group.status).toUpperCase()] = group._count._all;
      return result;
    }, {});
    return res.json({ ok: true, data: { ...base, byStatus } } satisfies ApiResponse);
  } catch (error) {
    console.error('[diagnostics/stats]', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить статистику диагностики' } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/commission-rules', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const rules = await prisma.commissionRule.findMany({ where: { domain: 'diagnostics' }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    return res.json({ ok: true, data: rules } satisfies ApiResponse);
  } catch (error) {
    console.error('[diagnostics/commission-rules:list]', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить правила комиссий' } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/commission-rules', requireSuperadmin, async (req: AuthRequest, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const centerId = typeof body.centerId === 'string' ? body.centerId.trim() : '';
  const labId = typeof body.labId === 'string' ? body.labId.trim() : '';
  if ((body.centerId !== undefined && body.centerId !== null && typeof body.centerId !== 'string') || (body.labId !== undefined && body.labId !== null && typeof body.labId !== 'string')) {
    return res.status(400).json({ ok: false, error: 'centerId и labId должны быть строками' } satisfies ApiResponse);
  }
  if (centerId && labId) return res.status(400).json({ ok: false, error: 'Укажите либо центр, либо лабораторию, но не оба сразу' } satisfies ApiResponse);
  if (!(typeof body.percentBps === 'number' || (typeof body.percentBps === 'string' && body.percentBps.trim().length > 0))) {
    return res.status(400).json({ ok: false, error: 'percentBps должен быть целым числом от 0 до 10000' } satisfies ApiResponse);
  }
  const percentBps = Number(body.percentBps);
  if (!Number.isInteger(percentBps) || percentBps < 0 || percentBps > 10_000) return res.status(400).json({ ok: false, error: 'percentBps должен быть целым числом от 0 до 10000' } satisfies ApiResponse);
  if (body.description !== undefined && typeof body.description !== 'string') return res.status(400).json({ ok: false, error: 'description должен быть строкой' } satisfies ApiResponse);
  const splitJson = { description: typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '' };
  const scopeId = centerId || labId || null;
  try {
    if (centerId && !(await prisma.diagnosticCenter.findUnique({ where: { id: centerId }, select: { id: true } }))) return res.status(404).json({ ok: false, error: 'Диагностический центр не найден' } satisfies ApiResponse);
    if (labId && !(await prisma.laboratory.findUnique({ where: { id: labId }, select: { id: true } }))) return res.status(404).json({ ok: false, error: 'Лаборатория не найдена' } satisfies ApiResponse);
    const rule = await prisma.$transaction(async (tx) => {
      let savedRule;
      if (scopeId !== null) {
        savedRule = await tx.commissionRule.upsert({ where: { domain_scopeId: { domain: 'diagnostics', scopeId } },
          update: { percentBps, splitJson }, create: { domain: 'diagnostics', scopeId, percentBps, splitJson } });
      } else {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('commission-rules:diagnostics:global'))`;
        const current = await tx.commissionRule.findFirst({ where: { domain: 'diagnostics', scopeId: null }, orderBy: { createdAt: 'desc' } });
        savedRule = current
          ? await tx.commissionRule.update({ where: { id: current.id }, data: { percentBps, splitJson } })
          : await tx.commissionRule.create({ data: { domain: 'diagnostics', scopeId: null, percentBps, splitJson } });
      }
      await auditFromReq(req, { action: 'diagnostics.commission_rule.upsert', entity: 'commission_rule', entityId: savedRule.id }, tx);
      return savedRule;
    });
    return res.status(201).json({ ok: true, data: rule } satisfies ApiResponse);
  } catch (error) {
    console.error('[diagnostics/commission-rules:create]', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить правило комиссии' } satisfies ApiResponse);
  }
});
diagnosticsRouter.get('/centers', async (req: AuthRequest, res) => { try { const { search, city } = req.query as any; return res.json({ ok: true, data: await svc.listCenters(search, city) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/centers/:id', async (req: AuthRequest, res) => { try { const data = await svc.getCenter(req.params.id as string); if (!data) return res.status(404).json({ ok: false, error: 'Center not found' } satisfies ApiResponse); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/centers', requireSuperadmin, async (req: AuthRequest, res) => { try { const { name, city, address, phone, email } = req.body as any; const normalizedName = String(name || '').trim(); if (!normalizedName) return res.status(400).json({ ok: false, error: 'Название диагностического центра обязательно' }); const data = await svc.createCenter({ name: normalizedName, city: city ? String(city).trim() : undefined, address: address ? String(address).trim() : undefined, phone: phone ? String(phone).trim() : undefined, email: email ? String(email).trim().toLowerCase() : undefined }); const ownerGranted = await svc.grantDiagnosticsAccess('DiagnosticCenter', data.id, req.user!.id, 'owner'); if (!ownerGranted) return res.status(500).json({ ok: false, error: 'Не удалось назначить владельца центра' }); return res.status(201).json({ ok: true, data: { entity: data, organizationType: 'DIAGNOSTIC_CENTER', organizationId: data.id, role: 'owner', verification: 'PENDING' } } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.patch('/centers/:id', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.updateCenter(req.params.id as string, req.body) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/laboratories', async (req: AuthRequest, res) => { try { const { search } = req.query as any; return res.json({ ok: true, data: await svc.listLaboratories(search) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/laboratories/:id', async (req: AuthRequest, res) => { try { const data = await svc.getLaboratory(req.params.id as string); if (!data) return res.status(404).json({ ok: false, error: 'Laboratory not found' } satisfies ApiResponse); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/laboratories', requireSuperadmin, async (req: AuthRequest, res) => { try { const { name, city, address, phone, email } = req.body as any; const normalizedName = String(name || '').trim(); if (!normalizedName) return res.status(400).json({ ok: false, error: 'Название лаборатории обязательно' }); const data = await svc.createLaboratory({ name: normalizedName, city: city ? String(city).trim() : undefined, address: address ? String(address).trim() : undefined, phone: phone ? String(phone).trim() : undefined, email: email ? String(email).trim().toLowerCase() : undefined }); const ownerGranted = await svc.grantDiagnosticsAccess('Laboratory', data.id, req.user!.id, 'owner'); if (!ownerGranted) return res.status(500).json({ ok: false, error: 'Не удалось назначить владельца лаборатории' }); return res.status(201).json({ ok: true, data: { entity: data, organizationType: 'LABORATORY', organizationId: data.id, role: 'owner', verification: 'PENDING' } } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.patch('/laboratories/:id', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.updateLaboratory(req.params.id as string, req.body) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/registrations', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.listRegistrationRequests(req.query.status as string) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/registrations/:id/approve', requireSuperadmin, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.approveRegistrationRequest(req.params.id as string, req.user!.id) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/registrations/:id/reject', requireSuperadmin, async (req: AuthRequest, res) => { try { const { reason } = req.body; return res.json({ ok: true, data: await svc.rejectRegistrationRequest(req.params.id as string, req.user!.id, reason) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/seed-test-data', requireSuperadmin, async (_req: AuthRequest, res) => { try { return res.json({ ok: true, data: await svc.seedTestData() } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/studies', async (req: AuthRequest, res) => {
  try {
    const { centerId, category } = req.query as any;
    if (centerId) {
      const centerIdValue = String(centerId);
      const center = await svc.getCenter(centerIdValue);
      if (!center) return res.status(404).json({ ok: false, error: 'Diagnostic center not found' } satisfies ApiResponse);
      if (!sameOrgContext(req.user, 'DiagnosticCenter', centerIdValue)) {
        const clinicAccess = await assertOrgAccess(req.user!, centerIdValue).catch(() => false);
        if (!clinicAccess) return res.status(403).json({ ok: false, error: 'Нет доступа к диагностическому центру' } satisfies ApiResponse);
      }
    }
    return res.json({ ok: true, data: await svc.listStudies(centerId, category) } satisfies ApiResponse);
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.get('/lab-tests', async (req: AuthRequest, res) => {
  try {
    const { labId, category } = req.query as any;
    if (labId) {
      const labIdValue = String(labId);
      const lab = await svc.getLaboratory(labIdValue);
      if (!lab) return res.status(404).json({ ok: false, error: 'Laboratory not found' } satisfies ApiResponse);
      if (!sameOrgContext(req.user, 'Laboratory', labIdValue)) {
        const clinicAccess = await assertOrgAccess(req.user!, labIdValue).catch(() => false);
        if (!clinicAccess) return res.status(403).json({ ok: false, error: 'Нет доступа к лаборатории' } satisfies ApiResponse);
      }
    }
    return res.json({ ok: true, data: await svc.listLabTests(labId, category) } satisfies ApiResponse);
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
// Diagnostic-center / laboratory service management. These endpoints are scoped
// to the active partner organization; they never accept an arbitrary org id.
diagnosticsRouter.patch('/centers/:id/pricing', async (req: AuthRequest, res) => {
  try {
    if (!sameOrgContext(req.user, 'DiagnosticCenter', req.params.id)) return res.status(403).json({ ok: false, error: 'Нет доступа к центру' });
    if (!canManagePartnerCatalog(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
    const studies = Array.isArray(req.body?.studies) ? req.body.studies : [];
    const ids = studies.map((x: any) => String(x?.id || '')).filter(Boolean);
    if (!ids.length) return res.json({ ok: true, data: [] } satisfies ApiResponse);
    const owned = await prisma.diagnosticStudy.findMany({ where: { id: { in: ids }, centerId: req.params.id }, select: { id: true } });
    if (owned.length !== ids.length) return res.status(403).json({ ok: false, error: 'Нет доступа к одной или нескольким услугам' });
    await prisma.$transaction(studies.map((x: any) => prisma.diagnosticStudy.update({
      where: { id: String(x.id) }, data: { price: Number(x.price) >= 0 ? Number(x.price) : 0 },
    })));
    return res.json({ ok: true, data: await svc.listStudies(req.params.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.post('/centers/:id/pricing', async (req: AuthRequest, res) => {
  try {
    if (!sameOrgContext(req.user, 'DiagnosticCenter', req.params.id)) return res.status(403).json({ ok: false, error: 'Нет доступа к центру' });
    if (!canManagePartnerCatalog(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || '').toUpperCase();
    if (!name || !category) return res.status(400).json({ ok: false, error: 'Название и категория обязательны' });
    const data = await prisma.diagnosticStudy.create({ data: { centerId: req.params.id, name, category: category as any, price: Number(req.body?.price) >= 0 ? Number(req.body.price) : 0, description: req.body?.description ? String(req.body.description) : undefined, durationMin: Number.isFinite(Number(req.body?.durationMin)) ? Number(req.body.durationMin) : undefined } });
    return res.status(201).json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.patch('/laboratories/:id/pricing', async (req: AuthRequest, res) => {
  try {
    if (!sameOrgContext(req.user, 'Laboratory', req.params.id)) return res.status(403).json({ ok: false, error: 'Нет доступа к лаборатории' });
    if (!canManagePartnerCatalog(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
    const tests = Array.isArray(req.body?.tests) ? req.body.tests : [];
    const ids = tests.map((x: any) => String(x?.id || '')).filter(Boolean);
    if (!ids.length) return res.json({ ok: true, data: [] } satisfies ApiResponse);
    const owned = await prisma.laboratoryTest.findMany({ where: { id: { in: ids }, labId: req.params.id }, select: { id: true } });
    if (owned.length !== ids.length) return res.status(403).json({ ok: false, error: 'Нет доступа к одному или нескольким анализам' });
    await prisma.$transaction(tests.map((x: any) => prisma.laboratoryTest.update({
      where: { id: String(x.id) }, data: { price: Number(x.price) >= 0 ? Number(x.price) : 0 },
    })));
    return res.json({ ok: true, data: await svc.listLabTests(req.params.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.post('/laboratories/:id/pricing', async (req: AuthRequest, res) => {
  try {
    if (!sameOrgContext(req.user, 'Laboratory', req.params.id)) return res.status(403).json({ ok: false, error: 'Нет доступа к лаборатории' });
    if (!canManagePartnerCatalog(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || '').toUpperCase();
    if (!name || !category) return res.status(400).json({ ok: false, error: 'Название и категория обязательны' });
    const data = await prisma.laboratoryTest.create({ data: { labId: req.params.id, name, category: category as any, price: Number(req.body?.price) >= 0 ? Number(req.body.price) : 0 } });
    return res.status(201).json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.get('/referrals', async (req: AuthRequest, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const scope = resolveReferralListScope(req.user, {
      clinicId: q.clinicId,
      centerId: q.centerId,
      labId: q.labId,
    });
    const access = await authorizeReferralListScope(req.user, scope);
    if (access.ok === false) return res.status(access.status || 403).json({ ok: false, error: access.error || 'Нет доступа' });
    const branchIds = await referralListBranchIds(req.user, scope.clinicId);
    if (scope.clinicId && branchIds && branchIds.length === 0) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалам клиники' });
    const data = await svc.listReferrals({
      clinicId: scope.clinicId,
      centerId: scope.centerId,
      labId: scope.labId,
      doctorId: q.doctorId,
      status: q.status,
      patientId: q.patientId,
      search: q.search,
      branchIds,
      limit: q.limit ? Math.min(Number(q.limit) || 50, 100) : 50,
      offset: q.offset ? Math.max(Number(q.offset) || 0, 0) : 0,
    });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});
diagnosticsRouter.post('/referrals', async (req: AuthRequest, res) => { try { const body = req.body as any; const clinicId = String(body.clinicId || '').trim(); if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId обязателен' }); if (!(await assertClinicOrgAccess(req.user!, clinicId))) return res.status(403).json({ ok: false, error: 'Нет доступа к клинике' }); if (!(await ensureClinicSubscriptionWritableIfClinicActor(req, res, clinicId))) return; if (!(await patientBelongsToClinic(body.patientId, clinicId))) return res.status(403).json({ ok: false, error: 'Пациент не относится к выбранной клинике' }); const targetBranchId = body.branchId ? String(body.branchId) : await patientBranch(body.patientId, clinicId); if (!targetBranchId) return res.status(403).json({ ok: false, error: 'Для направления не определён филиал' }); if (!(await referralBranchAllowed(req.user!, { clinicId, branchId: targetBranchId }))) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу направления' }); let doctorId = req.user!.id; if (body.doctorId && body.doctorId !== req.user!.id) { const candidateDoctorId = String(body.doctorId); const doctorAccess = await resolveClinicAccess(candidateDoctorId, clinicId); if (!doctorAccess || !['DOCTOR', 'OWNER', 'DIRECTOR'].includes(doctorAccess.role)) return res.status(403).json({ ok: false, error: 'Указанный врач не имеет клинической роли в выбранной клинике' }); doctorId = candidateDoctorId; } if (body.centerId) { const center = await svc.getCenter(String(body.centerId)); if (!center) return res.status(404).json({ ok: false, error: 'Диагностический центр не найден' }); } if (body.labId) { const lab = await svc.getLaboratory(String(body.labId)); if (!lab) return res.status(404).json({ ok: false, error: 'Лаборатория не найдена' }); } const data = { ...body, clinicId, branchId: targetBranchId, doctorId }; delete data.id; delete data.status; delete data.cost; delete data.platformFee; delete data.paid; delete data.paidAt; delete data.settlementId; const referral = await svc.createReferral(data, req.user!.id); return res.status(201).json({ ok: true, data: referral } satisfies ApiResponse); } catch (e: any) { if (e instanceof IinValidationError) return res.status(400).json({ ok: false, error: e.message }); return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/referrals/:id', requireReferralAccess(true), async (req: AuthRequest, res) => { try { const data = await svc.getReferral(req.params.id); if (!data) return res.status(404).json({ ok: false, error: 'Referral not found' }); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.patch('/referrals/:id', requireReferralAccess(), async (req: AuthRequest, res) => { try { const allowed = ['patientName','patientIin','patientBirth','patientGender','patientPhone','patientEmail','pregnancy','allergies','specialNotes','category','studyType','anatomicalSites','complaints','preliminaryDx','studyGoal','commentForDoctor','commentForLab','priority','centerId','labId','scheduledDate','scheduledTime']; const data: Record<string, unknown> = {}; for (const key of allowed) if (key in req.body) data[key] = req.body[key]; if (data.centerId) { const center = await svc.getCenter(String(data.centerId)); if (!center) return res.status(404).json({ ok: false, error: 'Диагностический центр не найден' }); } if (data.labId) { const lab = await svc.getLaboratory(String(data.labId)); if (!lab) return res.status(404).json({ ok: false, error: 'Лаборатория не найдена' }); } return res.json({ ok: true, data: await svc.updateReferral(req.params.id, data, req.user!.id) } satisfies ApiResponse); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/referrals/:id/status', requireReferralAccess(true), async (req: AuthRequest, res) => { try { const status = String(req.body?.status || '').toUpperCase(); const allowed = ['DRAFT','SENT','ACCEPTED','SCHEDULED','PATIENT_ARRIVED','IN_PROGRESS','COMPLETED','REVIEWED','DELIVERED','CLOSED','CANCELLED']; if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Недопустимый статус направления' }); const data = await svc.changeReferralStatus(req.params.id, status as any, req.user!.id, req.body?.reason, req.body?.cost); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });

// Cashier collection is a money-state transition, not a referral status.
// Keep it separate from /status so COMPLETED and PAID cannot be conflated.
diagnosticsRouter.post('/referrals/:id/mark-paid', requireReferralAccess(true), async (req: AuthRequest, res: any) => {
  try {
    if (!canManagePartnerBilling(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' });
    const cost = req.body?.cost === undefined ? undefined : Number(req.body.cost);
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) return res.status(400).json({ ok: false, error: 'Некорректная стоимость' });
    const won = await claimReferralPaid(req.params.id, { paid: true, paidAt: new Date(), ...(cost !== undefined ? { cost } : {}),  });
    if (!won) return res.status(409).json({ ok: false, error: 'Направление уже оплачено' });
    const data = await prisma.referral.findUnique({ where: { id: req.params.id } });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.post('/centers/:id/cashier/collect', async (req: AuthRequest, res: any) => {
  try {
    if (!sameOrgContext(req.user, 'DiagnosticCenter', req.params.id)) return res.status(403).json({ ok: false, error: 'Нет доступа к центру' });
    if (!canManagePartnerBilling(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' });
    const referralId = String(req.body?.referralId || '');
    const cost = Number(req.body?.cost);
    const platformFee = undefined;
    if (!referralId || !Number.isFinite(cost) || cost <= 0) return res.status(400).json({ ok: false, error: 'Некорректные данные оплаты' });
    const referral = await prisma.referral.findUnique({ where: { id: referralId }, select: { id: true, centerId: true, labId: true } });
    if (!referral || referral.centerId !== req.params.id) return res.status(404).json({ ok: false, error: 'Направление центра не найдено' });
    const claimed = await prisma.referral.updateMany({ where: { id: referralId, paid: false }, data: { cost, paid: true, paidAt: new Date() } });
    if (claimed.count !== 1) return res.status(409).json({ ok: false, error: 'Направление уже оплачено' });
    return res.json({ ok: true, data: await prisma.referral.findUnique({ where: { id: referralId } }) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.post('/laboratories/:id/cashier/collect', async (req: AuthRequest, res: any) => {
  try {
    if (!sameOrgContext(req.user, 'Laboratory', req.params.id)) return res.status(403).json({ ok: false, error: 'Нет доступа к лаборатории' });
    if (!canManagePartnerBilling(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' });
    const referralId = String(req.body?.referralId || '');
    const cost = Number(req.body?.cost);
    if (!referralId || !Number.isFinite(cost) || cost <= 0) return res.status(400).json({ ok: false, error: 'Некорректные данные оплаты' });
    const referral = await prisma.referral.findUnique({ where: { id: referralId }, select: { id: true, labId: true } });
    if (!referral || referral.labId !== req.params.id) return res.status(404).json({ ok: false, error: 'Направление лаборатории не найдено' });
    const claimed = await prisma.referral.updateMany({ where: { id: referralId, paid: false }, data: { cost, paid: true, paidAt: new Date() } });
    if (claimed.count !== 1) return res.status(409).json({ ok: false, error: 'Направление уже оплачено' });
    return res.json({ ok: true, data: await prisma.referral.findUnique({ where: { id: referralId } }) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});
diagnosticsRouter.delete('/referrals/:id', requireReferralAccess(), async (req: AuthRequest, res) => { try { await svc.deleteReferral(req.params.id, req.user!.id); return res.json({ ok: true }); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/referrals/:id/files', requireReferralAccess(true), async (req: AuthRequest, res) => { try { const { fileName, fileData, fileType, fileSize } = req.body || {}; if (!fileName || !fileData || !fileType) return res.status(400).json({ ok: false, error: 'fileName, fileData и fileType обязательны' }); const data = await svc.uploadReferralFile({ referralId: req.params.id, fileName: String(fileName), fileData: String(fileData), fileType: String(fileType), fileSize: fileSize ? Number(fileSize) : undefined, uploadedBy: req.user!.id }); return res.status(201).json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.delete('/referral-files/:id', async (req: AuthRequest, res) => { try { const file = await prisma.referralFile.findUnique({ where: { id: req.params.id }, select: { referralId: true } }); if (!file) return res.status(404).json({ ok: false, error: 'File not found' }); const access = await (async () => { const referral = await prisma.referral.findUnique({ where: { id: file.referralId }, select: { clinicId: true, branchId: true, doctorId: true, centerId: true, labId: true } }); if (!referral) return false; return referral.doctorId === req.user!.id ? await referralBranchAllowed(req.user!, referral) : (await assertClinicOrgAccess(req.user!, referral.clinicId) && await referralBranchAllowed(req.user!, referral)) || (referral.centerId ? sameOrgContext(req.user, 'DiagnosticCenter', referral.centerId) : false) || (referral.labId ? sameOrgContext(req.user, 'Laboratory', referral.labId) : false); })(); if (!access) return res.status(403).json({ ok: false, error: 'Нет доступа к файлу' }); const clinicReferral = await prisma.referral.findUnique({ where: { id: file.referralId }, select: { clinicId: true } }); if (clinicReferral && !(await ensureClinicSubscriptionWritableIfClinicActor(req, res, clinicReferral.clinicId))) return; await svc.deleteReferralFile(req.params.id, req.user!.id); return res.json({ ok: true }); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/referrals/:id/comments', requireReferralAccess(true), async (req: AuthRequest, res) => { try { const text = String(req.body?.text || '').trim(); if (!text) return res.status(400).json({ ok: false, error: 'Комментарий не может быть пустым' }); return res.status(201).json({ ok: true, data: await svc.addComment(req.params.id, req.user!.id, text) } satisfies ApiResponse); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.get('/dashboard', async (req: AuthRequest, res) => { try { const q = req.query as Record<string, string | undefined>; const scope = await authorizeReferralListScope(req.user, { clinicId: q.clinicId, centerId: q.centerId, labId: q.labId }); if (scope.ok === false) return res.status(scope.status || 403).json({ ok: false, error: scope.error || 'Нет доступа' }); return res.json({ ok: true, data: await svc.getDashboardStats({ clinicId: q.clinicId, centerId: q.centerId, labId: q.labId }) } satisfies ApiResponse); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/referrals/:id/ai-result', requireReferralAccess(), async (req: AuthRequest, res) => { try { const data = await svc.aiGenerateResult(req.params.id, req.user!.id); return res.json({ ok: true, data: { result: data, requiresDoctorConfirmation: true } } satisfies ApiResponse); } catch (e: any) { return res.status(422).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/referrals/:id/confirm-ai-result', requireReferralAccess(), async (req: AuthRequest, res) => { try { const data = await svc.confirmAiResult(req.params.id, req.user!.id); return res.json({ ok: true, data } satisfies ApiResponse); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
diagnosticsRouter.post('/referrals/:id/results/sign', requireReferralAccess(true), async (req: AuthRequest, res) => { try { const referral = await prisma.referral.findUnique({ where: { id: req.params.id }, select: { clinicId: true, doctorId: true, branchId: true, centerId: true, labId: true } }); if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' }); const clinicAccess = await referralBranchAllowed(req.user!, referral); const diagnosticPartnerAccess = referral.centerId ? sameOrgContext(req.user, 'DiagnosticCenter', referral.centerId) : false; const laboratoryPartnerAccess = referral.labId ? sameOrgContext(req.user, 'Laboratory', referral.labId) : false; const partnerAccess = diagnosticPartnerAccess || laboratoryPartnerAccess; const partnerCanSign = diagnosticPartnerAccess
      ? await hasScopedPartnerSignerRole(req.user!, DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS)
      : laboratoryPartnerAccess
        ? await hasScopedPartnerSignerRole(req.user!, LAB_RESULT_SIGNER_ROLE_KEYS)
        : false;
    if (!clinicAccess && !partnerAccess) return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' });
    if (partnerAccess && !clinicAccess && !partnerCanSign) return res.status(403).json({ ok: false, error: 'Недостаточно прав для подписания результата' }); const reportText = String(req.body?.reportText || '').trim(); if (!reportText) return res.status(400).json({ ok: false, error: 'reportText обязателен' }); const signerScope = diagnosticPartnerAccess ? 'diagnostic_center' : laboratoryPartnerAccess ? 'laboratory' : 'clinic'; const result = await svc.saveAndSignResult({ referralId: req.params.id, reportText, conclusion: req.body?.conclusion ? String(req.body.conclusion) : undefined, doctorId: req.user!.id, signerScope }); return res.json({ ok: true, data: { result, patientRecordUpdated: signerScope === 'clinic' } } satisfies ApiResponse); } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); } });
export default diagnosticsRouter;
