import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';

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
    const { patientId, amount, items, notes } = req.body;
    const clinicId = user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    if (!patientId || amount === undefined) {
      res.status(400).json({ ok: false, error: 'patientId and amount are required' });
      return;
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: uid(),
        patientId,
        clinicId,
        amount,
        items: items || undefined,
        notes: notes || null,
        status: 'PENDING',
      },
    });

    res.status(201).json({ ok: true, data: invoice });
  } catch (error) {
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

export { billingRouter };
