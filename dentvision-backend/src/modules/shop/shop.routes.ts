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
      supplier_id: p.supplierId || p.supplier?.id || null,
      supplier_name: p.supplier?.name || null,
      supplier_status: p.supplier?.status || null,
      own_brand: !!(p as any).ownBrand,
      category_name: p.category || 'Прочее',
      category_id: p.category || 'other',
      brand: p.brand || '',
      rating: p.rating ?? 4.5,
      review_count: 0,
      min_stock: 5,
      old_price: null,
      image_url: p.imageUrl || null,
      imageUrl: p.imageUrl || null,
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

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, status: true } },
      },
    });

    if (!product) {
      res.status(404).json({ ok: false, error: 'Product not found' });
      return;
    }

    res.json({
      ok: true,
      data: {
        ...product,
        supplier_id: product.supplierId || product.supplier?.id || null,
        supplier_name: product.supplier?.name || null,
        supplier_status: product.supplier?.status || null,
        supplier_country: product.country || null,
        own_brand: !!product.ownBrand,
        category_name: product.category || 'Прочее',
        brand: product.brand || '',
        rating: product.rating ?? 4.5,
        review_count: 0,
        delivery_days: 3,
        image_url: product.imageUrl || null,
        imageUrl: product.imageUrl || null,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch product' });
  }
});

shopRouter.post('/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.isGuest) {
      res.status(403).json({ ok: false, error: 'Войдите в аккаунт, чтобы оформить заказ' });
      return;
    }

    const { items, total, dentCashMinor, dentCashTenge, delivery_address, delivery_method, payment_method, notes, clinic_id, clinicId: bodyClinicId } = req.body;

    // Resolve clinic: JWT → body (membership-checked) → first membership
    let clinicId = req.user?.clinicId || null;
    const requestedClinic = clinic_id || bodyClinicId || null;
    if (!clinicId && requestedClinic) {
      const member = await prisma.clinicMember.findFirst({
        where: { userId: req.user!.id, clinicId: String(requestedClinic) },
      });
      if (member) clinicId = member.clinicId;
    }
    if (!clinicId) {
      const first = await prisma.clinicMember.findFirst({
        where: { userId: req.user!.id },
        orderBy: { joinedAt: 'asc' },
      });
      clinicId = first?.clinicId || null;
    }
    if (!clinicId) {
      res.status(400).json({
        ok: false,
        error: 'Нужна клиника: вступите в клинику или выберите её в профиле, затем оформите заказ',
      });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ ok: false, error: 'items array is required' });
      return;
    }

    const productIds = items.map((i: any) => String(i.product_id || i.productId || i.id || '')).filter(Boolean);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines: Array<{
      productId: string;
      name: string;
      category: string | null;
      priceTenge: number;
      qty: number;
      supplierId: string | null;
      ownBrand: boolean;
      promo: boolean;
    }> = [];

    let goodsTotal = 0;
    for (const raw of items) {
      const pid = String(raw.product_id || raw.productId || raw.id || '');
      const qty = Math.max(1, Number(raw.quantity || raw.qty || 1));
      const p = byId.get(pid);
      if (!p) {
        res.status(400).json({ ok: false, error: `Товар не найден: ${pid}` });
        return;
      }
      const lineTotal = Number(p.price) * qty;
      goodsTotal += lineTotal;
      const promo = String(p.description || '').includes('[АКЦИЯ]');
      lines.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        priceTenge: Number(p.price),
        qty,
        supplierId: p.supplierId,
        ownBrand: !!(p as any).ownBrand,
        promo,
      });
    }

    const deliveryCost = goodsTotal >= 50000 ? 0 : 2500;
    const payableBeforeCash = goodsTotal + deliveryCost;
    const { spendDentCash } = await import('../dentcash/spend.service.js');
    const { accrueShopOrderCashback } = await import('../dentcash/cashback.engine.js');
    const { tengeToMinor } = await import('../../lib/money.js');

    const orderId = uid();
    let spendWanted = 0n;
    if (dentCashMinor != null) spendWanted = BigInt(dentCashMinor);
    else if (dentCashTenge != null) spendWanted = tengeToMinor(Number(dentCashTenge));

    // Create order first so spend always has a durable ref (no orphaned debit).
    void total;
    let order = await prisma.order.create({
      data: {
        id: orderId,
        clinicId,
        userId: req.user!.id,
        items: lines.map((l) => ({
          product_id: l.productId,
          name: l.name,
          quantity: l.qty,
          price: l.priceTenge,
          supplier_id: l.supplierId,
        })),
        total: payableBeforeCash,
        status: 'pending',
        meta: {
          delivery_address,
          delivery_method,
          payment_method,
          notes,
          goodsTotal,
          deliveryCost,
          dentCashMinor: '0',
          dentCashTenge: 0,
        },
      },
    });

    let spent = 0n;
    try {
      spent = await spendDentCash({
        userId: req.user!.id,
        amountMinor: spendWanted,
        payableMinor: tengeToMinor(payableBeforeCash),
        refType: 'order',
        refId: orderId,
      });
    } catch (err) {
      console.error('[dentcash spend order]', err);
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled', meta: { ...(order.meta as object || {}), cancelReason: 'dentcash_spend_failed' } },
      }).catch(() => null);
      res.status(500).json({ ok: false, error: 'Не удалось списать DentCash' });
      return;
    }

    const finalTotal = Math.max(0, payableBeforeCash - Number(spent) / 100);
    order = await prisma.order.update({
      where: { id: orderId },
      data: {
        total: finalTotal,
        meta: {
          delivery_address,
          delivery_method,
          payment_method,
          notes,
          goodsTotal,
          deliveryCost,
          dentCashMinor: spent.toString(),
          dentCashTenge: Number(spent) / 100,
        },
      },
    });

    const cashback = await accrueShopOrderCashback({
      orderId: order.id,
      userId: req.user!.id,
      lines,
      immediate: false,
      spendMinor: spent,
    }).catch(async (err) => {
      console.error('[dentcash accrue order]', err);
      // Order + spend already committed; surface zero earn (retryable via ops).
      return null;
    });

    // If velocity skipped entire earn, still return a clear hint.
    const earnTenge = cashback && !cashback.skipped
      ? Number(cashback.totalMinor) / 100
      : cashback?.skipped && cashback.reason === 'already_accrued'
        ? Number(cashback.totalMinor) / 100
        : 0;

    let payment: Record<string, unknown> | null = null;
    const method = String(payment_method || 'kaspi').toLowerCase();
    const needsOnlinePay = finalTotal > 0 && method !== 'cash';

    if (finalTotal <= 0) {
      const { settlePaidPayment } = await import('../payments/payments.routes.js');
      // Fully covered by DentCash — settle order/supplier credits without QR payment.
      await settlePaidPayment({
        id: `dentcash-${order.id}`,
        refType: 'order',
        refId: order.id,
        domain: 'shop',
        sellerType: null,
        sellerId: null,
        amount: 0n,
        meta: { userId: req.user!.id, coveredByDentCash: true },
      });
      order = await prisma.order.findUnique({ where: { id: order.id } }) || order;
    } else if (needsOnlinePay) {
      const { providers } = await import('../payments/kaspi.provider.js');
      const { tengeToMinor: toMinor, serializeBigInt } = await import('../../lib/money.js');
      const amountMinor = toMinor(finalTotal);
      const gateway = providers.kaspi_qr;
      const created = await gateway.createPayment({ amountMinor, refId: order.id });
      const primarySupplier = lines.find((l) => l.supplierId)?.supplierId || null;
      const pay = await prisma.payment.create({
        data: {
          provider: 'kaspi_qr',
          externalId: created.externalId,
          amount: amountMinor,
          status: 'pending',
          refType: 'order',
          refId: order.id,
          domain: 'shop',
          sellerType: primarySupplier ? 'SUPPLIER' : null,
          sellerId: primarySupplier,
          meta: {
            qr: created.qr,
            userId: req.user!.id,
            payment_method: method,
          },
        },
      });
      payment = { ...serializeBigInt(pay), qr: created.qr };
      const prevMeta = (order.meta && typeof order.meta === 'object' ? order.meta : {}) as Record<string, unknown>;
      order = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'awaiting_payment',
          meta: { ...prevMeta, paymentId: pay.id },
        },
      });
    }

    res.status(201).json({
      ok: true,
      data: {
        ...order,
        dentCashSpentTenge: Number(spent) / 100,
        dentCashEarnPendingTenge: earnTenge,
        dentCashEarnSkipped: cashback?.skipped ? cashback.reason : null,
        payment,
        requiresPayment: !!payment,
      },
    });
  } catch (error) {
    console.error('Create shop order error:', error);
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
