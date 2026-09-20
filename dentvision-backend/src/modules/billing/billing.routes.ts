import { Router } from 'express';
import { createHash } from 'crypto';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import { buildDoctorPayroll } from '../crm/payroll.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';
import { listClinicStaff } from '../../lib/clinicStaff.js';
import { resolveStaffCompensation } from '../../lib/staffCompensation.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { reserveIdempotencyKey, completeIdempotencyKey, deleteIdempotencyKey } from '../../lib/idempotency.js';
import { recordClinicalPaymentTx, reverseClinicalPaymentTx } from '../finance/finance.service.js';
import { tengeToMinor } from '../../lib/money.js';

const billingRouter = Router();

billingRouter.use(authenticate);
billingRouter.use(loadClinicAccess);
billingRouter.use(blockClinicWrites);

billingRouter.get('/invoices', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { status, page, limit } = req.query;
    const clinicId = user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Clinic ID not found' });
    const { skip, take } = paginate(page ? Number(page) : 1, limit ? Number(limit) : 20);
    const where: any = { clinicId };
    if (status) where.status = status;
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ ok: true, data: paginatedResponse(invoices, total, page ? Number(page) : 1, limit ? Number(limit) : 20) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch invoices' });
  }
});

billingRouter.post('/invoices', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  let idempotencyKey: string | undefined;
  let idempotencyKeyCompleted = false;
  try {
    const user = req.user;
    const { patientId, amount, total, items, notes } = req.body;
    const clinicId = user?.clinicId;
    const amountValue = amount !== undefined ? Number(amount) : total !== undefined ? Number(total) : NaN;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Clinic ID not found' });
    if (!patientId || !Number.isFinite(amountValue)) return res.status(400).json({ ok: false, error: 'patientId and amount are required' });

    idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      const hash = createHash('sha256').update(`${req.user!.id}:${clinicId}:${JSON.stringify(req.body)}`).digest('hex');
      idempotencyKey = `server-${hash.slice(0, 32)}`;
    }
    const reserved = await reserveIdempotencyKey(idempotencyKey);
    if (reserved.status === 'in_flight') return res.status(409).json({ ok: false, error: 'Счёт уже создаётся, повторите позже' });
    if (reserved.status === 'exists') {
      const prior = await prisma.invoice.findUnique({ where: { id: reserved.resultId } });
      if (prior) return res.status(200).json({ ok: true, data: prior });
      await deleteIdempotencyKey(idempotencyKey);
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: uid(),
        patientId,
        clinicId,
        amount: amountValue,
        items: items ?? [],
        notes: [req.body?.payMethod ? `[payMethod:${req.body.payMethod}]` : '', notes || ''].filter(Boolean).join(' ').trim() || null,
        status: 'pending',
      },
    });
    await completeIdempotencyKey(idempotencyKey, invoice.id);
    idempotencyKeyCompleted = true;
    await auditFromReq(req, { action: 'invoice.created', entity: 'invoice', entityId: invoice.id, details: { patientId, amount: amountValue } });
    res.status(201).json({ ok: true, data: invoice });
  } catch (error) {
    if (idempotencyKey && !idempotencyKeyCompleted) await deleteIdempotencyKey(idempotencyKey);
    console.error('[billing] create invoice', error);
    res.status(500).json({ ok: false, error: 'Failed to create invoice' });
  }
});

billingRouter.patch('/invoices/:id', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    const { status, amount, notes } = req.body;
    const existing = await prisma.invoice.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Invoice not found' });
    const invoice = await prisma.invoice.update({ where: { id }, data: {
      ...(status !== undefined && { status }),
      ...(amount !== undefined && { amount }),
      ...(notes !== undefined && { notes }),
    }});
    await auditFromReq(req, { action: 'invoice.updated', entity: 'invoice', entityId: invoice.id, details: { from: existing.status, to: invoice.status } });
    res.json({ ok: true, data: invoice });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update invoice' });
  }
});

billingRouter.get('/invoices/:id', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    const invoice = await prisma.invoice.findFirst({ where: { id, clinicId } });
    if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found' });
    res.json({ ok: true, data: invoice });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch invoice' });
  }
});

async function consumePatientPrepaymentTx(tx: Prisma.TransactionClient, clinicId: string, patientId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const patient = await tx.patient.findFirst({ where: { id: patientId, clinicId, deletedAt: null } });
  if (!patient || patient.prepaidBalance <= 0) return 0;
  const applied = Math.min(amount, patient.prepaidBalance);
  if (applied <= 0) return 0;
  await tx.patient.update({ where: { id: patientId }, data: { prepaidBalance: { decrement: applied } } });
  return applied;
}

billingRouter.post('/invoices/:id/pay', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    const paymentMethod = String(req.body?.payMethod || req.body?.paymentMethod || 'unknown');
    const requestedAmount = req.body?.amount !== undefined
      ? Number(req.body.amount)
      : req.body?.amountMinor !== undefined
        ? Number(req.body.amountMinor) / 100
        : undefined;
    if (requestedAmount !== undefined && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      return res.status(400).json({ ok: false, error: 'Сумма платежа должна быть положительной' });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findUnique({ where: { id } });
      if (!current || current.clinicId !== clinicId) throw new Error('Invoice not found');
      const outstanding = Math.max(0, current.amount - current.paidAmount);
      if (outstanding <= 0 || current.status === 'paid') throw new Error('Invoice is already paid');
      const requestedPayment = requestedAmount ?? outstanding;
      const prepaymentApplied = await consumePatientPrepaymentTx(tx, clinicId, current.patientId, requestedPayment);
      const paymentAmount = Math.min(requestedPayment, outstanding);
      const cashPaymentAmount = Math.max(0, paymentAmount - prepaymentApplied);
      const newPaidAmount = current.paidAmount + paymentAmount;
      const nextStatus = newPaidAmount >= current.amount ? 'paid' : 'partial';
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: nextStatus,
          paidAt: nextStatus === 'paid' ? new Date() : null,
        },
      });
      if (cashPaymentAmount > 0) await recordClinicalPaymentTx({
        clinicId,
        amountMinor: tengeToMinor(cashPaymentAmount),
        refId: `invoice:${updated.id}:payment:${uid()}`,
        paymentMethod,
        db: tx,
      });
      return updated;
    });

    await auditFromReq(req, {
      action: invoice.status === 'partial' ? 'invoice.payment_partial' : 'invoice.paid',
      entity: 'invoice',
      entityId: invoice.id,
      details: { amount: invoice.amount, paidAmount: invoice.paidAmount, paymentMethod, prepaymentApplied: Math.min(requestedAmount ?? invoice.amount, invoice.paidAmount), ledger: 'clinical_payment' },
    });
    return res.json({ ok: true, data: invoice });
  } catch (error: any) {
    const message = error?.message || '';
    if (message === 'Invoice not found') return res.status(404).json({ ok: false, error: message });
    if (message === 'Invoice is already paid') return res.status(400).json({ ok: false, error: message });
    console.error('[billing] pay invoice', error);
    return res.status(500).json({ ok: false, error: 'Failed to mark invoice as paid' });
  }
});

billingRouter.post('/invoices/:id/refund', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const id = String(req.params.id);
    const idempotencyKey = String(req.headers['idempotency-key'] || '');
    if (!idempotencyKey) return res.status(400).json({ ok: false, error: 'Idempotency-Key обязателен для возврата' });
    const requested = req.body?.amount !== undefined ? Number(req.body.amount) : undefined;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findUnique({ where: { id } });
      if (!current || current.clinicId !== clinicId) throw new Error('Invoice not found');
      const existingReversal = await tx.transaction.findFirst({ where: { type: 'clinical_payment_reversal', refType: 'clinical_payment_reversal', refId: `invoice:${id}:refund:${idempotencyKey}` } });
      if (existingReversal) return current;
      if (current.paidAmount <= 0) throw new Error('Invoice has no paid amount');
      const amount = Math.min(requested ?? current.paidAmount, current.paidAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid refund amount');
      const nextPaid = current.paidAmount - amount;
      const nextStatus = nextPaid === 0 ? 'pending' : 'partial';
      const updated = await tx.invoice.update({
        where: { id },
        data: { paidAmount: nextPaid, status: nextStatus, paidAt: null },
      });
      await reverseClinicalPaymentTx({
        clinicId,
        amountMinor: tengeToMinor(amount),
        refId: `invoice:${id}:refund:${idempotencyKey}`,
        reason: 'invoice_refund',
        db: tx,
      });
      return updated;
    });
    await auditFromReq(req, {
      action: 'invoice.refunded',
      entity: 'invoice',
      entityId: id,
      details: { paidAmount: invoice.paidAmount, status: invoice.status },
    });
    return res.json({ ok: true, data: invoice });
  } catch (error: any) {
    if (error?.message === 'Invoice not found') return res.status(404).json({ ok: false, error: error.message });
    if (error?.message === 'Invoice has no paid amount') return res.status(400).json({ ok: false, error: error.message });
    return res.status(400).json({ ok: false, error: error?.message || 'Не удалось выполнить возврат' });
  }
});

billingRouter.post('/patients/:patientId/prepayment', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const patientId = String(req.params.patientId);
    const amount = Number(req.body?.amount);
    const paymentMethod = String(req.body?.payMethod || req.body?.paymentMethod || 'unknown');
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, error: 'Сумма предоплаты должна быть положительной' });

    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({ where: { id: patientId, clinicId, deletedAt: null } });
      if (!patient) throw new Error('Patient not found');
      const updated = await tx.patient.update({
        where: { id: patientId },
        data: { prepaidBalance: { increment: amount } },
      });
      await recordClinicalPaymentTx({
        clinicId,
        amountMinor: tengeToMinor(amount),
        refId: `prepayment:${patientId}:${uid()}`,
        paymentMethod,
        db: tx,
      });
      return updated;
    });

    await auditFromReq(req, {
      action: 'patient.prepayment_received',
      entity: 'patient',
      entityId: patientId,
      details: { amount, prepaidBalance: result.prepaidBalance, paymentMethod, ledger: 'clinical_payment' },
    });
    return res.status(201).json({ ok: true, data: { patientId, prepaidBalance: result.prepaidBalance } });
  } catch (error: any) {
    if (error?.message === 'Patient not found') return res.status(404).json({ ok: false, error: 'Пациент не найден' });
    console.error('[billing] prepayment', error);
    return res.status(500).json({ ok: false, error: 'Не удалось зачислить предоплату' });
  }
});


billingRouter.post('/patients/:patientId/prepayment/refund', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const patientId = String(req.params.patientId);
    const amount = Number(req.body?.amount);
    const idempotencyKey = String(req.headers['idempotency-key'] || '');
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Выберите клинику' });
    if (!idempotencyKey) return res.status(400).json({ ok: false, error: 'Idempotency-Key обязателен для возврата' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, error: 'Некорректная сумма возврата' });
    const patient = await prisma.$transaction(async (tx) => {
      const current = await tx.patient.findFirst({ where: { id: patientId, clinicId, deletedAt: null } });
      if (!current) throw new Error('Patient not found');
      const existingReversal = await tx.transaction.findFirst({ where: { type: 'clinical_payment_reversal', refType: 'clinical_payment_reversal', refId: `prepayment:${patientId}:refund:${idempotencyKey}` } });
      if (existingReversal) return current;
      if (current.prepaidBalance < amount) throw new Error('Недостаточно предоплаты для возврата');
      const updated = await tx.patient.update({
        where: { id: patientId },
        data: { prepaidBalance: { decrement: amount } },
      });
      await reverseClinicalPaymentTx({
        clinicId,
        amountMinor: tengeToMinor(amount),
        refId: `prepayment:${patientId}:refund:${idempotencyKey}`,
        reason: 'prepayment_refund',
        db: tx,
      });
      return updated;
    });
    await auditFromReq(req, {
      action: 'patient.prepayment_refunded',
      entity: 'patient',
      entityId: patientId,
      details: { amount, prepaidBalance: patient.prepaidBalance },
    });
    return res.json({ ok: true, data: { patientId, prepaidBalance: patient.prepaidBalance } });
  } catch (error: any) {
    if (error?.message === 'Patient not found') return res.status(404).json({ ok: false, error: 'Пациент не найден' });
    return res.status(400).json({ ok: false, error: error?.message || 'Не удалось выполнить возврат предоплаты' });
  }
});

billingRouter.delete('/invoices/:id', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Invoice not found' });
    if (clinicId && existing.clinicId !== clinicId) return res.status(403).json({ ok: false, error: 'Нет доступа к этому счёту' });
    await prisma.invoice.delete({ where: { id } });
    await auditFromReq(req, { action: 'invoice.deleted', entity: 'invoice', entityId: id, details: { amount: existing.amount } });
    return res.json({ ok: true, data: { id } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to delete invoice' });
  }
});

billingRouter.get('/summary', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Clinic ID not found' });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const [totalRevenue, unpaidTotal, paidThisMonth] = await Promise.all([
      prisma.invoice.aggregate({ where: { clinicId, status: 'paid' }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { clinicId, status: { in: ['pending', 'partial', 'overdue'] } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { clinicId, status: 'paid', paidAt: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
    ]);
    res.json({ ok: true, data: { totalRevenue: totalRevenue._sum.amount || 0, unpaid: unpaidTotal._sum.amount || 0, paidThisMonth: paidThisMonth._sum.amount || 0 } });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch billing summary' });
  }
});

billingRouter.get('/my-payroll', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const userId = req.user?.id;
    if (!clinicId || !userId) return res.status(400).json({ ok: false, error: 'Clinic ID not found' } satisfies ApiResponse);
    const now = new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const [access, user, compensation] = await Promise.all([
      resolveClinicAccess(userId, clinicId),
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
      resolveStaffCompensation(userId, clinicId),
    ]);
    if (!access) return res.status(404).json({ ok: false, error: 'Участник клиники не найден' } satisfies ApiResponse);
    const completedAppts = await prisma.appointment.findMany({ where: { clinicId, doctorId: userId, status: 'completed', date: { gte: from, lte: to } }, include: { patient: { select: { firstName: true, lastName: true } } }, orderBy: [{ date: 'desc' }, { time: 'desc' }] });
    const clinicRow = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
    const commissionBase = (clinicRow?.settings as any)?.payrollBase === 'gross' ? 'gross' : 'net';
    const payroll = buildDoctorPayroll({ userId, name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(), role: access.role, percent: compensation.commissionPercent, baseSalary: compensation.baseSalary, payType: compensation.payType, commissionBase, from, to, appointments: completedAppts });
    return res.json({ ok: true, data: { from: from.toISOString(), to: to.toISOString(), payroll } } satisfies ApiResponse);
  } catch (error) {
    console.error('My payroll error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить начисления' } satisfies ApiResponse);
  }
});

billingRouter.get('/reports', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Clinic ID not found' });
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const invoices = await prisma.invoice.findMany({ where: { clinicId, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' } });
    const paid = invoices.filter((i) => i.status === 'paid');
    const unpaid = invoices.filter((i) => ['pending', 'unpaid', 'partial', 'overdue'].includes(i.status));
    const byDay: Record<string, { revenue: number; count: number }> = {};
    const byService: Record<string, { revenue: number; count: number }> = {};
    for (const inv of paid) {
      const day = inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : inv.createdAt.toISOString().slice(0, 10);
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
    const completedAppts = await prisma.appointment.findMany({ where: { clinicId, status: 'completed', date: { gte: from, lte: to } }, include: { patient: { select: { firstName: true, lastName: true } } } });
    const members = await listClinicStaff(clinicId);
    const expenseAgg = await prisma.expense.aggregate({ where: { clinicId, date: { gte: from, lte: to } }, _sum: { amount: true }, _count: true });
    const expensesByCategory = await prisma.expense.groupBy({ by: ['category'], where: { clinicId, date: { gte: from, lte: to } }, _sum: { amount: true }, _count: true });
    const clinicRow = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
    const commissionBase = (clinicRow?.settings as any)?.payrollBase === 'gross' ? 'gross' : 'net';
    const compensations = await Promise.all(members.map((m) => resolveStaffCompensation(m.userId, clinicId)));
    const payroll = members.map((m, i) => buildDoctorPayroll({ userId: m.userId, name: m.name, role: m.role, percent: compensations[i].commissionPercent, baseSalary: compensations[i].baseSalary, payType: compensations[i].payType, commissionBase, from, to, appointments: completedAppts.filter((a) => a.doctorId === m.userId) })).filter((r) => r.visits > 0 || r.earned > 0 || r.salaryPart > 0).map(({ visitDetails, ...row }) => row).sort((a, b) => b.earned - a.earned);
    const revenue = paid.reduce((s, i) => s + (i.amount || 0), 0);
    const expensesTotal = Number(expenseAgg._sum.amount || 0);
    const payrollTotal = payroll.reduce((s, r) => s + (r.earned || 0), 0);
    res.json({ ok: true, data: {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: { revenue, paidCount: paid.length, unpaid: unpaid.reduce((s, i) => s + (i.amount || 0), 0), unpaidCount: unpaid.length, expenses: expensesTotal, expenseCount: expenseAgg._count || 0, payroll: payrollTotal, profit: revenue - expensesTotal - payrollTotal },
      byDay: Object.entries(byDay).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      byService: Object.entries(byService).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
      byMethod: Object.entries(byMethod).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.revenue - a.revenue),
      expensesByCategory: expensesByCategory.map((r) => ({ category: r.category || 'Прочее', amount: Number(r._sum.amount || 0), count: r._count })).sort((a, b) => b.amount - a.amount),
      payroll,
    }});
  } catch (error) {
    console.error('Billing reports error:', error);
    res.status(500).json({ ok: false, error: 'Failed to build finance report' });
  }
});

export { billingRouter };
