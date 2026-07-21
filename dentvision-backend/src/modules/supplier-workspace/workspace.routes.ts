import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { buildSupplierDashboard, buildSupplierInsights, getSupplierOrders } from './supplierDashboard.js';

// ─────────────────────────────────────────────────────────────────────────────
// Supplier Workspace (self-service cabinet). All routes operate strictly on the
// supplier from the active SUPPLIER context (req.user.supplierId).
// ─────────────────────────────────────────────────────────────────────────────
export const supplierWorkspaceRouter = Router();

supplierWorkspaceRouter.use(authenticate);

function requireSupplierContext(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.supplierId) {
    return res.status(403).json({ ok: false, error: 'Требуется контекст поставщика (switch-context)' } satisfies ApiResponse);
  }
  next();
}

function requireSupplierWrite(req: AuthRequest, res: Response, next: NextFunction) {
  if (!['owner', 'manager'].includes(req.user?.supplierRole || '')) {
    return res.status(403).json({ ok: false, error: 'Недостаточно прав в кабинете поставщика' } satisfies ApiResponse);
  }
  next();
}

supplierWorkspaceRouter.use(requireSupplierContext);

supplierWorkspaceRouter.get('/me', async (req: AuthRequest, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.user!.supplierId },
    include: { documents: true, _count: { select: { products: true } } },
  });
  if (!supplier) {
    return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
  }
  return res.json({ ok: true, data: { ...supplier, myRole: req.user!.supplierRole } } satisfies ApiResponse);
});

supplierWorkspaceRouter.patch('/me', requireSupplierWrite, async (req: AuthRequest, res) => {
  const b = req.body || {};
  const supplier = await prisma.supplier.update({
    where: { id: req.user!.supplierId },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.bin !== undefined && { bin: b.bin || null }),
      ...(b.legalAddress !== undefined && { legalAddress: b.legalAddress || null }),
      ...(b.contactPerson !== undefined && { contactPerson: b.contactPerson || null }),
      ...(b.phone !== undefined && { phone: b.phone || null }),
      ...(b.email !== undefined && { email: b.email || null }),
    },
  });
  return res.json({ ok: true, data: supplier } satisfies ApiResponse);
});

supplierWorkspaceRouter.post('/documents', requireSupplierWrite, async (req: AuthRequest, res) => {
  const { type, url } = req.body || {};
  if (!type || !url) {
    return res.status(400).json({ ok: false, error: 'type и url обязательны' } satisfies ApiResponse);
  }
  const doc = await prisma.supplierDocument.create({ data: { supplierId: req.user!.supplierId!, type, url } });
  return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
});

supplierWorkspaceRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const data = await buildSupplierDashboard(req.user!.supplierId!);
    return res.json({ ok: true, data: serializeBigInt(data) } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier dashboard error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить кабинет' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.get('/insights', async (req: AuthRequest, res) => {
  try {
    const insights = await buildSupplierInsights(req.user!.supplierId!);
    return res.json({ ok: true, data: insights } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier insights error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить рекомендации' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.get('/orders', async (req: AuthRequest, res) => {
  try {
    const orders = await getSupplierOrders(req.user!.supplierId!);
    return res.json({ ok: true, data: orders } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier orders error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить заказы' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.patch('/orders/:id/status', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const status = String(req.body?.status || '').toLowerCase();
    const allowed = ['packing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Недопустимый статус' } satisfies ApiResponse);
    }

    const mine = await getSupplierOrders(req.user!.supplierId!);
    const owned = (mine as any[]).find((o) => o.id === req.params.id);
    if (!owned) {
      return res.status(404).json({ ok: false, error: 'Заказ не найден' } satisfies ApiResponse);
    }

    const order = await prisma.order.update({
      where: { id: owned.id },
      data: { status },
    });
    return res.json({ ok: true, data: order } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier order status error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить статус' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.post('/promotions', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const { productId, title, discountPercent } = req.body || {};
    if (!productId) {
      return res.status(400).json({ ok: false, error: 'productId обязателен' } satisfies ApiResponse);
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: req.user!.supplierId },
    });
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Товар не найден' } satisfies ApiResponse);
    }
    const label = title || `Акция −${Number(discountPercent) || 10}%`;
    const desc = `${product.description || ''}\n[АКЦИЯ] ${label}`.trim();
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { description: desc },
    });
    return res.status(201).json({
      ok: true,
      data: { id: `promo-${updated.id}`, productId: updated.id, title: label, active: true },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier promotion error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать акцию' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.get('/products', async (req: AuthRequest, res) => {
  const products = await prisma.product.findMany({
    where: { supplierId: req.user!.supplierId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ ok: true, data: products } satisfies ApiResponse);
});

supplierWorkspaceRouter.post('/products', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.name || b.price === undefined) {
      return res.status(400).json({ ok: false, error: 'name и price обязательны' } satisfies ApiResponse);
    }
    const product = await prisma.product.create({
      data: {
        id: uid(),
        name: b.name,
        brand: b.brand || null,
        category: b.category || null,
        price: Number(b.price),
        stock: Number(b.stock) || 0,
        description: b.description || null,
        manufacturer: b.manufacturer || null,
        country: b.country || null,
        compatibility: b.compatibility || null,
        supplierId: req.user!.supplierId,
      },
    });
    return res.status(201).json({ ok: true, data: product } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier create product error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании товара' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.patch('/products/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id as string, supplierId: req.user!.supplierId },
  });
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Товар не найден' } satisfies ApiResponse);
  }
  const b = req.body || {};
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.price !== undefined && { price: Number(b.price) }),
      ...(b.stock !== undefined && { stock: Number(b.stock) }),
      ...(b.description !== undefined && { description: b.description || null }),
      ...(b.category !== undefined && { category: b.category || null }),
    },
  });
  return res.json({ ok: true, data: product } satisfies ApiResponse);
});

supplierWorkspaceRouter.delete('/products/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id as string, supplierId: req.user!.supplierId },
  });
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Товар не найден' } satisfies ApiResponse);
  }
  await prisma.product.delete({ where: { id: existing.id } });
  return res.json({ ok: true, data: { id: existing.id } } satisfies ApiResponse);
});

supplierWorkspaceRouter.get('/wallet', async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet('SUPPLIER', req.user!.supplierId!);
  return res.json({ ok: true, data: serializeBigInt(wallet) } satisfies ApiResponse);
});

supplierWorkspaceRouter.post('/payouts', requireSupplierWrite, async (req: AuthRequest, res) => {
  const { amount, amountMinor } = req.body || {};
  if (amount === undefined && amountMinor === undefined) {
    return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
  }
  const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
  const wallet = await getOrCreateWallet('SUPPLIER', req.user!.supplierId!);
  if (wallet.balance < minor) {
    return res.status(409).json({ ok: false, error: 'Недостаточно средств' } satisfies ApiResponse);
  }
  const payout = await prisma.payout.create({ data: { walletId: wallet.id, amount: minor, status: 'requested' } });
  return res.status(201).json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
});

supplierWorkspaceRouter.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const dash = await buildSupplierDashboard(req.user!.supplierId!);
    return res.json({
      ok: true,
      data: {
        balanceMinor: dash.kpis.balanceMinor,
        earnedMinor: dash.kpis.earnedMinor,
        salesCount: dash.kpis.salesCount,
        productCount: dash.kpis.productCount,
        currency: dash.kpis.currency,
        orders30: dash.kpis.orders30,
        revenue30: dash.kpis.revenue30,
        avgRating: dash.kpis.avgRating,
        lowStockCount: dash.kpis.lowStockCount,
        openReturns: dash.kpis.openReturns,
        insights: dash.insights.slice(0, 5),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier analytics error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка аналитики' } satisfies ApiResponse);
  }
});

export default supplierWorkspaceRouter;
