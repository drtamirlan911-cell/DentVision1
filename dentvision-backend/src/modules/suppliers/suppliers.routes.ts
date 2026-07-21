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
      status: target,
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
