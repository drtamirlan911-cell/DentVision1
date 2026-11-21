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
import { assertClinicDoctorSignoff, ClinicalSignoffAuthorizationError } from './clinicalSignoffAuthorization.js';
import { authorizeDiagnosticCenterStatusTransition, canReadDiagnosticCenterClinicalDetail } from './diagnosticCenterWorkflow.js';

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
/**
 * Partner role checks must use the canonical organization-scoped PersonRole.
 * Auth middleware maps partner-only roles to the least-privileged STUDENT
 * compatibility enum, so req.user.role is not the permission source.
 */
async function activePartnerRoleKeys(user: AuthRequest['user']): Promise<string[]> {
  const organizationId = user?.organizationId;
  if (!user || !organizationId) return [];
  const memberships = await prisma.personRole.findMany({
    where: {
      scopeType: 'organization',
      scopeId: organizationId,
      person: { userId: user.id, organizationId },
    },
    select: { role: { select: { key: true } } },
  });
  return memberships.map((membership) => String(membership.role.key || '').trim().toLowerCase()).filter(Boolean);
}
function hasPartnerManagementSuffix(keys: string[], allowCashier: boolean): boolean {
  const suffix = allowCashier
    ? /(?:^|_)(OWNER|ADMIN|MANAGER|DIRECTOR|CASHIER|FINANCE)$/
    : /(?:^|_)(OWNER|ADMIN|MANAGER|DIRECTOR|FINANCE)$/;
  return keys.some((key) => suffix.test(key.toUpperCase()));
}
async function canManagePartnerBilling(user: AuthRequest['user']): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'SUPERADMIN') return true;
  return hasPartnerManagementSuffix(await activePartnerRoleKeys(user), true);
}
async function canManagePartnerCatalog(user: AuthRequest['user']): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'SUPERADMIN') return true;
  // Cashiers can collect payments but must never change the catalogue/equipment.
  return hasPartnerManagementSuffix(await activePartnerRoleKeys(user), false);
}

async function canManageDiagnosticCenterTeam(user: AuthRequest['user']): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'SUPERADMIN') return true;
  return (await activePartnerRoleKeys(user)).some((key) =>
    ['owner', 'admin', 'manager', 'director', 'diagnostic_owner', 'diagnostic_admin', 'diagnostic_manager', 'center_admin'].includes(key),
  );
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
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
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
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
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
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
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
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления услугами' });
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || '').toUpperCase();
    if (!name || !category) return res.status(400).json({ ok: false, error: 'Название и категория обязательны' });
    const data = await prisma.laboratoryTest.create({ data: { labId: req.params.id, name, category: category as any, price: Number(req.body?.price) >= 0 ? Number(req.body.price) : 0 } });
    return res.status(201).json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse); }
});

const DIAGNOSTIC_MODALITY_KINDS = new Set(['CBCT', 'OPG', 'TRG', 'INTRAORAL', 'PANORAMIC', 'CT', 'MRI', 'OTHER']);
const DIAGNOSTIC_MODALITY_STATUSES = new Set(['active', 'maintenance', 'out_of_service']);
function optionalMaintenanceDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Некорректная дата обслуживания оборудования');
  return date;
}

diagnosticsRouter.get('/centers/:id/modalities', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.id);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) return res.status(403).json({ ok: false, error: 'Нет доступа к оборудованию центра' });
    return res.json({ ok: true, data: await svc.listDiagnosticModalities(centerId) } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить оборудование центра' } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/centers/:id/modalities', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.id);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) return res.status(403).json({ ok: false, error: 'Нет доступа к оборудованию центра' });
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления оборудованием' });
    const name = String(req.body?.name || '').trim();
    const kind = String(req.body?.kind || '').trim().toUpperCase();
    const aeTitle = String(req.body?.aeTitle || '').trim().toUpperCase();
    if (name.length < 2 || name.length > 120) return res.status(400).json({ ok: false, error: 'Название оборудования должно содержать от 2 до 120 символов' });
    if (!DIAGNOSTIC_MODALITY_KINDS.has(kind)) return res.status(400).json({ ok: false, error: 'Неизвестный тип диагностического оборудования' });
    if (aeTitle && aeTitle.length > 16) return res.status(400).json({ ok: false, error: 'DICOM AE Title не должен превышать 16 символов' });
    const data = await svc.createDiagnosticModality(centerId, {
      name, kind,
      manufacturer: String(req.body?.manufacturer || '').trim() || undefined,
      model: String(req.body?.model || '').trim() || undefined,
      serialNumber: String(req.body?.serialNumber || '').trim() || undefined,
      room: String(req.body?.room || '').trim() || undefined,
      aeTitle: aeTitle || undefined,
      nextMaintenanceAt: optionalMaintenanceDate(req.body?.nextMaintenanceAt),
    });
    await auditFromReq(req, { action: 'diagnostics.modality.create', entity: 'diagnostic_modality', entityId: data.id });
    return res.status(201).json({ ok: true, data } satisfies ApiResponse);
  } catch (error: any) {
    const duplicate = String(error?.code || '') === 'P2002';
    return res.status(400).json({ ok: false, error: duplicate ? 'Оборудование с таким серийным номером уже зарегистрировано' : (error?.message || 'Не удалось добавить оборудование') } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/centers/:id/modalities/:modalityId', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.id);
    const modalityId = String(req.params.modalityId);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) return res.status(403).json({ ok: false, error: 'Нет доступа к оборудованию центра' });
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для управления оборудованием' });
    const patch: Record<string, unknown> = {};
    if ('name' in req.body) patch.name = String(req.body.name || '').trim();
    if ('kind' in req.body) patch.kind = String(req.body.kind || '').trim().toUpperCase();
    for (const key of ['manufacturer', 'model', 'serialNumber', 'room'] as const) {
      if (key in req.body) patch[key] = String(req.body[key] || '').trim() || null;
    }
    if ('aeTitle' in req.body) {
      const aeTitle = String(req.body.aeTitle || '').trim().toUpperCase();
      if (aeTitle.length > 16) return res.status(400).json({ ok: false, error: 'DICOM AE Title не должен превышать 16 символов' });
      patch.aeTitle = aeTitle || null;
    }
    if ('status' in req.body) {
      const status = String(req.body.status || '').trim();
      if (!DIAGNOSTIC_MODALITY_STATUSES.has(status)) return res.status(400).json({ ok: false, error: 'Недопустимый статус оборудования' });
      patch.status = status;
    }
    if ('lastMaintenanceAt' in req.body) patch.lastMaintenanceAt = optionalMaintenanceDate(req.body.lastMaintenanceAt);
    if ('nextMaintenanceAt' in req.body) patch.nextMaintenanceAt = optionalMaintenanceDate(req.body.nextMaintenanceAt);
    if ('kind' in patch && !DIAGNOSTIC_MODALITY_KINDS.has(String(patch.kind))) return res.status(400).json({ ok: false, error: 'Неизвестный тип диагностического оборудования' });
    if ('name' in patch && (String(patch.name).length < 2 || String(patch.name).length > 120)) return res.status(400).json({ ok: false, error: 'Некорректное название оборудования' });
    if (Object.keys(patch).length === 0) return res.status(400).json({ ok: false, error: 'Нет полей для обновления' });
    const data = await svc.updateDiagnosticModality(centerId, modalityId, patch as any);
    await auditFromReq(req, { action: 'diagnostics.modality.update', entity: 'diagnostic_modality', entityId: modalityId });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error: any) {
    const duplicate = String(error?.code || '') === 'P2002';
    return res.status(400).json({ ok: false, error: duplicate ? 'Оборудование с таким серийным номером уже зарегистрировано' : (error?.message || 'Не удалось обновить оборудование') } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/centers/:id/worklist', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.id);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) return res.status(403).json({ ok: false, error: 'Нет доступа к рабочей очереди центра' });
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const priority = req.query.priority ? String(req.query.priority).toUpperCase() : undefined;
    const allowedStatuses = new Set(['SENT', 'ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'DELIVERED']);
    const allowedPriorities = new Set(['NORMAL', 'URGENT', 'EMERGENCY']);
    if (status && !allowedStatuses.has(status)) return res.status(400).json({ ok: false, error: 'Недопустимый фильтр статуса' });
    if (priority && !allowedPriorities.has(priority)) return res.status(400).json({ ok: false, error: 'Недопустимый фильтр приоритета' });
    const search = String(req.query.search || '').trim().slice(0, 80);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const roleKeys = await activePartnerRoleKeys(req.user);
    const canReadClinical = req.user?.role === 'SUPERADMIN' || canReadDiagnosticCenterClinicalDetail(roleKeys);
    const data = await svc.getDiagnosticCenterWorklist(centerId, { status, priority, search: search || undefined, limit, offset });
    if (!canReadClinical) {
      return res.json({
        ok: true,
        data: { ...data, items: data.items.map((item: any) => ({ ...item, patientName: 'Пациент' })) },
      } satisfies ApiResponse);
    }
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить рабочую очередь центра' } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/centers/:centerId/worklist/:referralId', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.centerId);
    const referralId = String(req.params.referralId);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к карточке исследования центра' });
    }
    const roleKeys = await activePartnerRoleKeys(req.user);
    if (req.user?.role !== 'SUPERADMIN' && !canReadDiagnosticCenterClinicalDetail(roleKeys)) {
      return res.status(403).json({ ok: false, error: 'Медицинские данные направления доступны только уполномоченным клиническим сотрудникам центра.' });
    }
    const referral = await prisma.referral.findFirst({ where: { id: referralId, centerId } });
    if (!referral) return res.status(404).json({ ok: false, error: 'Исследование не найдено в очереди этого центра' });
    const [detail, events] = await Promise.all([
      svc.getReferral(referralId),
      prisma.auditLog.findMany({
        where: { entity: 'referral', entityId: referralId },
        select: { id: true, action: true, userName: true, details: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    ]);
    return res.json({ ok: true, data: { referral: detail, events } } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить карточку исследования' } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/centers/:id/worklist/staff', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.id);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к команде диагностического центра' });
    }
    if (!(await canManageDiagnosticCenterTeam(req.user))) {
      return res.status(403).json({ ok: false, error: 'Состав команды доступен только владельцу и менеджерам центра' });
    }
    const members = await prisma.diagnosticCenterMember.findMany({
      where: { centerId, role: { in: ['operator', 'radiologist', 'manager', 'admin'] } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return res.json({
      ok: true,
      data: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
      })),
    } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить команду диагностического центра' } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/assignees', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.centerId);
    const referralId = String(req.params.referralId);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к рабочей очереди центра' });
    }
    if (!(await canManageDiagnosticCenterTeam(req.user))) {
      return res.status(403).json({ ok: false, error: 'Назначать сотрудников на исследование может только владелец или менеджер центра' });
    }
    const hasOperator = Object.prototype.hasOwnProperty.call(req.body || {}, 'operatorUserId');
    const hasRadiologist = Object.prototype.hasOwnProperty.call(req.body || {}, 'radiologistUserId');
    if (!hasOperator && !hasRadiologist) {
      return res.status(400).json({ ok: false, error: 'Укажите оператора или рентгенолога для назначения' });
    }
    const operatorUserId = hasOperator && req.body.operatorUserId ? String(req.body.operatorUserId) : null;
    const radiologistUserId = hasRadiologist && req.body.radiologistUserId ? String(req.body.radiologistUserId) : null;
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ ok: false, error: 'Не найден активный контекст организации центра' });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "referrals" WHERE "id"=${referralId} AND "centerId"=${centerId} FOR UPDATE`;
      const referral = await tx.referral.findFirst({
        where: { id: referralId, centerId },
        select: { id: true, status: true, operatorId: true, radiologistId: true },
      });
      if (!referral) return { kind: 'not_found' as const };
      if (!['ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED', 'IN_PROGRESS'].includes(String(referral.status))) {
        return { kind: 'invalid_status' as const };
      }

      let operatorId = referral.operatorId;
      let radiologistId = referral.radiologistId;
      if (hasOperator) {
        if (!operatorUserId) {
          operatorId = null;
        } else {
          const member = await tx.diagnosticCenterMember.findFirst({
            where: { centerId, userId: operatorUserId, role: 'operator' },
            select: { userId: true },
          });
          const scopedRole = await tx.personRole.findFirst({
            where: {
              scopeType: 'organization',
              scopeId: organizationId,
              person: { userId: operatorUserId, organizationId },
              role: { key: { in: ['operator', 'diagnostic_operator'] } },
            },
            select: { id: true },
          });
          if (!member || !scopedRole) return { kind: 'invalid_operator' as const };
          let operator = await tx.operator.findFirst({ where: { centerId, userId: operatorUserId } });
          if (!operator) operator = await tx.operator.create({ data: { centerId, userId: operatorUserId, specialty: 'Diagnostic imaging' } });
          else if (!operator.active) operator = await tx.operator.update({ where: { id: operator.id }, data: { active: true } });
          operatorId = operator.id;
        }
      }
      if (hasRadiologist) {
        if (!radiologistUserId) {
          radiologistId = null;
        } else {
          const member = await tx.diagnosticCenterMember.findFirst({
            where: { centerId, userId: radiologistUserId, role: 'radiologist' },
            select: { userId: true },
          });
          const scopedRole = await tx.personRole.findFirst({
            where: {
              scopeType: 'organization',
              scopeId: organizationId,
              person: { userId: radiologistUserId, organizationId },
              role: { key: 'radiologist' },
            },
            select: { id: true },
          });
          if (!member || !scopedRole) return { kind: 'invalid_radiologist' as const };
          let radiologist = await tx.radiologist.findFirst({ where: { centerId, userId: radiologistUserId } });
          if (!radiologist) radiologist = await tx.radiologist.create({ data: { centerId, userId: radiologistUserId, specialty: 'Diagnostic imaging' } });
          else if (!radiologist.active) radiologist = await tx.radiologist.update({ where: { id: radiologist.id }, data: { active: true } });
          radiologistId = radiologist.id;
        }
      }

      const updated = await tx.referral.update({
        where: { id: referralId },
        data: { operatorId, radiologistId },
        select: { id: true, operatorId: true, radiologistId: true },
      });
      await auditFromReq(req, {
        action: 'diagnostics.worklist.assignees.assign',
        entity: 'referral',
        entityId: referralId,
        details: { operatorAssigned: hasOperator, radiologistAssigned: hasRadiologist },
      }, tx);
      return { kind: 'updated' as const, data: updated };
    });

    if (result.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Исследование не найдено в очереди этого центра' });
    if (result.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Назначить сотрудников можно после принятия направления и до его выдачи' });
    if (result.kind === 'invalid_operator') return res.status(400).json({ ok: false, error: 'Оператор должен быть активным сотрудником этого центра с ролью operator' });
    if (result.kind === 'invalid_radiologist') return res.status(400).json({ ok: false, error: 'Рентгенолог должен быть активным сотрудником этого центра с ролью radiologist' });
    return res.json({ ok: true, data: result.data } satisfies ApiResponse);
  } catch (error: any) {
    console.error('[diagnostics/worklist/assignees]', error);
    return res.status(400).json({ ok: false, error: error?.message || 'Не удалось назначить сотрудников' } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/modality', async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.centerId);
    const referralId = String(req.params.referralId);
    if (!sameOrgContext(req.user, 'DiagnosticCenter', centerId)) return res.status(403).json({ ok: false, error: 'Нет доступа к рабочей очереди центра' });
    if (!(await canManagePartnerCatalog(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для назначения оборудования' });
    const referral = await prisma.referral.findFirst({ where: { id: referralId, centerId }, select: { id: true } });
    if (!referral) return res.status(404).json({ ok: false, error: 'Исследование не найдено в очереди этого центра' });
    const modalityId = req.body?.modalityId ? String(req.body.modalityId) : null;
    if (modalityId) {
      const modality = await prisma.diagnosticModality.findFirst({ where: { id: modalityId, centerId, status: 'active' }, select: { id: true } });
      if (!modality) return res.status(400).json({ ok: false, error: 'Можно назначить только активное оборудование этого центра' });
    }
    await prisma.referral.update({ where: { id: referralId }, data: { modalityId } });
    await auditFromReq(req, { action: 'diagnostics.worklist.modality.assign', entity: 'referral', entityId: referralId });
    return res.json({ ok: true, data: { referralId, modalityId } } satisfies ApiResponse);
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || 'Не удалось назначить оборудование' } satisfies ApiResponse);
  }
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
diagnosticsRouter.post('/referrals/:id/status', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const status = String(req.body?.status || '').trim().toUpperCase();
    const allowed = ['DRAFT', 'SENT', 'ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'DELIVERED', 'CLOSED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Недопустимый статус направления' });

    const referral = await prisma.referral.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, centerId: true, status: true, result: { select: { signedAt: true } } },
    });
    if (!referral) return res.status(404).json({ ok: false, error: 'Направление не найдено' });

    const isCenterActor = Boolean(referral.centerId)
      && req.user?.role !== 'SUPERADMIN'
      && sameOrgContext(req.user, 'DiagnosticCenter', String(referral.centerId));
    let options: { expectedStatus?: any; scheduledDate?: Date; scheduledTime?: string; useCenterCatalogPrice?: boolean } | undefined;
    if (isCenterActor) {
      const roleKeys = await activePartnerRoleKeys(req.user);
      const decision = authorizeDiagnosticCenterStatusTransition({
        currentStatus: String(referral.status),
        nextStatus: status,
        roleKeys,
        resultSignedAt: referral.result?.signedAt,
      });
      if (!decision.allowed) {
        return res.status(decision.status).json({ ok: false, error: decision.reason, code: decision.code } satisfies ApiResponse);
      }
      options = { expectedStatus: referral.status, useCenterCatalogPrice: true };
      if (status === 'SCHEDULED') {
        const dateValue = String(req.body?.scheduledDate || '').trim();
        const timeValue = String(req.body?.scheduledTime || '').trim();
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) && !Number.isNaN(new Date(dateValue + 'T00:00:00.000Z').getTime());
        const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeValue);
        if (!validDate || !validTime) {
          return res.status(400).json({ ok: false, error: 'Для записи укажите корректную дату и время исследования.', code: 'DIAGNOSTIC_SCHEDULE_REQUIRED' } satisfies ApiResponse);
        }
        options.scheduledDate = new Date(dateValue + 'T00:00:00.000Z');
        options.scheduledTime = timeValue;
      }
    }

    const cost = req.body?.cost === undefined ? undefined : Number(req.body.cost);
    if (cost !== undefined && (!Number.isFinite(cost) || cost <= 0)) {
      return res.status(400).json({ ok: false, error: 'Стоимость исследования должна быть положительным числом.' } satisfies ApiResponse);
    }
    const data = await svc.changeReferralStatus(
      req.params.id,
      status as any,
      req.user!.id,
      req.body?.reason,
      cost,
      options,
    );
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error: any) {
    const conflict = String(error?.code || '') === 'REFERRAL_STATUS_CONFLICT';
    return res.status(conflict ? 409 : 400).json({
      ok: false,
      error: conflict ? 'Статус направления уже изменился. Обновите очередь и повторите действие.' : error.message,
      ...(conflict ? { code: 'REFERRAL_STATUS_CONFLICT' } : {}),
    } satisfies ApiResponse);
  }
});

// Cashier collection is a money-state transition, not a referral status.
// Keep it separate from /status so COMPLETED and PAID cannot be conflated.
diagnosticsRouter.post('/referrals/:id/mark-paid', requireReferralAccess(true), async (req: AuthRequest, res: any) => {
  try {
    if (!(await canManagePartnerBilling(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' });
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
    if (!(await canManagePartnerBilling(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' });
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
    if (!(await canManagePartnerBilling(req.user))) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' });
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
diagnosticsRouter.post('/referrals/:id/confirm-ai-result', requireReferralAccess(), async (req: AuthRequest, res) => {
  try {
    const referral = await prisma.referral.findUnique({ where: { id: req.params.id }, select: { clinicId: true, branchId: true, doctorId: true } });
    if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' } satisfies ApiResponse);
    await assertClinicDoctorSignoff({ userId: req.user!.id, clinicId: referral.clinicId, branchId: referral.branchId, assignedDoctorId: referral.doctorId });
    const data = await svc.confirmAiResult(req.params.id, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    if (e instanceof ClinicalSignoffAuthorizationError) return res.status(403).json({ ok: false, error: e.message } satisfies ApiResponse);
    return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});
diagnosticsRouter.post('/referrals/:id/results/sign', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const referral = await prisma.referral.findUnique({ where: { id: req.params.id }, select: { clinicId: true, doctorId: true, branchId: true, centerId: true, labId: true } });
    if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' } satisfies ApiResponse);
    // SUPERADMIN bypasses operational branch middleware, but that bypass is not
    // proof of clinical clinic membership. It may still act as a partner signer
    // only when an explicit scoped radiologist/laboratory role is present.
    const clinicAccess = req.user!.role !== 'SUPERADMIN' && await referralBranchAllowed(req.user!, referral);
    const diagnosticPartnerAccess = referral.centerId ? sameOrgContext(req.user, 'DiagnosticCenter', referral.centerId) : false;
    const laboratoryPartnerAccess = referral.labId ? sameOrgContext(req.user, 'Laboratory', referral.labId) : false;
    const partnerAccess = diagnosticPartnerAccess || laboratoryPartnerAccess;
    const partnerCanSign = diagnosticPartnerAccess
      ? await hasScopedPartnerSignerRole(req.user!, DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS)
      : laboratoryPartnerAccess
        ? await hasScopedPartnerSignerRole(req.user!, LAB_RESULT_SIGNER_ROLE_KEYS)
        : false;
    if (!clinicAccess && !partnerAccess) return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' } satisfies ApiResponse);
    if (!clinicAccess && partnerAccess && !partnerCanSign) return res.status(403).json({ ok: false, error: 'Недостаточно прав для подписания результата' } satisfies ApiResponse);

    // Prefer clinic signing only when the caller has real clinic/branch access.
    // SUPERADMIN's operational bypass is not treated as clinic membership;
    // a partner result can still be signed only with an explicit scoped partner
    // signer role and never writes a clinic Visit.
    const signerScope = clinicAccess ? 'clinic' : diagnosticPartnerAccess ? 'diagnostic_center' : 'laboratory';
    if (signerScope === 'clinic') {
      await assertClinicDoctorSignoff({ userId: req.user!.id, clinicId: referral.clinicId, branchId: referral.branchId, assignedDoctorId: referral.doctorId });
    }

    const reportText = String(req.body?.reportText || '').trim();
    if (!reportText) return res.status(400).json({ ok: false, error: 'reportText обязателен' } satisfies ApiResponse);
    const result = await svc.saveAndSignResult({
      referralId: req.params.id,
      reportText,
      conclusion: req.body?.conclusion ? String(req.body.conclusion) : undefined,
      doctorId: req.user!.id,
      signerScope,
    });
    return res.json({ ok: true, data: { result, patientRecordUpdated: signerScope === 'clinic' } } satisfies ApiResponse);
  } catch (e: any) {
    if (e instanceof ClinicalSignoffAuthorizationError) return res.status(403).json({ ok: false, error: e.message } satisfies ApiResponse);
    return res.status(400).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});
export default diagnosticsRouter;
