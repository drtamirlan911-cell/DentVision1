import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';

const inventoryRouter = Router();

/** Coerce a numeric field, rejecting NaN and negatives. Returns undefined to skip. */
function nonNegativeNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return NaN; // NaN signals invalid to caller
  return n;
}

inventoryRouter.use(authenticate);
inventoryRouter.use(loadClinicAccess);
inventoryRouter.use(blockClinicWrites);

inventoryRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { q, category } = req.query;
    const clinicId = user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    const where: any = { clinicId };

    if (q && typeof q === 'string') {
      where.OR = [
        { name: { contains: q } },
        { supplier: { contains: q } },
      ];
    }

    if (category && typeof category === 'string') {
      where.category = category;
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({ ok: true, data: items });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch inventory items' });
  }
});

inventoryRouter.post('/', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { name, category, quantity, minimum, price, unit, supplier } = req.body;
    const clinicId = user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    if (!name || quantity === undefined) {
      res.status(400).json({ ok: false, error: 'name and quantity are required' });
      return;
    }

    const qty = nonNegativeNumber(quantity);
    const min = nonNegativeNumber(minimum);
    const prc = nonNegativeNumber(price);
    if (Number.isNaN(qty) || Number.isNaN(min) || Number.isNaN(prc)) {
      res.status(400).json({ ok: false, error: 'quantity, minimum и price должны быть числом ≥ 0' });
      return;
    }

    const item = await prisma.inventoryItem.create({
      data: {
        id: uid(),
        name,
        clinicId,
        category: category || null,
        quantity: qty ?? 0,
        minimum: min ?? 0,
        price: prc ?? 0,
        unit: unit || null,
        supplier: supplier || null,
      },
    });

    res.status(201).json({ ok: true, data: item });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create inventory item' });
  }
});

inventoryRouter.patch('/:id', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }
    const { name, category, quantity, minimum, price, unit, supplier } = req.body;

    // Tenant scope: the item must belong to the caller's clinic (prevents cross-clinic IDOR).
    const existing = await prisma.inventoryItem.findFirst({ where: { id, clinicId }, select: { id: true } });
    if (!existing) {
      res.status(404).json({ ok: false, error: 'Позиция склада не найдена' });
      return;
    }

    const qty = nonNegativeNumber(quantity);
    const min = nonNegativeNumber(minimum);
    const prc = nonNegativeNumber(price);
    if (Number.isNaN(qty) || Number.isNaN(min) || Number.isNaN(prc)) {
      res.status(400).json({ ok: false, error: 'quantity, minimum и price должны быть числом ≥ 0' });
      return;
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(qty !== undefined && { quantity: qty }),
        ...(min !== undefined && { minimum: min }),
        ...(prc !== undefined && { price: prc }),
        ...(unit !== undefined && { unit }),
        ...(supplier !== undefined && { supplier }),
      },
    });

    res.json({ ok: true, data: item });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update inventory item' });
  }
});

inventoryRouter.delete('/:id', requirePermission('inventory.delete'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    // Tenant scope: only delete when the item belongs to the caller's clinic.
    const result = await prisma.inventoryItem.deleteMany({ where: { id, clinicId } });
    if (result.count === 0) {
      res.status(404).json({ ok: false, error: 'Позиция склада не найдена' });
      return;
    }

    res.json({ ok: true, data: null });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to delete inventory item' });
  }
});

inventoryRouter.get('/low-stock', async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const clinicId = user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }

    const allItems = await prisma.inventoryItem.findMany({
      where: { clinicId },
    });

    const lowStockItems = allItems.filter((item) => item.quantity <= item.minimum);

    res.json({ ok: true, data: lowStockItems });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch low stock items' });
  }
});

export { inventoryRouter };
