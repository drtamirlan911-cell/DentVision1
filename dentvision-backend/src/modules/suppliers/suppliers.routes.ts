import { Router } from 'express';
import { SupplierStatus } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requirePlatformOps } from '../../middleware/platformOps.js';
import { publish } from '../../lib/events.js';
import { paginate, paginatedResponse, uid } from '../../lib/helpers.js';
import { ensureLegalTrustPackage } from '../legal/legal.trust.service.js';
import { syncPersonFromSupplierMember, removePersonFromSupplierMember } from '../../lib/syncMembership.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shop Governance — Suppliers (Phase 2, DENTVISION_V2_INTEGRATION_PLAN.md §5.1).
// Platform-managed supplier registry + verification pipeline. Reads are open to
// any authenticated user (marketplace); writes require `supplier.manage` AND
// the SUPERADMIN role (see requirePlatformOps — no request header is checked).
// Prefer /api/ops/suppliers for governance. Self-serve register stays open.
// ─────────────────────────────────────────────────────────────────────────────
export const suppliersRouter = Router();

suppliersRouter.use(authenticate);

const STATUS_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  pending: ['documents_review', 'suspended'],
  documents_review: ['verified', 'pending', 'suspended'],
  verified: ['official_partner', 'suspended'],
  official_partner: ['verified', 'suspended'],
  suspended: ['verified', 'pending'],
};

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

// Legal identity is scoped to the supplier organization, not globally to the user.
// This allows one account to own or operate multiple supplier companies safely.
async function ensureSupplierLegalPartner(
  supplier: { name: string; bin?: string | null; legalAddress?: string | null; contactPerson?: string | null; phone?: string | null; email?: string | null },
  userId: string,
  organizationId: string,
) {
  try {
    return await ensureLegalTrustPackage({
      userId,
      organizationId,
      type: 'SUPPLIER',
      legalName: supplier.name || '',
      bin: supplier.bin || '',
      director: supplier.contactPerson || '',
      address: supplier.legalAddress || '',
      iban: '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      commission: 10,
    });
  } catch (e) {
    console.warn('[SUPPLIER] Legal partner onboarding failed (non-fatal):', (e as Error).message);
    return null;
  }
}

// POST /api/suppliers/register — self-serve: create supplier company + owner membership.
suppliersRouter.post('/register', async (req: AuthRequest, res) => {
  try {
    const { name, kind, bin, legalAddress, contactPerson, phone, email } = req.body || {};
    const supplierName = String(name || '').trim();
    if (!supplierName) {
      return res.status(400).json({ ok: false, error: 'Название компании обязательно' } satisfies ApiResponse);
    }

    // A user may operate multiple supplier organizations. Only prevent an exact
    // duplicate membership for the same supplier name; do not block other orgs.
    const existing = await prisma.supplierMember.findFirst({
      where: { userId: req.user!.id, supplier: { name: supplierName } },
      include: { supplier: true },
    });
    if (existing) {
      const existingOrg = await prisma.organization.findUnique({
        where: { originalType_originalId: { originalType: 'Supplier', originalId: existing.supplierId } },
      });
      if (existingOrg) await ensureSupplierLegalPartner(existing.supplier, req.user!.id, existingOrg.id);
      return res.status(409).json({
        ok: false,
        error: 'Вы уже привязаны к этому поставщику. Откройте кабинет продавца.',
        data: { supplierId: existing.supplierId, organizationId: existingOrg?.id },
      } satisfies ApiResponse);
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: supplierName,
        kind: kind || 'SUPPLIER',
        bin: bin || null,
        legalAddress: legalAddress || null,
        contactPerson: contactPerson || [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || null,
        phone: phone || req.user!.email || null,
        email: email || req.user!.email || null,
        status: 'pending',
        commissionRate: 1000,
        members: { create: { userId: req.user!.id, role: 'owner' } },
      },
      include: { members: true },
    });

    const organization = await prisma.organization.upsert({
      where: { originalType_originalId: { originalType: 'Supplier', originalId: supplier.id } },
      update: { name: supplier.name, phone: supplier.phone, email: supplier.email },
      create: {
        id: uid(),
        name: supplier.name,
        type: 'SUPPLIER_COMPANY',
        phone: supplier.phone,
        email: supplier.email,
        originalType: 'Supplier',
        originalId: supplier.id,
      },
    });

    await ensureSupplierLegalPartner(supplier, req.user!.id, organization.id);

    const ownerMember = supplier.members[0];
    if (ownerMember) await syncPersonFromSupplierMember(ownerMember.id, supplier.id, req.user!.id);

    try {
      const dvSupplier = await prisma.supplier.findFirst({ where: { name: 'DentVision' } });
      const existingCount = dvSupplier ? await prisma.product.count({ where: { supplierId: supplier.id } }) : 0;
      if (dvSupplier && existingCount === 0) {
        const dvProducts = await prisma.product.findMany({ where: { supplierId: dvSupplier.id, isActive: true }, take: 200 });
        if (dvProducts.length > 0) {
          await prisma.product.createMany({
            data: dvProducts.map((p) => ({
              id: uid(), name: p.name, brand: p.brand, category: p.category, categoryId: p.categoryId,
              price: p.price, oldPrice: p.oldPrice, stock: p.stock, minStock: p.minStock,
              description: p.description, imageUrl: p.imageUrl, images: p.images, rating: p.rating,
              reviewCount: 0, supplierId: supplier.id, ownBrand: false, sku: p.sku, unit: p.unit,
              currency: p.currency, tags: p.tags, specs: p.specs, manufacturer: p.manufacturer,
              country: p.country, compatibility: p.compatibility, isActive: true,
              sharedProductId: p.sharedProductId || p.id,
            })),
          });
          console.log(`[SUPPLIER] ${supplier.name}: duplicated ${dvProducts.length} starter products`);
        }
      }
    } catch (e) {
      console.warn('[SUPPLIER] Starter catalog duplication failed (non-fatal):', e);
    }

    publish('supplier.status_changed', {
      supplierId: supplier.id, status: 'pending', from: 'pending', to: 'pending',
      userId: req.user?.id,
    });

    return res.status(201).json({ ok: true, data: { ...supplier, organizationId: organization.id } } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier register error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось зарегистрировать поставщика' } satisfies ApiResponse);
  }
});

suppliersRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id as string },
      include: { documents: true, _count: { select: { products: true } } },
    });
    if (!supplier) return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Get supplier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении поставщика' } satisfies ApiResponse);
  }
});

suppliersRouter.post('/', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  try {
    const { name, kind, bin, legalAddress, contactPerson, phone, email } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' } satisfies ApiResponse);
    const supplier = await prisma.supplier.create({
      data: { name, kind: kind || 'SUPPLIER', bin: bin || null, legalAddress: legalAddress || null, contactPerson: contactPerson || null, phone: phone || null, email: email || null },
    });
    await prisma.organization.upsert({
      where: { originalType_originalId: { originalType: 'Supplier', originalId: supplier.id } },
      update: { name: supplier.name, phone: supplier.phone, email: supplier.email },
      create: { id: uid(), name: supplier.name, type: 'SUPPLIER_COMPANY', phone: supplier.phone, email: supplier.email, originalType: 'Supplier', originalId: supplier.id },
    });
    return res.status(201).json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании поставщика' } satisfies ApiResponse);
  }
});

suppliersRouter.patch('/:id', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    const b = req.body || {};
    const supplier = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined && { name: b.name }), ...(b.kind !== undefined && { kind: b.kind }),
        ...(b.bin !== undefined && { bin: b.bin || null }), ...(b.legalAddress !== undefined && { legalAddress: b.legalAddress || null }),
        ...(b.contactPerson !== undefined && { contactPerson: b.contactPerson || null }), ...(b.phone !== undefined && { phone: b.phone || null }),
        ...(b.email !== undefined && { email: b.email || null }),
      },
    });
    await prisma.organization.upsert({
      where: { originalType_originalId: { originalType: 'Supplier', originalId: supplier.id } },
      update: { name: supplier.name, phone: supplier.phone, email: supplier.email },
      create: { id: uid(), name: supplier.name, type: 'SUPPLIER_COMPANY', phone: supplier.phone, email: supplier.email, originalType: 'Supplier', originalId: supplier.id },
    });
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Update supplier error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении поставщика' } satisfies ApiResponse);
  }
});

suppliersRouter.post('/:id/status', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  try {
    const target = req.body?.status as SupplierStatus | undefined;
    if (!target || !(target in STATUS_TRANSITIONS)) return res.status(400).json({ ok: false, error: 'Некорректный статус' } satisfies ApiResponse);
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    if (existing.status === target) return res.json({ ok: true, data: existing } satisfies ApiResponse);
    const allowed = STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(target)) return res.status(409).json({ ok: false, error: `Недопустимый переход: ${existing.status} → ${target}` } satisfies ApiResponse);
    const supplier = await prisma.supplier.update({ where: { id: existing.id }, data: { status: target } });
    publish('supplier.status_changed', { supplierId: supplier.id, status: target, from: existing.status, to: target, userId: req.user?.id });
    return res.json({ ok: true, data: supplier } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier status error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при смене статуса' } satisfies ApiResponse);
  }
});

suppliersRouter.get('/:id/members', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  const members = await prisma.supplierMember.findMany({ where: { supplierId: req.params.id as string }, orderBy: { createdAt: 'asc' } });
  return res.json({ ok: true, data: members } satisfies ApiResponse);
});

suppliersRouter.post('/:id/members', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  try {
    const { userId, email, role } = req.body || {};
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!supplier) return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    let resolvedUserId = userId as string | undefined;
    if (!resolvedUserId && email) {
      const u = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() }, select: { id: true } });
      if (!u) return res.status(404).json({ ok: false, error: 'Пользователь с таким email не найден' } satisfies ApiResponse);
      resolvedUserId = u.id;
    }
    if (!resolvedUserId) return res.status(400).json({ ok: false, error: 'userId или email обязателен' } satisfies ApiResponse);
    const user = await prisma.user.findUnique({ where: { id: resolvedUserId }, select: { id: true } });
    if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
    const member = await prisma.supplierMember.upsert({
      where: { userId_supplierId: { userId: resolvedUserId, supplierId: supplier.id } },
      create: { userId: resolvedUserId, supplierId: supplier.id, role: role || 'owner' },
      update: { role: role || 'owner' },
    });
    await syncPersonFromSupplierMember(member.id, supplier.id, resolvedUserId);
    return res.status(201).json({ ok: true, data: member } satisfies ApiResponse);
  } catch (error) {
    console.error('Add supplier member error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при добавлении участника' } satisfies ApiResponse);
  }
});

suppliersRouter.delete('/:id/members/:userId', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  try {
    const deleted = await prisma.supplierMember.delete({ where: { userId_supplierId: { userId: req.params.userId as string, supplierId: req.params.id as string } } });
    await removePersonFromSupplierMember(deleted.id);
    return res.json({ ok: true, data: { ok: true } } satisfies ApiResponse);
  } catch {
    return res.status(404).json({ ok: false, error: 'Участник не найден' } satisfies ApiResponse);
  }
});

suppliersRouter.post('/:id/documents', requirePermission('supplier.manage'), requirePlatformOps, async (req: AuthRequest, res) => {
  try {
    const { type, url } = req.body || {};
    if (!type || !url) return res.status(400).json({ ok: false, error: 'type и url обязательны' } satisfies ApiResponse);
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id as string } });
    if (!supplier) return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
    const doc = await prisma.supplierDocument.create({ data: { supplierId: supplier.id, type, url } });
    return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier document error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при добавлении документа' } satisfies ApiResponse);
  }
});

export default suppliersRouter;
