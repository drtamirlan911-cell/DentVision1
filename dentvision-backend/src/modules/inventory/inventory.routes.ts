import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

const inventoryRouter = Router();

inventoryRouter.use(authenticate);

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

inventoryRouter.post('/', async (req: AuthRequest, res) => {
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

    const item = await prisma.inventoryItem.create({
      data: {
        id: uid(),
        name,
        clinicId,
        category: category || null,
        quantity,
        minimum: minimum || 0,
        price: price || 0,
        unit: unit || null,
        supplier: supplier || null,
      },
    });

    res.status(201).json({ ok: true, data: item });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create inventory item' });
  }
});

inventoryRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name, category, quantity, minimum, price, unit, supplier } = req.body;

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(quantity !== undefined && { quantity }),
        ...(minimum !== undefined && { minimum }),
        ...(price !== undefined && { price }),
        ...(unit !== undefined && { unit }),
        ...(supplier !== undefined && { supplier }),
      },
    });

    res.json({ ok: true, data: item });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update inventory item' });
  }
});

inventoryRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    await prisma.inventoryItem.delete({ where: { id } });

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
