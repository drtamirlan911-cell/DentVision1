import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { reverseCashback } from '../dentcash/refund.service.js';

// Disputes (Phase 5). Buyers/clinics open disputes on orders/enrollments;
// platform resolves them. Financial resolution (refunds) plugs into Finance Core.
export const disputesRouter = Router();

disputesRouter.use(authenticate);

const STATUSES = ['open', 'review', 'resolved', 'rejected'];

disputesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { refType, refId, reason } = req.body || {};
    if (!refType || !refId || !reason) {
      return res.status(400).json({ ok: false, error: 'refType, refId и reason обязательны' } satisfies ApiResponse);
    }
    const dispute = await prisma.dispute.create({ data: { refType, refId, reason } });
    return res.status(201).json({ ok: true, data: dispute } satisfies ApiResponse);
  } catch (error) {
    console.error('Create dispute error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании спора' } satisfies ApiResponse);
  }
});

disputesRouter.get('/', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  const disputes = await prisma.dispute.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return res.json({ ok: true, data: disputes } satisfies ApiResponse);
});

disputesRouter.post('/:id/status', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Некорректный статус' } satisfies ApiResponse);
    }
    const existing = await prisma.dispute.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Спор не найден' } satisfies ApiResponse);
    }
    const dispute = await prisma.dispute.update({ where: { id: existing.id }, data: { status } });

    // Trigger refund when dispute is resolved in favour of the buyer
    if (status === 'resolved' && existing.refType && existing.refId) {
      try {
        await reverseCashback(existing.refType, existing.refId);
      } catch (e) {
        console.error('Dispute refund failed:', e);
      }
    }

    return res.json({ ok: true, data: dispute } satisfies ApiResponse);
  } catch (error) {
    console.error('Update dispute error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении спора' } satisfies ApiResponse);
  }
});

export default disputesRouter;
