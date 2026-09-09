import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { reverseCashback } from '../dentcash/refund.service.js';
import { auditFromReq } from '../compliance/audit.service.js';

// Disputes (Phase 5). Buyers/clinics open disputes on orders/enrollments;
// platform resolves them. Financial resolution (refunds) plugs into Finance Core.
export const disputesRouter = Router();

disputesRouter.use(authenticate);

const STATUSES = ['open', 'review', 'resolved', 'rejected'] as const;
type DisputeStatus = (typeof STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<DisputeStatus, readonly DisputeStatus[]> = {
  open: ['review', 'resolved', 'rejected'],
  review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

function isDisputeStatus(value: unknown): value is DisputeStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

disputesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { refType, refId, reason } = req.body || {};
    if (!refType || !refId || !reason) {
      return res.status(400).json({ ok: false, error: 'refType, refId и reason обязательны' } satisfies ApiResponse);
    }
    const dispute = await prisma.dispute.create({ data: { refType, refId, reason } });
    await auditFromReq(req, {
      action: 'dispute.created',
      entity: 'dispute',
      entityId: dispute.id,
      details: { refType, refId, reason },
    });
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
    const requestedStatus: unknown = req.body?.status;
    if (!isDisputeStatus(requestedStatus)) {
      return res.status(400).json({ ok: false, error: 'Некорректный статус' } satisfies ApiResponse);
    }

    const existing = await prisma.dispute.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Спор не найден' } satisfies ApiResponse);
    }

    // Never reinterpret an unexpected persisted value as a valid state. A corrupt
    // or legacy status must fail closed rather than gaining the permissions of "open".
    if (!isDisputeStatus(existing.status)) {
      console.error('Invalid persisted dispute status:', { id: existing.id, status: existing.status });
      return res.status(500).json({ ok: false, error: 'Некорректное состояние спора в базе данных' } satisfies ApiResponse);
    }

    const currentStatus = existing.status;
    if (!ALLOWED_TRANSITIONS[currentStatus].includes(requestedStatus)) {
      return res.status(409).json({
        ok: false,
        error: `Недопустимый переход статуса: ${currentStatus} -> ${requestedStatus}`,
      } satisfies ApiResponse);
    }

    // Compare-and-set prevents a stale request from overwriting a concurrent transition.
    const updated = await prisma.dispute.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status: requestedStatus },
    });
    if (updated.count !== 1) {
      return res.status(409).json({ ok: false, error: 'Спор уже изменён другим запросом' } satisfies ApiResponse);
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: existing.id } });
    if (!dispute) {
      return res.status(404).json({ ok: false, error: 'Спор не найден после обновления' } satisfies ApiResponse);
    }

    // Trigger refund when dispute is resolved in favour of the buyer.
    if (requestedStatus === 'resolved' && existing.refType && existing.refId) {
      try {
        await reverseCashback({
          refType: existing.refType,
          refId: existing.refId,
          reason: 'dispute_resolved',
        });
      } catch (error) {
        console.error('Dispute refund failed:', error);
      }
    }

    await auditFromReq(req, {
      action: 'dispute.status_changed',
      entity: 'dispute',
      entityId: dispute.id,
      details: { from: existing.status, to: requestedStatus },
    });

    return res.json({ ok: true, data: dispute } satisfies ApiResponse);
  } catch (error) {
    console.error('Update dispute error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении спора' } satisfies ApiResponse);
  }
});

export default disputesRouter;
