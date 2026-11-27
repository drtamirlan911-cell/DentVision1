import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest } from '../../types/index.js';
import { guardAnalytics } from '../../middleware/planGate.js';
import { resolveOrganizationIdForClinic } from '../../lib/orgContext.js';
import { resolveClinicBranchAccess } from '../../lib/clinicBranchAccess.js';

const analyticsRouter = Router();

interface AnalyticsBranchContext {
  organizationWide: boolean;
  branchId: string | null;
  branchIds: string[];
}

async function resolveAnalyticsBranchContext(
  req: AuthRequest,
  clinicId: string,
): Promise<AnalyticsBranchContext> {
  if (String(req.user?.role || '').toUpperCase() === 'SUPERADMIN') {
    return { organizationWide: true, branchId: null, branchIds: [] };
  }
  const access = await resolveClinicBranchAccess({
    userId: req.user?.id || '',
    clinicId,
    organizationId: req.user?.organizationId,
    role: String(req.user?.role || ''),
    requestedBranchId: req.user?.branchId,
  });
  if (!access) return { organizationWide: false, branchId: null, branchIds: [] };
  return {
    organizationWide: access.roleScope === 'ORGANIZATION' && access.branchId === null,
    branchId: access.branchId,
    branchIds: access.branchId ? [access.branchId] : access.allowedBranchIds,
  };
}

function analyticsBranchWhere(context: AnalyticsBranchContext): Record<string, unknown> {
  if (context.organizationWide) return {};
  return context.branchIds.length
    ? { branchId: { in: context.branchIds } }
    : { branchId: '__NO_BRANCH_ACCESS__' };
}

function analyticsPatientBranchFilter(context: AnalyticsBranchContext): { branchId: { in: string[] } } | { branchId: string } | null {
  if (context.organizationWide) return null;
  return context.branchIds.length
    ? { branchId: { in: context.branchIds } }
    : { branchId: '__NO_BRANCH_ACCESS__' };
}

analyticsRouter.use(authenticate);
analyticsRouter.use(requirePermission('bi.clinic'));
analyticsRouter.use(guardAnalytics);

analyticsRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic context is required' });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const branchContext = await resolveAnalyticsBranchContext(req, clinicId);
    const patientBranch = analyticsPatientBranchFilter(branchContext);
    const patientRelationFilter = patientBranch ? { patient: patientBranch } : {};

    const [totalPatients, appointmentsToday, revenueResult, activeLabOrders] = await Promise.all([
      prisma.patient.count({ where: { clinicId, ...analyticsBranchWhere(branchContext) } }),
      prisma.appointment.count({
        where: {
          clinicId,
          ...analyticsBranchWhere(branchContext),
          date: { gte: startOfToday, lt: endOfToday },
          status: { notIn: ['cancelled', 'no_show'] },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          clinicId,
          ...patientRelationFilter,
          status: 'paid',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.labOrder.count({
        where: {
          clinicId,
          ...patientRelationFilter,
          status: { notIn: ['completed', 'delivered'] },
        },
      }),
    ]);

    const revenueThisMonth = revenueResult._sum.amount ?? 0;

    res.json({
      ok: true,
      data: {
        totalPatients,
        appointmentsToday,
        revenueThisMonth,
        activeLabOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch dashboard stats' });
  }
});

analyticsRouter.get('/revenue', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic context is required' });
      return;
    }

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const branchContext = await resolveAnalyticsBranchContext(req, clinicId);
    const branchIds = branchContext.organizationWide ? null : branchContext.branchIds;

    // SQL-level month bucketing instead of shipping every paid invoice to JS.
    const rows = branchIds === null
      ? await prisma.$queryRaw<Array<{ month: string; total: bigint }>>`
          SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                 COALESCE(SUM("amount"), 0)::bigint AS total
          FROM "invoices"
          WHERE "clinicId" = ${clinicId}
            AND "status" = 'paid'
            AND "createdAt" >= ${twelveMonthsAgo}
          GROUP BY 1
          ORDER BY 1
        `
      : await prisma.$queryRaw<Array<{ month: string; total: bigint }>>`
          SELECT to_char(date_trunc('month', i."createdAt"), 'YYYY-MM') AS month,
                 COALESCE(SUM(i."amount"), 0)::bigint AS total
          FROM "invoices" i
          JOIN "patients" p ON p."id" = i."patientId"
          WHERE i."clinicId" = ${clinicId}
            AND i."status" = 'paid'
            AND i."createdAt" >= ${twelveMonthsAgo}
            AND p."branchId" = ANY(${branchIds}::text[])
          GROUP BY 1
          ORDER BY 1
        `;

    const rowByMonth = new Map(rows.map((r) => [r.month, Number(r.total)]));

    const revenue: Array<{ month: string; total: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenue.push({ month: key, total: Math.round((rowByMonth.get(key) || 0) * 100) / 100 });
    }

    res.json({ ok: true, data: revenue });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch revenue data' });
  }
});

analyticsRouter.get('/doctors', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic context is required' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const branchContext = await resolveAnalyticsBranchContext(req, clinicId);

    const organizationId = await resolveOrganizationIdForClinic(clinicId);
    if (!organizationId) {
      return res.status(409).json({ ok: false, error: 'Canonical clinic organization is not initialized' });
    }

    // Canonical staff source: Person + organization-scoped PersonRole.
    // ClinicMember remains a legacy compatibility table and is not used for
    // analytics authorization or staff discovery after canonicalization.
    const persons = await prisma.person.findMany({
      where: {
        organizationId,
        personRoles: {
          some: {
            scopeType: 'organization',
            scopeId: organizationId,
            role: { key: { in: ['doctor', 'owner'] } },
          },
        },
        userId: { not: null },
      },
      select: {
        userId: true,
        fullName: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const doctorIds = persons.map((p) => p.userId).filter((id): id is string => Boolean(id));

    const appointmentCounts = await prisma.appointment.groupBy({
      by: ['doctorId'],
      where: {
        clinicId,
        ...analyticsBranchWhere(branchContext),
        doctorId: { in: doctorIds },
        date: { gte: startOfMonth, lte: endOfMonth },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const entry of appointmentCounts) {
      countMap.set(entry.doctorId, entry._count.id);
    }

    const utilization = persons.map((p) => {
      const doctorId = p.userId!;
      const [firstName, ...lastParts] = (p.fullName || '').split(' ');
      const lastName = lastParts.join(' ');
      return {
        doctorId,
        firstName,
        lastName,
        appointmentsThisMonth: countMap.get(doctorId) || 0,
      };
    });

    res.json({ ok: true, data: utilization });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch doctor utilization' });
  }
});

analyticsRouter.get('/patients-growth', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic context is required' });
      return;
    }

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const branchContext = await resolveAnalyticsBranchContext(req, clinicId);
    const branchIds = branchContext.organizationWide ? null : branchContext.branchIds;

    // SQL-level month bucketing instead of shipping every patient row to JS.
    const rows = branchIds === null
      ? await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
          SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                 COUNT(*)::bigint AS count
          FROM "patients"
          WHERE "clinicId" = ${clinicId}
            AND "createdAt" >= ${twelveMonthsAgo}
          GROUP BY 1
          ORDER BY 1
        `
      : await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
          SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                 COUNT(*)::bigint AS count
          FROM "patients"
          WHERE "clinicId" = ${clinicId}
            AND "createdAt" >= ${twelveMonthsAgo}
            AND "branchId" = ANY(${branchIds}::text[])
          GROUP BY 1
          ORDER BY 1
        `;

    const rowByMonth = new Map(rows.map((r) => [r.month, Number(r.count)]));

    const growth: Array<{ month: string; newPatients: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      growth.push({ month: key, newPatients: rowByMonth.get(key) || 0 });
    }

    res.json({ ok: true, data: growth });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch patient growth data' });
  }
});

export { analyticsRouter };
