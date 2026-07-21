import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';

const shopRouter = Router();

shopRouter.get('/products', async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { skip, take } = paginate(page, limit);

    const where: Record<string, unknown> = {};

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true, status: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const mapped = products.map((p) => ({
      ...p,
      supplier_name: p.supplier?.name || null,
      supplier_status: p.supplier?.status || null,
      category_name: p.category || 'Прочее',
      category_id: p.category || 'other',
      brand: p.brand || '',
      rating: p.rating ?? 4.5,
      review_count: 0,
      min_stock: 5,
      old_price: null,
    }));

    // Always return plain array for frontend compatibility
    res.json({ ok: true, data: mapped });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch products' });
  }
});

shopRouter.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      res.status(404).json({ ok: false, error: 'Product not found' });
      return;
    }

    res.json({ ok: true, data: product });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch product' });
  }
});

shopRouter.post('/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const { items, total } = req.body;
    const clinicId = req.user?.clinicId;

    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic context is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ ok: false, error: 'items array is required' });
      return;
    }

    if (total === undefined || total === null || typeof total !== 'number' || total < 0) {
      res.status(400).json({ ok: false, error: 'A valid total is required' });
      return;
    }

    const order = await prisma.order.create({
      data: {
        id: uid(),
        clinicId,
        userId: req.user!.id,
        items,
        total,
        status: 'pending',
      },
    });

    res.status(201).json({ ok: true, data: order });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create order' });
  }
});

shopRouter.get('/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { skip, take } = paginate(page, limit);

    const where = { userId };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ ok: true, data: paginatedResponse(orders, total, page, limit) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch orders' });
  }
});

shopRouter.post('/favorites', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user!.id;

    if (!productId) {
      res.status(400).json({ ok: false, error: 'productId is required' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ ok: false, error: 'Product not found' });
      return;
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      res.json({ ok: true, data: { favorited: false } });
      return;
    }

    const favorite = await prisma.favorite.create({
      data: {
        id: uid(),
        userId,
        productId,
      },
    });

    res.status(201).json({ ok: true, data: { favorited: true, id: favorite.id } });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to toggle favorite' });
  }
});

shopRouter.get('/favorites', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: favorites });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch favorites' });
  }
});

shopRouter.get('/categories', async (_req, res) => {
  try {
    const rows = await prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    const categories = rows
      .map((r) => r.category)
      .filter(Boolean)
      .map((name) => ({ id: String(name), name: String(name), icon: 'package' }));
    res.json({ ok: true, data: categories });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch categories' });
  }
});

shopRouter.get('/suppliers', async (_req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { status: { in: ['VERIFIED', 'OFFICIAL_PARTNER', 'PENDING'] } },
      include: {
        _count: { select: { products: true } },
        products: { select: { rating: true }, take: 50 },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
    const data = suppliers.map((s) => {
      const ratings = s.products.map((p) => p.rating).filter((r): r is number => r != null);
      const rating = ratings.length
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : 4.8;
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        rating,
        product_count: s._count.products,
        city: null,
        delivery_days: 2,
      };
    });
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch suppliers' });
  }
});

export { shopRouter };
