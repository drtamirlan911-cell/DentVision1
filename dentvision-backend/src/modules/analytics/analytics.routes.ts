import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest } from '../../types/index.js';
import { guardAnalytics } from '../../middleware/planGate.js';

const analyticsRouter = Router();

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

    const [totalPatients, appointmentsToday, revenueResult, activeLabOrders] = await Promise.all([
      prisma.patient.count({ where: { clinicId } }),
      prisma.appointment.count({
        where: {
          clinicId,
          date: { gte: startOfToday, lt: endOfToday },
          status: { notIn: ['cancelled', 'no_show'] },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          clinicId,
          status: 'paid',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.labOrder.count({
        where: {
          clinicId,
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

    // SQL-level month bucketing instead of shipping every paid invoice to JS.
    const rows = await prisma.$queryRaw<Array<{ month: string; total: bigint }>>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             COALESCE(SUM("amount"), 0)::bigint AS total
      FROM "invoices"
      WHERE "clinicId" = ${clinicId}
        AND "status" = 'paid'
        AND "createdAt" >= ${twelveMonthsAgo}
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

    const members = await prisma.clinicMember.findMany({
      where: {
        clinicId,
        role: { in: ['DOCTOR', 'OWNER'] },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const doctorIds = members.map((m) => m.user.id);

    const appointmentCounts = await prisma.appointment.groupBy({
      by: ['doctorId'],
      where: {
        clinicId,
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

    const utilization = members.map((m) => ({
      doctorId: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      appointmentsThisMonth: countMap.get(m.user.id) || 0,
    }));

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

    // SQL-level month bucketing instead of shipping every patient row to JS.
    const rows = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             COUNT(*)::bigint AS count
      FROM "patients"
      WHERE "clinicId" = ${clinicId}
        AND "createdAt" >= ${twelveMonthsAgo}
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
