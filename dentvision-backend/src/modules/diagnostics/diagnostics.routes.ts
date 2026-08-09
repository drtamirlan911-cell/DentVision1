// @ts-nocheck
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

// C3: Verify user has clinic membership for the referral's clinic
/**
 * Referral access guard. `includeCenterLab` additionally admits staff of the
 * referral's executing DiagnosticCenter/Laboratory — required for the
 * "inbox" side of the flow (view/status/files/comments/AI-draft); the
 * referring-clinic-only variant stays reserved for actions that belong to
 * the referring side alone (delete, final sign-off into the patient's card).
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
    const data = await svc.getCenter(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'Center not found' } satisfies ApiResponse);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/centers', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.createCenter(req.body);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/centers/:id', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.updateCenter(req.params.id, req.body);
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
    const data = await svc.getLaboratory(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'Laboratory not found' } satisfies ApiResponse);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/laboratories', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.createLaboratory(req.body);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/laboratories/:id', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const data = await svc.updateLaboratory(req.params.id, req.body);
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
    const data = await svc.approveRegistrationRequest(req.params.id, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/registrations/:id/reject', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const data = await svc.rejectRegistrationRequest(req.params.id, req.user!.id, reason);
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

diagnosticsRouter.get('/lab-tests', async (req: AuthRequest, res) => {
  try {
    const { labId, category } = req.query as any;
    const data = await svc.listLabTests(labId, category);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Referrals ───

diagnosticsRouter.get('/referrals', loadClinicAccess, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.query.clinicId as string || req.user?.clinicId || undefined;
    const centerId = req.query.centerId as string || undefined;
    const labId = req.query.labId as string || undefined;

    const authz = await authorizeReferralListScope(req.user, { clinicId, centerId, labId });
    if (!authz.ok) return res.status(authz.status).json({ ok: false, error: authz.error } satisfies ApiResponse);

    const data = await svc.listReferrals({
      clinicId,
      doctorId: req.query.doctorId as string,
      centerId,
      labId,
      status: req.query.status as string,
      patientId: req.query.patientId as string,
      search: req.query.search as string,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    return res.json({ ok: true, ...data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/referrals/:id', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const data = await svc.getReferral(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'Referral not found' } satisfies ApiResponse);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/referrals', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.body.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    }
    if (!(await assertOrgAccess(req.user!, clinicId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к клинике' });
    }
    const userId = req.user!.id;
    const data = await svc.createReferral({ ...req.body, doctorId: userId }, userId);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/referrals/:id', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    // Whitelist: center staff can only update these fields
    const allowed = ['studyType', 'studyCategory', 'priority', 'commentForLab', 'anatomicalSites'];
    const picked: Record<string, any> = {};
    for (const k of allowed) {
      if (k in req.body) picked[k] = req.body[k];
    }
    const data = await svc.updateReferral(req.params.id, picked, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/referrals/:id/status', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const { status, reason, cost, platformFee } = req.body;
    const data = await svc.changeReferralStatus(req.params.id, status, req.user!.id, reason, cost, platformFee);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.delete('/referrals/:id', requireReferralAccess(), async (req: AuthRequest, res) => {
  try {
    await svc.deleteReferral(req.params.id, req.user!.id);
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Files ───

diagnosticsRouter.post('/files/upload', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const { referralId, fileName, fileData, fileType, fileSize } = req.body;
    if (!referralId || !fileName || !fileData) {
      return res.status(400).json({ ok: false, error: 'referralId, fileName, fileData required' } satisfies ApiResponse);
    }
    const data = await svc.uploadReferralFile({
      referralId, fileName, fileData, fileType: fileType || 'image', fileSize, uploadedBy: req.user!.id,
    });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.delete('/files/:id', async (req: AuthRequest, res, next) => {
  // Resolve referralId from file record, then check clinic access
  try {
    const file = await (prisma as any).referralFile.findUnique({ where: { id: req.params.id }, select: { referralId: true } });
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });
    req.body = { ...req.body, referralId: file.referralId };
  } catch {
    return res.status(500).json({ ok: false, error: 'File lookup failed' });
  }
  next();
}, requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    await svc.deleteReferralFile(req.params.id, req.user!.id);
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Results ───

diagnosticsRouter.post('/results/ai-generate', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const { referralId } = req.body;
    if (!referralId) return res.status(400).json({ ok: false, error: 'referralId required' } satisfies ApiResponse);
    const data = await svc.aiGenerateResult(referralId, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/results/:id/sign', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const { reportText, conclusion } = req.body;
    if (!reportText) return res.status(400).json({ ok: false, error: 'reportText required' } satisfies ApiResponse);
    const data = await svc.saveAndSignResult({
      referralId: req.params.id, reportText, conclusion, doctorId: req.user!.id,
    });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Comments ───

diagnosticsRouter.post('/referrals/:id/comments', requireReferralAccess(true), async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ ok: false, error: 'Text required' } satisfies ApiResponse);
    const data = await svc.addComment(req.params.id, req.user!.id, text);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Dashboard ───

diagnosticsRouter.get('/dashboard', loadClinicAccess, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.query.clinicId as string || req.user?.clinicId || undefined;
    const data = await svc.getDashboardStats(clinicId);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Pricing (center/lab members or superadmin) ───

function hasOrgAccess(user: any, type: string, orgId: string): boolean {
  return user?.role === 'SUPERADMIN' ||
    (user?.organizationType === type && user?.organizationId === orgId);
}

/** DB-verified: is the user a member / Person of the given center (by diagnosticCenter id)? */
async function canAccessCenter(user: any, centerId: string): Promise<boolean> {
  if (user?.role === 'SUPERADMIN') return true;
  // 1) Legacy member
  const m = await (prisma as any).diagnosticCenterMember.findFirst({
    where: { centerId, userId: user.id },
  });
  if (m) return true;
  // 2) Unified Person → Organization
  const org = await prisma.organization.findFirst({
    where: { originalType: 'DiagnosticCenter', originalId: centerId },
    select: { id: true },
  });
  if (org) {
    const p = await prisma.person.findFirst({
      where: { userId: user.id, organizationId: org.id },
    });
    if (p) return true;
  }
  return false;
}

diagnosticsRouter.get('/centers/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id;
    const studies = await (prisma as any).diagnosticStudy.findMany({
      where: { centerId },
      select: { id: true, name: true, category: true, price: true, active: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ ok: true, data: studies } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/centers/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id;
    if (!hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', centerId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const { studies } = req.body as { studies: { id: string; price: number }[] };
    if (!Array.isArray(studies)) {
      return res.status(400).json({ ok: false, error: 'studies array required' } satisfies ApiResponse);
    }
    const updates = await Promise.all(
      studies.map((s) =>
        (prisma as any).diagnosticStudy.update({
          where: { id: s.id, centerId },
          data: {
            ...(s.price !== undefined ? { price: s.price } : {}),
            ...(s.active !== undefined ? { active: s.active } : {}),
          },
        })
      )
    );
    return res.json({ ok: true, data: updates } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// Create a new service (study) for a center — center members or superadmin
diagnosticsRouter.post('/centers/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id;
    if (!hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', centerId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const { name, category, price, description, durationMin } = req.body || {};
    if (!name || !category) {
      return res.status(400).json({ ok: false, error: 'Поля name и category обязательны' } satisfies ApiResponse);
    }
    const study = await (prisma as any).diagnosticStudy.create({
      data: {
        id: uid(),
        centerId,
        name: String(name),
        category: String(category),
        price: Number(price) > 0 ? Number(price) : 0,
        description: description || null,
        durationMin: durationMin ? Number(durationMin) : null,
      },
    });
    return res.json({ ok: true, data: study } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/laboratories/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const labId = req.params.id;
    const tests = await (prisma as any).laboratoryTest.findMany({
      where: { labId },
      select: { id: true, name: true, category: true, price: true, active: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ ok: true, data: tests } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/laboratories/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const labId = req.params.id;
    if (!hasOrgAccess(req.user, 'LABORATORY', labId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const { tests } = req.body as { tests: { id: string; price: number }[] };
    if (!Array.isArray(tests)) {
      return res.status(400).json({ ok: false, error: 'tests array required' } satisfies ApiResponse);
    }
    const updates = await Promise.all(
      tests.map((s) =>
        (prisma as any).laboratoryTest.update({
          where: { id: s.id, labId },
          data: { price: s.price },
        })
      )
    );
    return res.json({ ok: true, data: updates } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Payment tracking for center/lab ───

diagnosticsRouter.get('/centers/:id/payments', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id;
    if (!hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', centerId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const referrals = await (prisma as any).referral.findMany({
      where: { centerId, status: { not: 'CANCELLED' } },
      select: { id: true, patientName: true, studyType: true, cost: true, platformFee: true, paid: true, paidAt: true, createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const totals = referrals.reduce((acc: any, r: any) => ({
      totalRevenue: (acc.totalRevenue || 0) + Number(r.cost || 0),
      totalFees: (acc.totalFees || 0) + Number(r.platformFee || 0),
      paidCount: (acc.paidCount || 0) + (r.paid ? 1 : 0),
      unpaidCount: (acc.unpaidCount || 0) + (r.paid ? 0 : 1),
    }), { totalRevenue: 0, totalFees: 0, paidCount: 0, unpaidCount: 0 });
    return res.json({ ok: true, data: { referrals, totals } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/laboratories/:id/payments', async (req: AuthRequest, res) => {
  try {
    const labId = req.params.id;
    if (!hasOrgAccess(req.user, 'LABORATORY', labId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const referrals = await (prisma as any).referral.findMany({
      where: { labId, status: { not: 'CANCELLED' } },
      select: { id: true, patientName: true, studyType: true, cost: true, platformFee: true, paid: true, paidAt: true, createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const totals = referrals.reduce((acc: any, r: any) => ({
      totalRevenue: (acc.totalRevenue || 0) + Number(r.cost || 0),
      totalFees: (acc.totalFees || 0) + Number(r.platformFee || 0),
      paidCount: (acc.paidCount || 0) + (r.paid ? 1 : 0),
      unpaidCount: (acc.unpaidCount || 0) + (r.paid ? 0 : 1),
    }), { totalRevenue: 0, totalFees: 0, paidCount: 0, unpaidCount: 0 });
    return res.json({ ok: true, data: { referrals, totals } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Commission Rules ───

diagnosticsRouter.get('/commission-rules', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const rules = await (prisma as any).commissionRule.findMany({
      where: { domain: 'diagnostics' },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, data: rules } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/commission-rules', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { centerId, labId, percentBps, description } = req.body;
    if (typeof percentBps !== 'number') {
      return res.status(400).json({ ok: false, error: 'percentBps required' } satisfies ApiResponse);
    }
    const scopeId = centerId || labId || null;
    const rule = await (prisma as any).commissionRule.create({
      data: {
        domain: 'diagnostics',
        scopeId,
        percentBps,
        splitJson: description ? { description } : undefined,
      },
    });
    return res.json({ ok: true, data: rule } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Platform commission settlement visibility (per diagnostic center) ───

diagnosticsRouter.get('/platform/commissions', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const P = prisma as any;
    // Accrued: all non-cancelled referrals with a center. Collected: only paid ones.
    const [accrued, collected, centers] = await Promise.all([
      P.referral.groupBy({
        by: ['centerId'],
        where: { centerId: { not: null }, status: { not: 'CANCELLED' } },
        _sum: { cost: true, platformFee: true },
        _count: { _all: true },
      }),
      P.referral.groupBy({
        by: ['centerId'],
        where: { centerId: { not: null }, status: { not: 'CANCELLED' }, paid: true },
        _sum: { cost: true, platformFee: true },
        _count: { _all: true },
      }),
      P.diagnosticCenter.findMany({ select: { id: true, name: true } }),
    ]);

    const nameById = new Map<string, string>(centers.map((c: any) => [c.id, c.name]));
    const paidByCenter = new Map<string, any>(collected.map((r: any) => [r.centerId, r]));

    const rows = accrued.map((r: any) => {
      const paid = paidByCenter.get(r.centerId);
      const commissionAccrued = Number(r._sum.platformFee || 0);
      // Commission on orders the patient has already paid the center for — the center
      // has the cash and owes this to the platform (settlement layer will mark it paid).
      const commissionDue = Number(paid?._sum.platformFee || 0);
      return {
        centerId: r.centerId,
        centerName: nameById.get(r.centerId) || '—',
        orders: r._count._all,
        paidOrders: paid?._count._all || 0,
        revenueAccrued: Number(r._sum.cost || 0),
        revenueCollected: Number(paid?._sum.cost || 0),
        commissionAccrued,
        commissionDue,
        commissionUpcoming: Math.max(0, commissionAccrued - commissionDue),
      };
    }).sort((a: any, b: any) => b.commissionAccrued - a.commissionAccrued);

    const totals = rows.reduce(
      (acc: any, r: any) => ({
        revenueCollected: acc.revenueCollected + r.revenueCollected,
        commissionAccrued: acc.commissionAccrued + r.commissionAccrued,
        commissionDue: acc.commissionDue + r.commissionDue,
        commissionUpcoming: acc.commissionUpcoming + r.commissionUpcoming,
      }),
      { revenueCollected: 0, commissionAccrued: 0, commissionDue: 0, commissionUpcoming: 0 },
    );

    // Actual collection state from the settlement layer (commissionMinor in тиын).
    const { minorToTenge } = await import('../../lib/money.js');
    const settlementGroups: Array<{ status: string; _sum: { commissionMinor: bigint | null }; _count: { _all: number } }> =
      await (prisma as any).settlement
        .groupBy({ by: ['status'], _sum: { commissionMinor: true }, _count: { _all: true } })
        .catch(() => []);
    const settleTenge = (status: string) => {
      const g = settlementGroups.find((x) => x.status === status);
      return g ? minorToTenge(g._sum.commissionMinor ?? 0n) : 0;
    };
    const settleCount = (status: string) =>
      settlementGroups.find((x) => x.status === status)?._count._all || 0;
    const settlements = {
      open: settleTenge('open'),
      invoiced: settleTenge('invoiced'),
      paid: settleTenge('paid'),
      // "Outstanding" = invoiced but not yet paid (a pay-link is out).
      outstanding: settleTenge('open') + settleTenge('invoiced'),
      counts: { open: settleCount('open'), invoiced: settleCount('invoiced'), paid: settleCount('paid') },
    };

    return res.json({ ok: true, data: { rows, totals, settlements } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Settlements (collect accrued platform commission from centers/labs) ───

// Platform: generate settlements for a period (rolls up paid, unsettled referrals).
diagnosticsRouter.post('/platform/settlements/generate', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { generateSettlements } = await import('./settlement.service.js');
    const { serializeBigInt } = await import('../../lib/money.js');
    const { periodStart, periodEnd, dueDays } = req.body || {};
    const start = periodStart ? new Date(periodStart) : null;
    const end = periodEnd ? new Date(periodEnd) : null;
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({ ok: false, error: 'Укажите корректный период (periodStart < periodEnd)' } satisfies ApiResponse);
    }
    const created = await generateSettlements({
      periodStart: start,
      periodEnd: end,
      dueDays: dueDays != null ? Math.max(0, Number(dueDays) || 0) : undefined,
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(created) } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// Platform: list all settlements (optional ownerType/ownerId/status filter).
diagnosticsRouter.get('/platform/settlements', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { listSettlements } = await import('./settlement.service.js');
    const { serializeBigInt } = await import('../../lib/money.js');
    const { ownerType, ownerId, status } = req.query as Record<string, string | undefined>;
    const rows = await listSettlements({
      ownerType: ownerType === 'CENTER' || ownerType === 'LAB' ? ownerType : undefined,
      ownerId: ownerId || undefined,
      status: status || undefined,
    });
    return res.json({ ok: true, data: serializeBigInt(rows) } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// Center/Lab: list this owner's own settlements (member access).
diagnosticsRouter.get('/settlements', authenticate, async (req: AuthRequest, res) => {
  try {
    const { listSettlements } = await import('./settlement.service.js');
    const { serializeBigInt } = await import('../../lib/money.js');
    const { ownerType, ownerId } = req.query as Record<string, string | undefined>;
    if ((ownerType !== 'CENTER' && ownerType !== 'LAB') || !ownerId) {
      return res.status(400).json({ ok: false, error: 'Укажите ownerType (CENTER|LAB) и ownerId' } satisfies ApiResponse);
    }
    const { userOwnsSettlement } = await import('./settlement.service.js');
    const owns = await userOwnsSettlement(req.user!.id, ownerType, ownerId);
    if (!owns && req.user!.role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'Нет доступа к расчётам этого исполнителя' } satisfies ApiResponse);
    }
    const rows = await listSettlements({ ownerType, ownerId });
    return res.json({ ok: true, data: serializeBigInt(rows) } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// Center/Lab (or platform): create a Kaspi pay-link for a settlement.
diagnosticsRouter.post('/settlements/:id/pay', authenticate, async (req: AuthRequest, res) => {
  try {
    const { paySettlement, userOwnsSettlement } = await import('./settlement.service.js');
    const { serializeBigInt } = await import('../../lib/money.js');
    const { withPaymentQr } = await import('../payments/kaspi.provider.js');
    const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
    if (!settlement) {
      return res.status(404).json({ ok: false, error: 'Расчёт не найден' } satisfies ApiResponse);
    }
    const owns = await userOwnsSettlement(req.user!.id, settlement.ownerType, settlement.ownerId);
    if (!owns && req.user!.role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'Нет доступа к оплате этого расчёта' } satisfies ApiResponse);
    }
    const result = await paySettlement(req.params.id);
    const payment = result.payment
      ? withPaymentQr(serializeBigInt(result.payment) as Record<string, unknown>, (result as any).qr)
      : null;
    return res.json({
      ok: true,
      data: { settlement: serializeBigInt(result.settlement), payment, alreadyPaid: (result as any).alreadyPaid || false },
    } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(e.status || 500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Statistics ───

diagnosticsRouter.get('/stats', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const statuses = [
      'DRAFT', 'SENT', 'ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED',
      'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'DELIVERED', 'CLOSED', 'CANCELLED',
    ] as const;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedStatuses = ['COMPLETED', 'REVIEWED', 'DELIVERED', 'CLOSED'];

    const [total, todayCount, statusCounts, centersCount, labsCount, financialData] = await Promise.all([
      (prisma as any).referral.count(),
      (prisma as any).referral.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lt: new Date(now.getTime() + 86400000),
          },
        },
      }),
      Promise.all(
        statuses.map(async (s) => ({
          status: s,
          count: await (prisma as any).referral.count({ where: { status: s } }),
        }))
      ),
      (prisma as any).diagnosticCenter.count(),
      (prisma as any).laboratory.count(),
      // Financial: total revenue + commissions
      Promise.all([
        (prisma as any).referral.aggregate({
          _sum: { cost: true, platformFee: true },
          where: { status: { in: completedStatuses } },
        }),
        (prisma as any).referral.aggregate({
          _sum: { cost: true, platformFee: true },
          where: { status: { in: completedStatuses }, completedAt: { gte: startOfDay } },
        }),
        (prisma as any).referral.aggregate({
          _sum: { cost: true, platformFee: true },
          where: { status: { in: completedStatuses }, completedAt: { gte: startOfMonth } },
        }),
        (prisma as any).referral.count({ where: { status: { in: completedStatuses }, paid: true } }),
        (prisma as any).referral.count({ where: { status: { in: completedStatuses }, paid: false } }),
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    for (const { status, count } of statusCounts) byStatus[status] = count;

    const [totalFin, todayFin, monthFin, paidCount, unpaidCount] = financialData;
    const totalRevenue = Number(totalFin._sum.cost || 0);
    const totalCommission = Number(totalFin._sum.platformFee || 0);

    return res.json({
      ok: true,
      data: {
        total, todayCount, byStatus, centersCount, labsCount,
        financial: {
          totalRevenue,
          totalCommission,
          platformNet: totalRevenue - totalCommission,
          todayRevenue: Number(todayFin._sum.cost || 0),
          todayCommission: Number(todayFin._sum.platformFee || 0),
          monthRevenue: Number(monthFin._sum.cost || 0),
          monthCommission: Number(monthFin._sum.platformFee || 0),
          paidCount,
          unpaidCount,
        },
      },
    } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Payment Settlement ───

diagnosticsRouter.post('/referrals/:id/mark-paid', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const referral = await (prisma as any).referral.findUnique({ where: { id }, select: { id: true, status: true, cost: true, platformFee: true, centerId: true, labId: true, paid: true, clinicId: true } });
    if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' } as any);

    // Access: clinic member, or staff of the executing center/lab, or superadmin.
    const role = String((req.user as any)?.role || '').toLowerCase();
    const isSuper = role === 'superadmin';
    const isClinicMember = referral.clinicId
      ? await assertOrgAccess(req.user!, referral.clinicId)
      : false;
    const hasCenter = referral.centerId ? hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', referral.centerId) : false;
    const hasLab = referral.labId ? hasOrgAccess(req.user, 'LABORATORY', referral.labId) : false;
    if (!isSuper && !isClinicMember && !hasCenter && !hasLab) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' } as any);
    }

    if (referral.paid) return res.status(409).json({ ok: false, error: 'Уже оплачено' } as any);

    // Commission recomputed server-side from the rules for the stored record.
    const { resolveCommissionBps } = await import('../finance/finance.service.js');
    const bps = referral.centerId ? await resolveCommissionBps('diagnostics', referral.centerId) : 0;
    const fee = referral.cost ? Math.round((Number(referral.cost) * bps) / 10000) : 0;
    await (prisma as any).referral.update({ where: { id }, data: { paid: true, paidAt: new Date(), platformFee: fee } });

    // Record diagnostic sale through Commission Engine
    if (referral.cost && referral.centerId) {
      try {
        const { recordSale } = await import('../finance/finance.service.js');
        await recordSale({
          domain: 'diagnostics',
          sellerType: 'CLINIC' as any,
          sellerId: referral.centerId,
          amountMinor: BigInt(Math.round(Number(referral.cost) * 100)),
          refType: 'referral',
          refId: id,
        });
      } catch (e) { console.warn('[Diagnostics] Commission sale recording failed (non-fatal):', e); }
    }

    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Cashier: collect payment for a center referral ───

diagnosticsRouter.post('/centers/:id/cashier/collect', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id;
    if (!hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', centerId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const { referralId, cost } = req.body || {};
    if (!referralId) {
      return res.status(400).json({ ok: false, error: 'referralId обязателен' } satisfies ApiResponse);
    }
    const costNum = Number(cost);
    if (!costNum || costNum <= 0) {
      return res.status(400).json({ ok: false, error: 'Укажите корректную сумму оплаты' } satisfies ApiResponse);
    }

    const referral = await (prisma as any).referral.findUnique({
      where: { id: referralId },
      select: { id: true, centerId: true, paid: true, clinicId: true },
    });
    if (!referral) return res.status(404).json({ ok: false, error: 'Направление не найдено' } as any);
    if (referral.centerId !== centerId) return res.status(403).json({ ok: false, error: 'Направление не относится к этому центру' } as any);
    if (referral.paid) return res.status(409).json({ ok: false, error: 'Уже оплачено' } as any);

    // Platform commission is computed server-side from the commission rules —
    // never trusted from the request body (a center could otherwise zero it out).
    const { resolveCommissionBps } = await import('../finance/finance.service.js');
    const bps = await resolveCommissionBps('diagnostics', centerId);
    const feeNum = Math.round((costNum * bps) / 10000);

    await (prisma as any).referral.update({
      where: { id: referralId },
      data: { cost: costNum, platformFee: feeNum, paid: true, paidAt: new Date() },
    });

    // Record diagnostic sale through Commission Engine
    try {
      const { recordSale } = await import('../finance/finance.service.js');
      await recordSale({
        domain: 'diagnostics',
        sellerType: 'CLINIC' as any,
        sellerId: centerId,
        amountMinor: BigInt(Math.round(costNum * 100)),
        refType: 'referral',
        refId: referralId,
      });
    } catch (e) { console.warn('[Diagnostics] Cashier commission sale failed (non-fatal):', e); }

    return res.json({ ok: true, data: { cost: costNum, platformFee: feeNum, net: costNum - feeNum } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Laboratory parity ───
//
// Laboratories ran on a strict subset of what centres could do: no revenue
// dashboard, no cashier, no way to add a test to their own price list. Nothing
// about a laboratory makes those inapplicable — `Settlement.ownerType` already
// accepts LAB, and both are paid the same way by the same patients — so the gap
// was unfinished work rather than a decision, and it forced the two workspaces
// apart in the UI. These mirror the centre handlers against LaboratoryTest and
// the referral's labId.

diagnosticsRouter.post('/laboratories/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const labId = req.params.id as string;
    if (!hasOrgAccess(req.user, 'LABORATORY', labId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const { name, category, price } = req.body || {};
    if (!name || !category) {
      return res.status(400).json({ ok: false, error: 'Поля name и category обязательны' } satisfies ApiResponse);
    }
    const test = await (prisma as any).laboratoryTest.create({
      data: {
        id: uid(),
        labId,
        name: String(name),
        category: String(category),
        price: price != null ? Number(price) : 0,
      },
    });
    return res.status(201).json({ ok: true, data: test } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/laboratories/:id/cashier/collect', async (req: AuthRequest, res) => {
  try {
    const labId = req.params.id as string;
    if (!hasOrgAccess(req.user, 'LABORATORY', labId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const { referralId, cost } = req.body || {};
    if (!referralId) {
      return res.status(400).json({ ok: false, error: 'referralId обязателен' } satisfies ApiResponse);
    }
    const costNum = Number(cost);
    if (!costNum || costNum <= 0) {
      return res.status(400).json({ ok: false, error: 'Укажите корректную сумму оплаты' } satisfies ApiResponse);
    }

    const referral = await (prisma as any).referral.findUnique({
      where: { id: referralId },
      select: { id: true, labId: true, paid: true, clinicId: true },
    });
    if (!referral) return res.status(404).json({ ok: false, error: 'Направление не найдено' } as any);
    if (referral.labId !== labId) return res.status(403).json({ ok: false, error: 'Направление не относится к этой лаборатории' } as any);
    if (referral.paid) return res.status(409).json({ ok: false, error: 'Уже оплачено' } as any);

    // Commission is computed server-side, never taken from the request body.
    const { resolveCommissionBps } = await import('../finance/finance.service.js');
    const bps = await resolveCommissionBps('diagnostics', labId);
    const feeNum = Math.round((costNum * bps) / 10000);

    await (prisma as any).referral.update({
      where: { id: referralId },
      data: { cost: costNum, platformFee: feeNum, paid: true, paidAt: new Date() },
    });

    try {
      const { recordSale } = await import('../finance/finance.service.js');
      await recordSale({
        domain: 'diagnostics',
        sellerType: 'CLINIC' as any,
        sellerId: labId,
        amountMinor: BigInt(Math.round(costNum * 100)),
        refType: 'referral',
        refId: referralId,
      });
    } catch (e) { console.warn('[Diagnostics] Lab cashier commission sale failed (non-fatal):', e); }

    return res.json({ ok: true, data: { cost: costNum, platformFee: feeNum, net: costNum - feeNum } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/laboratories/:id/dashboard', async (req: AuthRequest, res) => {
  try {
    const labId = req.params.id as string;
    if (!hasOrgAccess(req.user, 'LABORATORY', labId) && req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - now.getDay() * 86400000);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [allReferrals, lab] = await Promise.all([
      (prisma as any).referral.findMany({
        where: { labId },
        select: { id: true, status: true, cost: true, platformFee: true, paid: true, createdAt: true, completedAt: true, studyType: true, patientName: true, clinicId: true },
      }),
      prisma.laboratory.findUnique({ where: { id: labId }, select: { name: true } }),
    ]);

    if (!lab) return res.status(404).json({ ok: false, error: 'Laboratory not found' } as any);

    const completedReferrals = allReferrals.filter((r: any) => r.status === 'COMPLETED' || r.status === 'REVIEWED' || r.status === 'DELIVERED' || r.status === 'CLOSED');
    const filterByDate = (list: any[], start: Date) => list.filter((r: any) => {
      const d = r.completedAt ? new Date(r.completedAt) : new Date(r.createdAt);
      return d >= start;
    });
    const sumCost = (list: any[]) => list.reduce((sum: number, r: any) => sum + (Number(r.cost) || 0), 0);
    const sumFee = (list: any[]) => list.reduce((sum: number, r: any) => sum + (Number(r.platformFee) || 0), 0);

    const todayCompleted = filterByDate(completedReferrals, startOfDay);
    const weekCompleted = filterByDate(completedReferrals, startOfWeek);
    const monthCompleted = filterByDate(completedReferrals, startOfMonth);
    const yearCompleted = filterByDate(completedReferrals, startOfYear);

    const revenue = { today: sumCost(todayCompleted), week: sumCost(weekCompleted), month: sumCost(monthCompleted), year: sumCost(yearCompleted), total: sumCost(completedReferrals) };
    const commissions = { today: sumFee(todayCompleted), week: sumFee(weekCompleted), month: sumFee(monthCompleted), year: sumFee(yearCompleted), total: sumFee(completedReferrals) };
    const netRevenue = { today: revenue.today - commissions.today, week: revenue.week - commissions.week, month: revenue.month - commissions.month, year: revenue.year - commissions.year, total: revenue.total - commissions.total };
    const paymentStats = { paid: completedReferrals.filter((r: any) => r.paid).length, unpaid: completedReferrals.filter((r: any) => !r.paid).length };

    const byStatus: Record<string, number> = {};
    for (const r of allReferrals) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    return res.json({ ok: true, data: { name: lab.name, referralCount: allReferrals.length, completedCount: completedReferrals.length, revenue, commissions, netRevenue, paymentStats, byStatus } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Quick price lookup ───

diagnosticsRouter.get('/centers/:id/study-price', async (req: AuthRequest, res) => {
  try {
    const studyName = req.query.study as string;
    if (!studyName) return res.status(400).json({ ok: false, error: 'study query required' } as any);
    const study = await (prisma as any).diagnosticStudy.findFirst({
      where: { centerId: req.params.id as string, active: true, name: { contains: studyName, mode: 'insensitive' } },
      select: { id: true, name: true, price: true },
    });
    if (!study) return res.json({ ok: true, data: { name: studyName, price: null, message: 'Цена не установлена' } } as any);
    return res.json({ ok: true, data: study } as any);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } as any);
  }
});

// ─── Center Subscription ───

diagnosticsRouter.get('/centers/:id/subscription', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id as string;
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const data = await svc.getCenterSubscription(centerId);
    return res.json({ ok: true, data: data || { status: 'trial', amountMonthly: 20000 } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/centers/:id/subscription/activate', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id as string;
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const months = Math.max(1, parseInt(req.body?.months || '1'));
    await svc.ensureCenterSubscription(centerId);
    // Extend subscription by months * 30 days from today
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "center_subscriptions" SET status = 'active', paid_until = greatest(coalesce(paid_until, now()), now()) + interval '1 day' * $2 WHERE center_id::text = $1`,
      centerId, months * 30
    );
    const sub = await svc.getCenterSubscription(centerId);
    return res.json({ ok: true, data: sub } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.get('/centers/:id/dashboard', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id as string;
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - now.getDay() * 86400000);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [allReferrals, center] = await Promise.all([
      (prisma as any).referral.findMany({
        where: { centerId },
        select: { id: true, status: true, cost: true, platformFee: true, paid: true, createdAt: true, completedAt: true, studyType: true, patientName: true, clinicId: true },
      }),
      prisma.diagnosticCenter.findUnique({ where: { id: centerId }, select: { name: true } }),
    ]);

    if (!center) return res.status(404).json({ ok: false, error: 'Center not found' } as any);

    const completedReferrals = allReferrals.filter((r: any) => r.status === 'COMPLETED' || r.status === 'REVIEWED' || r.status === 'DELIVERED' || r.status === 'CLOSED');
    const filterByDate = (list: any[], start: Date) => list.filter((r: any) => {
      const d = r.completedAt ? new Date(r.completedAt) : new Date(r.createdAt);
      return d >= start;
    });

    const sumCost = (list: any[]) => list.reduce((sum: number, r: any) => sum + (Number(r.cost) || 0), 0);
    const sumFee = (list: any[]) => list.reduce((sum: number, r: any) => sum + (Number(r.platformFee) || 0), 0);

    const todayCompleted = filterByDate(completedReferrals, startOfDay);
    const weekCompleted = filterByDate(completedReferrals, startOfWeek);
    const monthCompleted = filterByDate(completedReferrals, startOfMonth);
    const yearCompleted = filterByDate(completedReferrals, startOfYear);

    const revenue = { today: sumCost(todayCompleted), week: sumCost(weekCompleted), month: sumCost(monthCompleted), year: sumCost(yearCompleted), total: sumCost(completedReferrals) };
    const commissions = { today: sumFee(todayCompleted), week: sumFee(weekCompleted), month: sumFee(monthCompleted), year: sumFee(yearCompleted), total: sumFee(completedReferrals) };
    const netRevenue = { today: revenue.today - commissions.today, week: revenue.week - commissions.week, month: revenue.month - commissions.month, year: revenue.year - commissions.year, total: revenue.total - commissions.total };
    const paymentStats = { paid: completedReferrals.filter((r: any) => r.paid).length, unpaid: completedReferrals.filter((r: any) => !r.paid).length };

    const byStatus: Record<string, number> = {};
    for (const r of allReferrals) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    return res.json({ ok: true, data: { name: center.name, referralCount: allReferrals.length, completedCount: completedReferrals.length, revenue, commissions, netRevenue, paymentStats, byStatus } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});
