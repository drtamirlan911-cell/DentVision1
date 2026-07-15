// ═══════════════════════════════════════════════════════════════
// Shop Routes — marketplace products, orders, reviews, favorites
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireSameClinic } from '../middleware/rbac.js';
import { requireServiceAccess } from '../middleware/serviceAccess.js';
import { createNotification } from '../lib/notifications.js';
import prisma from '../lib/prisma.js';

export default function shopRoutes() {
  const router = Router();

  // ─── Categories (public read) ───
  router.get('/categories', async (_req, res) => {
    try {
      const result = await prisma.shopCategory.findMany({ orderBy: { sortOrder: 'asc' } });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Products (public read) ───
  router.get('/products', async (req, res) => {
    try {
      const { category, search, sort, min_price, max_price, brand } = req.query;
      const where = {};
      if (category) where.categoryId = category;
      if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
      if (min_price) where.price = { ...(where.price || {}), gte: Number(min_price) };
      if (max_price) where.price = { ...(where.price || {}), lte: Number(max_price) };
      if (brand) where.brand = { equals: brand, mode: 'insensitive' };

      let orderBy = { rating: 'desc' };
      if (sort === 'price_asc') orderBy = { price: 'asc' };
      else if (sort === 'price_desc') orderBy = { price: 'desc' };
      else if (sort === 'rating') orderBy = { rating: 'desc' };
      else if (sort === 'newest') orderBy = { createdAt: 'desc' };

      const result = await prisma.shopProduct.findMany({
        where,
        include: { category: { select: { name: true } }, supplier: { select: { name: true, country: true } } },
        orderBy,
      });
      res.json(result.map(p => ({ ...p, category_name: p.category?.name, supplier_name: p.supplier?.name, supplier_country: p.supplier?.country })));
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/products/:id', async (req, res) => {
    try {
      const product = await prisma.shopProduct.findUnique({
        where: { id: req.params.id },
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true, country: true, deliveryDays: true, deliveryCost: true, freeDeliveryFrom: true } },
          reviews: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!product) return res.status(404).json({ error: 'Not found' });
      const related = await prisma.shopProduct.findMany({
        where: { categoryId: product.categoryId, id: { not: req.params.id } },
        take: 6,
      });
      res.json({
        ...product,
        category_name: product.category?.name,
        supplier_name: product.supplier?.name,
        supplier_country: product.supplier?.country,
        delivery_days: product.supplier?.deliveryDays,
        delivery_cost: product.supplier?.deliveryCost,
        free_delivery_from: product.supplier?.freeDeliveryFrom,
        related,
      });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/suppliers', async (_req, res) => {
    try {
      const result = await prisma.shopSupplier.findMany({ orderBy: { name: 'asc' } });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Orders (authenticated) ───
  router.post('/orders', authenticate, requireSameClinic, requireServiceAccess('shop'), async (req, res) => {
    try {
      const { clinic_id, items, delivery_address, delivery_method, payment_method, notes } = req.body;
      if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });
      const orderId = crypto.randomUUID();
      let total = 0;
      const orderItems = [];
      for (const item of items) {
        const prod = await prisma.shopProduct.findUnique({ where: { id: item.product_id } });
        if (!prod) continue;
        const itemTotal = Number(prod.price) * item.quantity;
        total += itemTotal;
        orderItems.push({ id: crypto.randomUUID(), orderId, productId: item.product_id, productName: prod.name, quantity: item.quantity, price: prod.price, total: itemTotal });
      }
      const deliveryCost = total >= 50000 ? 0 : 2500;
      await prisma.shopOrder.create({
        data: {
          id: orderId, clinicId: clinic_id, userId: req.user.id, userName: req.user.name,
          total: total + deliveryCost, deliveryAddress: delivery_address, deliveryMethod: delivery_method,
          deliveryCost, paymentMethod: payment_method, notes,
          items: { create: orderItems },
        },
      });
      for (const item of orderItems) {
        await prisma.shopProduct.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }
      // Push to the unified Notification Center (clinic-wide)
      await createNotification({
        type: 'shop',
        category: 'order',
        clinicId: clinic_id,
        title: 'Новый заказ в Магазине',
        message: `Заказ #${orderId.slice(0, 8)} на сумму ${(total + deliveryCost).toLocaleString('ru-RU')} ₸ сформирован`,
        actionUrl: '/shop',
      });
      res.json({ id: orderId, total: total + deliveryCost, items: orderItems });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/orders', authenticate, requireSameClinic, requireServiceAccess('shop'), async (req, res) => {
    try {
      const { clinic_id } = req.query;
      const where = clinic_id ? { clinicId: clinic_id } : {};
      const result = await prisma.shopOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(result);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Reviews (authenticated) ───
  router.post('/reviews', authenticate, requireServiceAccess('shop'), async (req, res) => {
    try {
      const { product_id, pros, cons, comment, rating } = req.body;
      const id = crypto.randomUUID();
      await prisma.shopReview.create({
        data: { id, productId: product_id, clinicId: req.user.clinicId, userId: req.user.id, userName: req.user.name, rating, pros, cons, comment },
      });
      const stats = await prisma.shopReview.aggregate({ where: { productId: product_id }, _avg: { rating: true }, _count: { id: true } });
      await prisma.shopProduct.update({
        where: { id: product_id },
        data: { rating: stats._avg.rating || 0, reviewCount: stats._count.id },
      });
      res.json({ id, success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Favorites (authenticated) ───
  router.post('/favorites', authenticate, requireServiceAccess('shop'), async (req, res) => {
    try {
      const { product_id } = req.body;
      const clinicId = req.user.clinicId;
      const existing = await prisma.shopFavorite.findFirst({ where: { clinicId, productId: product_id } });
      if (existing) {
        await prisma.shopFavorite.delete({ where: { id: existing.id } });
        return res.json({ added: false });
      }
      const id = crypto.randomUUID();
      await prisma.shopFavorite.create({
        data: { id, clinicId, userId: req.user.id, productId: product_id },
      });
      res.json({ added: true, id });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/favorites', authenticate, requireServiceAccess('shop'), async (req, res) => {
    try {
      const clinicId = req.user.clinicId;
      const result = await prisma.shopFavorite.findMany({
        where: { clinicId },
        include: { product: { select: { name: true, brand: true, price: true, imageUrl: true, rating: true, reviewCount: true, stock: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(result.map(f => ({ ...f, ...f.product })));
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
