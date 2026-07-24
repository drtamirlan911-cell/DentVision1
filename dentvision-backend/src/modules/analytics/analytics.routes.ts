import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest } from '../../types/index.js';
import { guardAnalytics } from '../../middleware/planGate.js';

const analyticsRouter = Router();

analyticsRouter.use(authenticate);
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

    const invoices = await prisma.invoice.findMany({
      where: {
        clinicId,
        status: 'paid',
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { amount: true, createdAt: true },
    });

    const monthlyMap = new Map<string, number>();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, 0);
    }

    for (const invoice of invoices) {
      const d = invoice.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + invoice.amount);
      }
    }

    const revenue = Array.from(monthlyMap.entries()).map(([month, total]) => ({
      month,
      total: Math.round(total * 100) / 100,
    }));

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

    const patients = await prisma.patient.findMany({
      where: {
        clinicId,
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { createdAt: true },
    });

    const monthlyMap = new Map<string, number>();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, 0);
    }

    for (const patient of patients) {
      const d = patient.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
      }
    }

    const growth = Array.from(monthlyMap.entries()).map(([month, count]) => ({
      month,
      newPatients: count,
    }));

    res.json({ ok: true, data: growth });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch patient growth data' });
  }
});

export { analyticsRouter };
