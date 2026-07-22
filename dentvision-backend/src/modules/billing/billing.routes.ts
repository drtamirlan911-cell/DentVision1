import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import { buildDoctorPayroll } from '../crm/payroll.js';

const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.get('/invoices', async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { status, page, limit } = req.query;
    const clinicId = user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    const { skip, take } = paginate(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );

    const where: any = { clinicId };
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      ok: true,
      data: paginatedResponse(invoices, total, page ? Number(page) : 1, limit ? Number(limit) : 20),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch invoices' });
  }
});

billingRouter.post('/invoices', async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { patientId, amount, total, items, notes } = req.body;
    const clinicId = user?.clinicId;
    const amountValue = amount !== undefined ? Number(amount) : total !== undefined ? Number(total) : NaN;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    if (!patientId || !Number.isFinite(amountValue)) {
      res.status(400).json({ ok: false, error: 'patientId and amount are required' });
      return;
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: uid(),
        patientId,
        clinicId,
        amount: amountValue,
        items: items || undefined,
        notes: [
          req.body?.payMethod ? `[payMethod:${req.body.payMethod}]` : '',
          notes || '',
        ].filter(Boolean).join(' ').trim() || null,
        status: 'PENDING',
      },
    });

    res.status(201).json({ ok: true, data: invoice });
  } catch (error) {
    console.error('[billing] create invoice', error);
    res.status(500).json({ ok: false, error: 'Failed to create invoice' });
  }
});

billingRouter.patch('/invoices/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { status, amount, notes } = req.body;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(amount !== undefined && { amount }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json({ ok: true, data: invoice });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update invoice' });
  }
});

billingRouter.get('/invoices/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      res.status(404).json({ ok: false, error: 'Invoice not found' });
      return;
    }

    res.json({ ok: true, data: invoice });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch invoice' });
  }
});

billingRouter.post('/invoices/:id/pay', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const existing = await prisma.invoice.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ ok: false, error: 'Invoice not found' });
      return;
    }

    if (existing.status === 'PAID') {
      res.status(400).json({ ok: false, error: 'Invoice is already paid' });
      return;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    res.json({ ok: true, data: invoice });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to mark invoice as paid' });
  }
});

billingRouter.delete('/invoices/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Invoice not found' });
    }
    if (clinicId && existing.clinicId !== clinicId) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к этому счёту' });
    }
    await prisma.invoice.delete({ where: { id } });
    return res.json({ ok: true, data: { id } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to delete invoice' });
  }
});

billingRouter.get('/summary', async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const clinicId = user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [totalRevenue, unpaidTotal, paidThisMonth] = await Promise.all([
      prisma.invoice.aggregate({
        where: { clinicId, status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { clinicId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          clinicId,
          status: 'PAID',
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      ok: true,
      data: {
        totalRevenue: totalRevenue._sum.amount || 0,
        unpaid: unpaidTotal._sum.amount || 0,
        paidThisMonth: paidThisMonth._sum.amount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch billing summary' });
  }
});

billingRouter.get('/my-payroll', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const userId = req.user?.id;
    if (!clinicId || !userId) {
      return res.status(400).json({ ok: false, error: 'Clinic ID not found' } satisfies ApiResponse);
    }

    const now = new Date();
    const from = req.query.from
      ? new Date(String(req.query.from))
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const member = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId, clinicId } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!member) {
      return res.status(404).json({ ok: false, error: 'Участник клиники не найден' } satisfies ApiResponse);
    }

    const completedAppts = await prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId: userId,
        status: 'COMPLETED',
        date: { gte: from, lte: to },
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });

    const payroll = buildDoctorPayroll({
      userId,
      name: `${member.user.firstName} ${member.user.lastName}`.trim(),
      role: member.role,
      percent: member.commissionPercent ?? 30,
      appointments: completedAppts,
    });

    return res.json({
      ok: true,
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        payroll,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('My payroll error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить начисления' } satisfies ApiResponse);
  }
});

billingRouter.get('/reports', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const invoices = await prisma.invoice.findMany({
      where: {
        clinicId,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
    });

    const paid = invoices.filter((i) => i.status === 'PAID');
    const unpaid = invoices.filter((i) => ['PENDING', 'UNPAID', 'PARTIAL', 'OVERDUE'].includes(i.status));

    const byDay: Record<string, { revenue: number; count: number }> = {};
    const byService: Record<string, { revenue: number; count: number }> = {};

    for (const inv of paid) {
      const day = inv.paidAt
        ? inv.paidAt.toISOString().slice(0, 10)
        : inv.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { revenue: 0, count: 0 };
      byDay[day].revenue += inv.amount || 0;
      byDay[day].count += 1;

      const items = Array.isArray(inv.items) ? inv.items : [];
      for (const raw of items as any[]) {
        const name = raw?.name || raw?.service || 'Услуга';
        if (!byService[name]) byService[name] = { revenue: 0, count: 0 };
        byService[name].revenue += Number(raw?.price || raw?.amount || 0) * Number(raw?.qty || 1);
        byService[name].count += Number(raw?.qty || 1);
      }
      if (items.length === 0) {
        const fallback = inv.notes || 'Без позиции';
        if (!byService[fallback]) byService[fallback] = { revenue: 0, count: 0 };
        byService[fallback].revenue += inv.amount || 0;
        byService[fallback].count += 1;
      }
    }

    const byMethod: Record<string, { revenue: number; count: number }> = {};
    for (const inv of paid) {
      const method = (() => {
        const notes = String(inv.notes || '');
        const m = notes.match(/\[payMethod:([^\]]+)\]/i);
        if (m) return m[1].trim();
        const items = Array.isArray(inv.items) ? inv.items as any[] : [];
        return items[0]?.payMethod || items[0]?.method || 'Прочее';
      })();
      if (!byMethod[method]) byMethod[method] = { revenue: 0, count: 0 };
      byMethod[method].revenue += inv.amount || 0;
      byMethod[method].count += 1;
    }

    const completedAppts = await prisma.appointment.findMany({
      where: {
        clinicId,
        status: 'COMPLETED',
        date: { gte: from, lte: to },
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });
    const members = await prisma.clinicMember.findMany({
      where: { clinicId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    const payroll = members
      .map((m) => buildDoctorPayroll({
        userId: m.userId,
        name: `${m.user.firstName} ${m.user.lastName}`.trim(),
        role: m.role,
        percent: m.commissionPercent ?? 30,
        appointments: completedAppts.filter((a) => a.doctorId === m.userId),
      }))
      .filter((r) => r.visits > 0 || r.earned > 0)
      .map(({ visitDetails, ...row }) => row);

    res.json({
      ok: true,
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        totals: {
          revenue: paid.reduce((s, i) => s + (i.amount || 0), 0),
          paidCount: paid.length,
          unpaid: unpaid.reduce((s, i) => s + (i.amount || 0), 0),
          unpaidCount: unpaid.length,
        },
        byDay: Object.entries(byDay)
          .map(([date, v]) => ({ date, ...v }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        byService: Object.entries(byService)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
        byMethod: Object.entries(byMethod)
          .map(([method, v]) => ({ method, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
        payroll,
      },
    });
  } catch (error) {
    console.error('Billing reports error:', error);
    res.status(500).json({ ok: false, error: 'Failed to build finance report' });
  }
});

export { billingRouter };
