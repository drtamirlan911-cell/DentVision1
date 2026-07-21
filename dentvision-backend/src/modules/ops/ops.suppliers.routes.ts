import { Router } from 'express';
import { SupplierStatus } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePlatformOps } from '../../middleware/platformOps.js';
import { publish } from '../../lib/events.js';
import { paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

/**
 * Hidden platform ops — supplier governance.
 * Mounted at /api/ops/suppliers. Not linked from any public UI.
 * Requires SUPERADMIN + X-Platform-Ops-Key (see requirePlatformOps).
 */
export const opsSuppliersRouter = Router();

opsSuppliersRouter.use(authenticate);
opsSuppliersRouter.use(requirePlatformOps);

const STATUS_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  PENDING: ['DOCUMENTS_REVIEW', 'SUSPENDED'],
  DOCUMENTS_REVIEW: ['VERIFIED', 'PENDING', 'SUSPENDED'],
  VERIFIED: ['OFFICIAL_PARTNER', 'SUSPENDED'],
  OFFICIAL_PARTNER: ['SUSPENDED'],
  SUSPENDED: ['VERIFIED', 'PENDING'],
};

opsSuppliersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const { skip, take } = paginate(page, limit);
    const { status, search } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' as const };

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { products: true, documents: true, members: true } },
          members: { select: { userId: true, role: true, createdAt: true } },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return res.json({ ok: true, data: paginatedResponse(data, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('Ops list suppliers error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

opsSuppliersRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id as string },
      include: {
        documents: true,
        members: true,
        _count: { select: { products: true } },
      },
    });
    if (!supplier) return res.status(404).json({ ok: false, error: 'Not found' } satisfies ApiResponse);
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

opsSuppliersRouter.post('/:id/status', async (req: AuthRequest, res) => {
  try {
    const target = req.body?.status as SupplierStatus | undefined;
    if (!target || !(target in STATUS_TRANSITIONS)) {
      return res.status(400).json({ ok: false, error: 'Некорректный статус' } satisfies ApiResponse);
    }
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' } satisfies ApiResponse);
    if (existing.status === target) {
      return res.json({ ok: true, data: existing } satisfies ApiResponse);
    }
    const allowed = STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(target)) {
      return res.status(409).json({
        ok: false,
        error: `Недопустимый переход: ${existing.status} → ${target}`,
      } satisfies ApiResponse);
    }
    const supplier = await prisma.supplier.update({
      where: { id: existing.id },
      data: { status: target },
    });
    publish('supplier.status_changed', {
      supplierId: supplier.id,
      from: existing.status,
      to: target,
      userId: req.user?.id,
    });
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Ops supplier status error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

opsSuppliersRouter.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const { userId, email, role } = req.body || {};
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!supplier) return res.status(404).json({ ok: false, error: 'Not found' } satisfies ApiResponse);

    let resolvedUserId = userId as string | undefined;
    if (!resolvedUserId && email) {
      const u = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase().trim() },
        select: { id: true },
      });
      if (!u) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
      resolvedUserId = u.id;
    }
    if (!resolvedUserId) {
      return res.status(400).json({ ok: false, error: 'userId или email обязателен' } satisfies ApiResponse);
    }

    const member = await prisma.supplierMember.upsert({
      where: { userId_supplierId: { userId: resolvedUserId, supplierId: supplier.id } },
      create: { userId: resolvedUserId, supplierId: supplier.id, role: role || 'owner' },
      update: { role: role || 'owner' },
    });
    return res.status(201).json({ ok: true, data: member } satisfies ApiResponse);
  } catch (error) {
    console.error('Ops add member error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

export default opsSuppliersRouter;
