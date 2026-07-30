// @ts-nocheck
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { loadClinicAccess } from '../../middleware/planGate.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import * as svc from './diagnostics.service.js';
import prisma from '../../lib/prisma.js';

export const diagnosticsRouter = Router();
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

// ─── Registration Requests (public) ───

diagnosticsRouter.post('/register', async (req: AuthRequest, res) => {
  try {
    const data = await svc.createRegistrationRequest(req.body);
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

diagnosticsRouter.get('/referrals/:id', async (req: AuthRequest, res) => {
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
    const userId = req.user!.id;
    const data = await svc.createReferral({ ...req.body, doctorId: userId }, userId);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.patch('/referrals/:id', async (req: AuthRequest, res) => {
  try {
    const data = await svc.updateReferral(req.params.id, req.body, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/referrals/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status, reason, cost, platformFee } = req.body;
    const data = await svc.changeReferralStatus(req.params.id, status, req.user!.id, reason, cost, platformFee);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.delete('/referrals/:id', async (req: AuthRequest, res) => {
  try {
    await svc.deleteReferral(req.params.id, req.user!.id);
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Files ───

diagnosticsRouter.post('/files/upload', async (req: AuthRequest, res) => {
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

diagnosticsRouter.delete('/files/:id', async (req: AuthRequest, res) => {
  try {
    await svc.deleteReferralFile(req.params.id, req.user!.id);
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

// ─── Results ───

diagnosticsRouter.post('/results/ai-generate', async (req: AuthRequest, res) => {
  try {
    const { referralId } = req.body;
    if (!referralId) return res.status(400).json({ ok: false, error: 'referralId required' } satisfies ApiResponse);
    const data = await svc.aiGenerateResult(referralId, req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});

diagnosticsRouter.post('/results/:id/sign', async (req: AuthRequest, res) => {
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

diagnosticsRouter.post('/referrals/:id/comments', async (req: AuthRequest, res) => {
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
  return user?.platformRole === 'superadmin' ||
    (user?.organizationType === type && user?.organizationId === orgId);
}

diagnosticsRouter.get('/centers/:id/pricing', async (req: AuthRequest, res) => {
  try {
    const centerId = req.params.id;
    if (!hasOrgAccess(req.user, 'DIAGNOSTIC_CENTER', centerId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
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
    if (!hasOrgAccess(req.user, 'LABORATORY', labId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
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

interface CommissionRule {
  id: string;
  centerId?: string;
  labId?: string;
  percentBps: number;
  description?: string;
  createdAt: Date;
}

const commissionRulesStore: CommissionRule[] = [];

diagnosticsRouter.get('/commission-rules', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    return res.json({ ok: true, data: commissionRulesStore } satisfies ApiResponse);
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
    const rule: CommissionRule = {
      id: crypto.randomUUID(),
      centerId,
      labId,
      percentBps,
      description,
      createdAt: new Date(),
    };
    commissionRulesStore.push(rule);
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

    const [total, todayCount, statusCounts, centersCount, labsCount] = await Promise.all([
      (prisma as any).referral.count(),
      (prisma as any).referral.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
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
    ]);

    const byStatus: Record<string, number> = {};
    for (const { status, count } of statusCounts) {
      byStatus[status] = count;
    }

    return res.json({
      ok: true,
      data: { total, todayCount, byStatus, centersCount, labsCount },
    } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message } satisfies ApiResponse);
  }
});
