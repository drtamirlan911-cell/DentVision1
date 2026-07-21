import { Router } from 'express';
import { SupplierStatus } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { publish } from '../../lib/events.js';
import { paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shop Governance — Suppliers (Phase 2, DENTVISION_V2_INTEGRATION_PLAN.md §5.1).
// Platform-managed supplier registry + verification pipeline. Reads are open to
// any authenticated user (marketplace); writes require `supplier.manage`
// (platform / SUPERADMIN today).
// ─────────────────────────────────────────────────────────────────────────────
export const suppliersRouter = Router();

suppliersRouter.use(authenticate);

// Allowed verification-status transitions (state machine).
const STATUS_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  PENDING: ['DOCUMENTS_REVIEW', 'SUSPENDED'],
  DOCUMENTS_REVIEW: ['VERIFIED', 'PENDING', 'SUSPENDED'],
  VERIFIED: ['OFFICIAL_PARTNER', 'SUSPENDED'],
  OFFICIAL_PARTNER: ['SUSPENDED'],
  SUSPENDED: ['VERIFIED', 'PENDING'],
};

// GET /api/suppliers — list (filter by status/kind).
suppliersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const { skip, take } = paginate(page, limit);
    const { status, kind, search } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (kind) where.kind = kind;
    if (search) where.name = { contains: search, mode: 'insensitive' as const };

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true, documents: true } } },
      }),
      prisma.supplier.count({ where }),
    ]);

    return res.json({ ok: true, data: paginatedResponse(data, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('List suppliers error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении поставщиков' } satisfies ApiResponse);
  }
});

// POST /api/suppliers/register — self-serve: create supplier company + owner membership.
// Must be registered BEFORE /:id routes.
suppliersRouter.post('/register', async (req: AuthRequest, res) => {
  try {
    const { name, kind, bin, legalAddress, contactPerson, phone, email } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, error: 'Название компании обязательно' } satisfies ApiResponse);
    }

    const existing = await prisma.supplierMember.findFirst({ where: { userId: req.user!.id } });
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: 'Вы уже привязаны к поставщику. Откройте кабинет продавца.',
        data: { supplierId: existing.supplierId },
      } satisfies ApiResponse);
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: String(name).trim(),
        kind: kind || 'SUPPLIER',
        bin: bin || null,
        legalAddress: legalAddress || null,
        contactPerson: contactPerson || [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || null,
        phone: phone || req.user!.email || null,
        email: email || req.user!.email || null,
        status: 'PENDING',
        members: {
          create: { userId: req.user!.id, role: 'owner' },
        },
      },
      include: { members: true },
    });

    publish('supplier.status_changed', {
      supplierId: supplier.id,
      from: 'PENDING',
      to: 'PENDING',
      userId: req.user?.id,
    });

    return res.status(201).json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier register error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось зарегистрировать поставщика' } satisfies ApiResponse);
  }
});

// GET /api/suppliers/:id — detail with documents.
suppliersRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id as string },
      include: { documents: true, _count: { select: { products: true } } },
    });
    if (!supplier) {
      return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Get supplier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении поставщика' } satisfies ApiResponse);
  }
});

// POST /api/suppliers — create (platform).
suppliersRouter.post('/', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, kind, bin, legalAddress, contactPerson, phone, email } = req.body || {};
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Название обязательно' } satisfies ApiResponse);
    }
    const supplier = await prisma.supplier.create({
      data: {
        name,
        kind: kind || 'SUPPLIER',
        bin: bin || null,
        legalAddress: legalAddress || null,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
      },
    });
    return res.status(201).json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании поставщика' } satisfies ApiResponse);
  }
});

// PATCH /api/suppliers/:id — update profile (platform).
suppliersRouter.patch('/:id', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    }
    const b = req.body || {};
    const supplier = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.kind !== undefined && { kind: b.kind }),
        ...(b.bin !== undefined && { bin: b.bin || null }),
        ...(b.legalAddress !== undefined && { legalAddress: b.legalAddress || null }),
        ...(b.contactPerson !== undefined && { contactPerson: b.contactPerson || null }),
        ...(b.phone !== undefined && { phone: b.phone || null }),
        ...(b.email !== undefined && { email: b.email || null }),
      },
    });
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Update supplier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении поставщика' } satisfies ApiResponse);
  }
});

// POST /api/suppliers/:id/status — verification pipeline transition (platform).
suppliersRouter.post('/:id/status', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  try {
    const target = req.body?.status as SupplierStatus | undefined;
    if (!target || !(target in STATUS_TRANSITIONS)) {
      return res.status(400).json({ ok: false, error: 'Некорректный статус' } satisfies ApiResponse);
    }
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    }
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
    console.error('Supplier status error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при смене статуса' } satisfies ApiResponse);
  }
});

// GET /api/suppliers/:id/members — list members (platform).
suppliersRouter.get('/:id/members', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  const members = await prisma.supplierMember.findMany({
    where: { supplierId: req.params.id as string },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ ok: true, data: members } satisfies ApiResponse);
});

// POST /api/suppliers/:id/members — link a user to the supplier (platform).
// Body: { userId? , email?, role? } — resolve by email if userId omitted.
suppliersRouter.post('/:id/members', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  try {
    const { userId, email, role } = req.body || {};
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!supplier) {
      return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    }

    let resolvedUserId = userId as string | undefined;
    if (!resolvedUserId && email) {
      const u = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() }, select: { id: true } });
      if (!u) return res.status(404).json({ ok: false, error: 'Пользователь с таким email не найден' } satisfies ApiResponse);
      resolvedUserId = u.id;
    }
    if (!resolvedUserId) {
      return res.status(400).json({ ok: false, error: 'userId или email обязателен' } satisfies ApiResponse);
    }

    const user = await prisma.user.findUnique({ where: { id: resolvedUserId }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
    }

    const member = await prisma.supplierMember.upsert({
      where: { userId_supplierId: { userId: resolvedUserId, supplierId: supplier.id } },
      create: { userId: resolvedUserId, supplierId: supplier.id, role: role || 'owner' },
      update: { role: role || 'owner' },
    });
    return res.status(201).json({ ok: true, data: member } satisfies ApiResponse);
  } catch (error) {
    console.error('Add supplier member error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при добавлении участника' } satisfies ApiResponse);
  }
});

// DELETE /api/suppliers/:id/members/:userId — unlink (platform).
suppliersRouter.delete('/:id/members/:userId', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  try {
    await prisma.supplierMember.delete({
      where: {
        userId_supplierId: {
          userId: req.params.userId as string,
          supplierId: req.params.id as string,
        },
      },
    });
    return res.json({ ok: true, data: { ok: true } } satisfies ApiResponse);
  } catch {
    return res.status(404).json({ ok: false, error: 'Участник не найден' } satisfies ApiResponse);
  }
});

// POST /api/suppliers/:id/documents — attach a document (platform).
suppliersRouter.post('/:id/documents', requirePermission('supplier.manage'), async (req: AuthRequest, res) => {
  try {
    const { type, url } = req.body || {};
    if (!type || !url) {
      return res.status(400).json({ ok: false, error: 'type и url обязательны' } satisfies ApiResponse);
    }
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!supplier) {
      return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    }
    const doc = await prisma.supplierDocument.create({
      data: { supplierId: supplier.id, type, url },
    });
    return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier document error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при добавлении документа' } satisfies ApiResponse);
  }
});

export default suppliersRouter;
