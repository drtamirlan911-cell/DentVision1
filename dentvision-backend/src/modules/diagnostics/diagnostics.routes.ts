// @ts-nocheck
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { loadClinicAccess } from '../../middleware/planGate.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import * as svc from './diagnostics.service.js';
import prisma from '../../lib/prisma.js';

// C3: Verify user has clinic membership for the referral's clinic
async function requireReferralAccess(req: AuthRequest, res: any, next: any) {
  try {
    const id = req.params.id || req.body?.referralId;
    if (!id) return res.status(400).json({ ok: false, error: 'Referral ID required' });
    const referral = await (prisma as any).referral.findUnique({
      where: { id },
      select: { clinicId: true, doctorId: true },
    });
    if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' });
    // Allow: doctor who created it, or member of the clinic
    if (referral.doctorId === req.user!.id) return next();
    const member = await prisma.clinicMember.findFirst({
      where: { userId: req.user!.id, clinicId: referral.clinicId },
    });
    if (!member) return res.status(403).json({ ok: false, error: 'Нет доступа к направлению' });
    next();
  } catch {
    res.status(500).json({ ok: false, error: 'Access check failed' });
  }
}

export const diagnosticsRouter = Router();

// Public registration request (must be before authenticate middleware)

diagnosticsRouter.post('/register', async (req: AuthRequest, res) => {
  try {
    const data = await svc.createRegistrationRequest(req.body);
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
    const data = await svc.listReferrals({
      clinicId,
      doctorId: req.query.doctorId as string,
      centerId: req.query.centerId as string,
      labId: req.query.labId as string,
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

diagnosticsRouter.get('/referrals/:id', requireReferralAccess, async (req: AuthRequest, res) => {
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
    if (clinicId) {
      const member = await prisma.clinicMember.findFirst({
        where: { userId: req.user!.id, clinicId },
      });
      if (!member) return res.status(403).json({ ok: false, error: 'Нет доступа к клинике' });
    }
    const userId = req.user!.id;
    const data = await svc.createReferral({ ...req.body, doctorId: userId }, userId);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/referrals/:id', requireReferralAccess, async (req: AuthRequest, res) => {
  try {
    const data = await svc.updateReferral(req.params.id, req.body, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/referrals/:id/status', requireReferralAccess, async (req: AuthRequest, res) => {
  try {
    const { status, reason, cost, platformFee } = req.body;
    const data = await svc.changeReferralStatus(req.params.id, status, req.user!.id, reason, cost, platformFee);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.delete('/referrals/:id', requireReferralAccess, async (req: AuthRequest, res) => {
  try {
    await svc.deleteReferral(req.params.id, req.user!.id);
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Files ───

diagnosticsRouter.post('/files/upload', requireReferralAccess, async (req: AuthRequest, res) => {
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
}, requireReferralAccess, async (req: AuthRequest, res) => {
  try {
    await svc.deleteReferralFile(req.params.id, req.user!.id);
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Results ───

diagnosticsRouter.post('/results/ai-generate', requireReferralAccess, async (req: AuthRequest, res) => {
  try {
    const { referralId } = req.body;
    if (!referralId) return res.status(400).json({ ok: false, error: 'referralId required' } satisfies ApiResponse);
    const data = await svc.aiGenerateResult(referralId, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/results/:id/sign', requireReferralAccess, async (req: AuthRequest, res) => {
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

diagnosticsRouter.post('/referrals/:id/comments', requireReferralAccess, async (req: AuthRequest, res) => {
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
          data: { price: s.price },
        })
      )
    );
    return res.json({ ok: true, data: updates } satisfies ApiResponse);
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
    const referral = await (prisma as any).referral.findUnique({ where: { id }, select: { id: true, status: true, cost: true, platformFee: true, centerId: true, paid: true, clinicId: true } });
    if (!referral) return res.status(404).json({ ok: false, error: 'Referral not found' } as any);
    if (referral.paid) return res.status(409).json({ ok: false, error: 'Уже оплачено' } as any);

    await (prisma as any).referral.update({ where: { id }, data: { paid: true, paidAt: new Date() } });

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
    const data = await svc.getCenterSubscription(req.params.id as string);
    return res.json({ ok: true, data: data || { status: 'trial', amountMonthly: 20000 } } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/centers/:id/subscription/activate', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id as string;
    const months = Math.max(1, parseInt(req.body?.months || '1'));
    await svc.ensureCenterSubscription(centerId);
    // Extend subscription by months * 30 days from today
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "center_subscriptions" SET status = 'active', paid_until = greatest(coalesce(paid_until, now()), now()) + interval '1 day' * $2 WHERE center_id = $1`,
      centerId, months * 30
    );
    const sub = await svc.getCenterSubscription(centerId);
    return res.json({ ok: true, data: sub } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Center Dashboard ───

diagnosticsRouter.get('/centers/:id/dashboard', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id as string;
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
