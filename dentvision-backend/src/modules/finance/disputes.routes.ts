import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { reverseCashback } from '../dentcash/refund.service.js';
import { auditFromReq } from '../compliance/audit.service.js';

// Disputes are tied to a concrete commerce object. Creation must prove that
// the authenticated user owns/is a participant in that object; resolution is
// platform-only and must be compare-and-set to prevent double refunds.
export const disputesRouter = Router();
disputesRouter.use(authenticate);

const STATUSES = ['open', 'review', 'resolved', 'rejected'] as const;
const REF_TYPES = ['order', 'enrollment'] as const;

type DisputeStatus = (typeof STATUSES)[number];

export const ALLOWED_DISPUTE_TRANSITIONS: Readonly<Record<DisputeStatus, readonly DisputeStatus[]>> = {
  open: ['review', 'resolved', 'rejected'],
  review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function isAllowedDisputeTransition(from: string, to: string): boolean {
  return (ALLOWED_DISPUTE_TRANSITIONS[from as DisputeStatus] || []).includes(to as DisputeStatus);
}

disputesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { refType, refId, reason } = req.body || {};
    if (!REF_TYPES.includes(refType) || typeof refId !== 'string' || !refId || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ ok: false, error: 'Некорректные данные спора' } satisfies ApiResponse);
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });

    let ownsReference = false;
    if (refType === 'order') {
      const order = await prisma.order.findUnique({
        where: { id: refId },
        select: { id: true, userId: true, clinicId: true },
      });
      ownsReference = !!order && (order.userId === userId || (!!req.user?.clinicId && order.clinicId === req.user.clinicId));
    } else {
      // SchoolEnrollment is user/course scoped in the backend schema and does
      // not expose clinicId. Ownership is therefore restricted to its user.
      const enrollment = await prisma.schoolEnrollment.findUnique({
        where: { id: refId },
        select: { id: true, userId: true },
      });
      ownsReference = !!enrollment && enrollment.userId === userId;
    }

    if (!ownsReference) {
      return res.status(404).json({ ok: false, error: 'Объект для спора не найден' } satisfies ApiResponse);
    }

    const dispute = await prisma.dispute.create({ data: { refType, refId, reason: reason.trim() } });
    await auditFromReq(req, {
      action: 'dispute.created',
      entity: 'dispute',
      entityId: dispute.id,
      details: { refType, refId },
    });
    return res.status(201).json({ ok: true, data: dispute } satisfies ApiResponse);
  } catch (error) {
    console.error('Create dispute error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании спора' } satisfies ApiResponse);
  }
});

// Dispute administration is a platform operation. A clinic finance manager
// must not be able to inspect or resolve disputes across the marketplace.
disputesRouter.get('/', requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const disputes = await prisma.dispute.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({ ok: true, data: disputes } satisfies ApiResponse);
  } catch (error) {
    console.error('List disputes error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении споров' } satisfies ApiResponse);
  }
});

disputesRouter.post('/:id/status', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const status = req.body?.status as DisputeStatus;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Некорректный статус' } satisfies ApiResponse);
    }

    const id = String(req.params.id);
    const existing = await prisma.dispute.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Спор не найден' } satisfies ApiResponse);

    const from = existing.status as DisputeStatus;
    if (!isAllowedDisputeTransition(from, status)) {
      return res.status(409).json({
        ok: false,
        error: `Недопустимый переход статуса: ${from} → ${status}`,
      } satisfies ApiResponse);
    }

    // Every transition is compare-and-set. This prevents a concurrent request
    // from changing the dispute based on a stale `existing` row and makes
    // terminal states immutable at the database-write boundary.
    const claimed = await prisma.dispute.updateMany({
      where: { id, status: from },
      data: { status },
    });
    if (claimed.count !== 1) {
      return res.status(409).json({ ok: false, error: 'Статус спора уже изменён другим запросом' } satisfies ApiResponse);
    }

    const dispute = await prisma.dispute.findUnique({ where: { id } });

    if (status === 'resolved' && existing.refType && existing.refId) {
      try {
        await reverseCashback({
          refType: existing.refType,
          refId: existing.refId,
          reason: 'dispute_resolved',
          callerId: req.user?.id ?? null,
        });
      } catch (e) {
        console.error('Dispute refund failed:', e);
        // The dispute remains resolved; the failed financial action is audited
        // and must be retried through the finance workflow rather than allowing
        // a second HTTP request to trigger another refund.
      }
    }

    await auditFromReq(req, {
      action: 'dispute.status_changed',
      entity: 'dispute',
      entityId: id,
      details: { from, to: status },
    });

    return res.json({ ok: true, data: dispute } satisfies ApiResponse);
  } catch (error) {
    console.error('Update dispute error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении спора' } satisfies ApiResponse);
  }
});

export default disputesRouter;
