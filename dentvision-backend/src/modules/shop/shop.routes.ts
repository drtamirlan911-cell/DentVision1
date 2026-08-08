import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { AuthRequest } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import { resolveSupplierCity } from '../../lib/kzCities.js';

const shopRouter = Router();

shopRouter.get('/products', async (req, res) => {
  try {
    const { category, search, sort, city } = req.query;
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

    const cityFilter = typeof city === 'string' ? city.trim() : '';
    if (cityFilter && cityFilter !== 'all') {
      where.supplier = {
        OR: [
          { city: { equals: cityFilter, mode: 'insensitive' } },
          { legalAddress: { contains: cityFilter, mode: 'insensitive' } },
        ],
      };
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
          supplier: { select: { id: true, name: true, status: true, city: true, legalAddress: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const mapped = products.map((p) => {
      const supplierCity = p.supplier ? resolveSupplierCity(p.supplier) : null;
      return {
        ...p,
        supplier_id: p.supplierId || p.supplier?.id || null,
        supplier_name: p.supplier?.name || null,
        supplier_status: p.supplier?.status || null,
        supplier_city: supplierCity,
        city: supplierCity,
        own_brand: !!(p as any).ownBrand,
        category_name: p.category || 'Прочее',
        category_id: p.category || 'other',
        brand: p.brand || '',
        rating: p.rating ?? 4.5,
        supplier_count: 1, // will be enriched below
        min_stock: 5,
        old_price: null,
        image_url: p.imageUrl || null,
        imageUrl: p.imageUrl || null,
      };
    });

    // Enrich with supplier count (how many suppliers sell this product)
    try {
      const sharedIds = [...new Set(mapped.map((p: any) => (p as any).sharedProductId || p.id).filter(Boolean))] as string[];
      if (sharedIds.length > 0) {
        const counts = await prisma.$queryRawUnsafe<Array<{ spid: string; cnt: number }>>(
          `SELECT COALESCE(shared_product_id, id::text) as spid, COUNT(*)::int as cnt FROM products WHERE shared_product_id IN (${sharedIds.map((_, i) => `$${i + 1}`).join(',')}) OR (shared_product_id IS NULL AND id::text IN (${sharedIds.map((_, i) => `$${i + 1}`).join(',')})) GROUP BY 1`,
          ...sharedIds, ...sharedIds
        );
        const countMap: Record<string, number> = {};
        for (const c of counts) countMap[c.spid] = c.cnt;
        for (const m of mapped as any[]) {
          const sid = (m as any).sharedProductId || m.id;
          if (countMap[sid]) (m as any).supplier_count = countMap[sid];
        }
      }
    } catch { /* non-fatal */ }

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

    // C7: Atomic checkout — order + payment writes in $transaction
    let spent = 0n;
    let cashbackResult: any = null;
    let payment: Record<string, unknown> | null = null;
    let order: any;
    let finalTotal = payableBeforeCash;

    // Phase 1: Create order inside transaction
    order = await prisma.$transaction(async (tx) => {
      void total;
      const o = await tx.order.create({
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
      return o;
    });

    // Phase 2: DentCash spend (external service)
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

    finalTotal = Math.max(0, payableBeforeCash - Number(spent) / 100);

    // Phase 3: Update order with final total + payment inside one transaction
    await prisma.$transaction(async (tx) => {
      order = await tx.order.update({
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

      const method = String(payment_method || 'kaspi').toLowerCase();
      const needsOnlinePay = finalTotal > 0 && method !== 'cash';

      if (finalTotal <= 0) {
        const { settlePaidPayment } = await import('../payments/payments.routes.js');
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
      } else if (needsOnlinePay) {
        const { providers, withPaymentQr } = await import('../payments/kaspi.provider.js');
        const { tengeToMinor: toMinor, serializeBigInt } = await import('../../lib/money.js');
        const amountMinor = toMinor(finalTotal);
        const gateway = providers.kaspi_qr;
        const created = await gateway.createPayment({ amountMinor, refId: order.id });
        const primarySupplier = lines.find((l) => l.supplierId)?.supplierId || null;
        const pay = await tx.payment.create({
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
        payment = withPaymentQr(serializeBigInt(pay) as Record<string, unknown>, created.qr);
        const prevMeta = (order.meta && typeof order.meta === 'object' ? order.meta : {}) as Record<string, unknown>;
        order = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'awaiting_payment',
            meta: { ...prevMeta, paymentId: pay.id },
          },
        });
      }
    });

    // Phase 4: Cashback (external, non-critical)
    cashbackResult = await accrueShopOrderCashback({
      orderId: order.id,
      userId: req.user!.id,
      lines,
      immediate: false,
      spendMinor: spent,
    }).catch(async (err) => {
      console.error('[dentcash accrue order]', err);
      return null;
    });

    const earnTenge = cashbackResult && !cashbackResult.skipped
      ? Number(cashbackResult.totalMinor) / 100
      : cashbackResult?.skipped && cashbackResult.reason === 'already_accrued'
        ? Number(cashbackResult.totalMinor) / 100
        : 0;

    res.status(201).json({
      ok: true,
      data: {
        ...order,
        dentCashSpentTenge: Number(spent) / 100,
        dentCashEarnPendingTenge: earnTenge,
        dentCashEarnSkipped: cashbackResult?.skipped ? cashbackResult.reason : null,
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

    const data = orders.map((o) => {
      const meta = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as Record<string, unknown>;
      const rawItems = Array.isArray(o.items) ? o.items : [];
      return {
        ...o,
        paymentMethod: meta.payment_method || null,
        deliveryMethod: meta.delivery_method || null,
        items: rawItems.map((it: any, idx: number) => ({
          id: it.id || `${o.id}-${idx}`,
          productName: it.productName || it.name || 'Товар',
          quantity: Number(it.quantity || it.qty || 1),
          price: Number(it.price || 0),
        })),
        meta,
      };
    });

    res.json({ ok: true, data: paginatedResponse(data, total, page, limit) });
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
    const [shopCats, productCats] = await Promise.all([
      prisma.shopCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.product.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),
    ]);
    const catSet = new Set(shopCats.map(c => c.name));
    const extraCats = productCats
      .map(r => r.category).filter(Boolean)
      .filter(name => !catSet.has(name!))
      .map(name => ({ id: String(name), name: String(name), icon: 'package', slug: String(name).toLowerCase().replace(/\s+/g, '-') }));
    res.json({ ok: true, data: [...shopCats, ...extraCats] });
  } catch { res.status(500).json({ ok: false, error: 'Failed to list categories' }); }
});

shopRouter.get('/suppliers', async (req, res) => {
  try {
    const cityFilter = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const suppliers = await prisma.supplier.findMany({
      where: {
        status: { in: ['verified', 'official_partner', 'pending'] },
        ...(cityFilter && cityFilter !== 'all'
          ? {
              OR: [
                { city: { equals: cityFilter, mode: 'insensitive' } },
                { legalAddress: { contains: cityFilter, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
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
        city: resolveSupplierCity(s),
        legalAddress: s.legalAddress,
        delivery_days: 2,
      };
    });
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch suppliers' });
  }
});

// ─── PRODUCT PRESETS (quick-add templates for suppliers) ───

shopRouter.get('/product-presets', async (req, res) => {
  try {
    const { categoryId, search } = req.query;
    const where: Record<string, unknown> = { isActive: true };

    if (categoryId && typeof categoryId === 'string') {
      where.categoryId = categoryId;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const presets = await prisma.productPreset.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { category: { select: { id: true, name: true } } },
    });

    res.json({ ok: true, data: presets });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch product presets' });
  }
});

shopRouter.post('/product-presets/quick-add', authenticate, async (req: AuthRequest, res) => {
  try {
    const supplierId = req.user?.supplierId;
    if (!supplierId) {
      res.status(403).json({ ok: false, error: 'Только поставщик может добавить товар' });
      return;
    }

    const { presetId, price, stock } = req.body;
    if (!presetId || price == null) {
      res.status(400).json({ ok: false, error: 'presetId and price are required' });
      return;
    }

    const preset = await prisma.productPreset.findUnique({ where: { id: presetId } });
    if (!preset) {
      res.status(404).json({ ok: false, error: 'Preset not found' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        id: uid(),
        name: preset.name,
        brand: preset.brand || undefined,
        category: preset.categoryId || undefined,
        description: preset.description || undefined,
        imageUrl: preset.imageUrl || undefined,
        price: Number(price),
        supplierId,
        specs: preset.specs || undefined,
        unit: preset.unit || 'шт',
        tags: preset.tags || undefined,
        stock: stock != null ? Number(stock) : 10,
        isActive: true,
        country: preset.country || undefined,
      },
    });

    res.status(201).json({ ok: true, data: product });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to quick-add product' });
  }
});

// ─── SHOP MARKETING ───

shopRouter.get('/banners', async (_req, res) => {
  try {
    const banners = await prisma.shopBanner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 5,
    });
    res.json({ ok: true, data: banners });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch banners' });
  }
});

shopRouter.get('/promotions', async (_req, res) => {
  try {
    const promotions = await prisma.shopPromotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ ok: true, data: promotions });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch promotions' });
  }
});

shopRouter.get('/recommendations', async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 6));
    const products = await prisma.product.findMany({
      where: { isActive: true, rating: { gte: 4 } },
      orderBy: { rating: 'desc' },
      take: limit,
      include: { supplier: { select: { id: true, name: true, status: true, city: true } } },
    });
    const mapped = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      oldPrice: null,
      imageUrl: p.imageUrl,
      rating: p.rating ?? 4.5,
      supplierName: p.supplier?.name || null,
      category: p.category || 'Прочее',
    }));
    res.json({ ok: true, data: mapped });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch recommendations' });
  }
});

// ─── Missing routes (added for frontend compatibility) ───

shopRouter.get('/categories/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const products = await prisma.product.findMany({
      where: { category: slug, isActive: true },
      take: 50,
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json({ ok: true, data: { slug, products: products.map(p => ({ id: p.id, name: p.name, price: Number(p.price), imageUrl: p.imageUrl, supplierName: p.supplier?.name })) } });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to fetch category' }); }
});

shopRouter.get('/spec-templates', async (_req, res) => {
  try {
    const presets = await prisma.productPreset.findMany({ where: { isActive: true }, select: { id: true, name: true, specs: true }, take: 100 });
    res.json({ ok: true, data: presets });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed' }); }
});

shopRouter.get('/delivery-zones', async (req, res) => {
  try {
    const supplierId = req.query.supplierId as string;
    const city = req.query.city as string;
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    const zones = await prisma.deliveryZone.findMany({ where, orderBy: { cost: 'asc' } });
    // Filter by city if specified (cities is JSON array)
    const filtered = city
      ? zones.filter(z => Array.isArray(z.cities) && (z.cities as string[]).some(c => c.toLowerCase() === city.toLowerCase()))
      : zones;
    res.json({ ok: true, data: filtered });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to load delivery zones' }); }
});

// Delivery calculator: what are the options for this city + cart total?
shopRouter.get('/delivery-calc', async (req, res) => {
  try {
    const { city, cartTotal, supplierId } = req.query;
    if (!city) return res.status(400).json({ ok: false, error: 'city required' });
    const where: any = {};
    if (supplierId) where.supplierId = String(supplierId);
    const zones = await prisma.deliveryZone.findMany({ where, orderBy: { cost: 'asc' } });
    // Filter zones that cover this city
    const matching = zones.filter(z => Array.isArray(z.cities) && (z.cities as string[]).some(c => c.toLowerCase() === String(city).toLowerCase()));
    const total = parseInt(String(cartTotal || '0'));
    const options = matching.map(z => ({
      zoneId: z.id, name: z.name, cost: z.cost,
      freeFrom: z.freeFrom,
      isFree: z.freeFrom ? total >= z.freeFrom : false,
      actualCost: (z.freeFrom && total >= z.freeFrom) ? 0 : z.cost,
      estimatedDays: z.estimatedDays,
      supplierId: z.supplierId,
    }));
    res.json({ ok: true, data: options });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to calculate delivery' }); }
});

// Product-level delivery preview: shows delivery for each product in cart without asking city
shopRouter.get('/delivery-preview', async (req, res) => {
  try {
    const productIds = (req.query.ids as string || '').split(',').filter(Boolean);
    if (!productIds.length) return res.json({ ok: true, data: [] });
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, supplierId: true, weight: true },
    });
    const supplierIds = [...new Set(products.map(p => p.supplierId).filter(Boolean))];
    const zones = await prisma.deliveryZone.findMany({
      where: { supplierId: { in: supplierIds as string[] } },
      orderBy: { cost: 'asc' },
    });
    // Group by supplier: cheapest zone = default delivery
    const bySupplier: Record<string, { minCost: number; freeFrom: number | null; days: number | null; zoneName: string }> = {};
    for (const z of zones) {
      if (!bySupplier[z.supplierId] || z.cost < bySupplier[z.supplierId].minCost) {
        bySupplier[z.supplierId] = { minCost: z.cost, freeFrom: z.freeFrom, days: z.estimatedDays, zoneName: z.name };
      }
    }
    const preview = products.map(p => {
      const d = p.supplierId ? bySupplier[p.supplierId] : null;
      return {
        productId: p.id,
        productName: p.name,
        deliveryCost: d?.minCost ?? 0,
        freeFrom: d?.freeFrom ?? null,
        estimatedDays: d?.days ?? null,
        zoneName: d?.zoneName ?? null,
      };
    });
    res.json({ ok: true, data: preview });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to preview delivery' }); }
});

shopRouter.get('/products/:id/offers', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, name: true, sharedProductId: true, supplierId: true },
    });
    if (!product) return res.status(404).json({ ok: false, error: 'Not found' });

    // Find all supplier offers for the same shared product (same name grouping)
    const sharedId = product.sharedProductId || product.id;
    const offers = await prisma.product.findMany({
      where: {
        OR: [
          { id: sharedId },
          { sharedProductId: sharedId },
        ],
        isActive: true,
      },
      select: {
        id: true, price: true, stock: true, supplierId: true, rating: true,
        supplier: { select: { id: true, name: true, rating: true, city: true } },
      },
      orderBy: { price: 'asc' },
    });

    res.json({ ok: true, data: { canonicalId: sharedId, offers } });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to load offers' }); }
});

shopRouter.post('/products', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.supplierId) { res.status(403).json({ ok: false, error: 'Только поставщик' }); return; }
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' });

    // Auto-link to existing catalog product — prevent duplicate listings
    let sharedProductId: string | null = null;
    if (name) {
      const existing = await prisma.product.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, supplierId: { not: req.user.supplierId } },
        select: { id: true, sharedProductId: true },
      });
      if (existing) {
        sharedProductId = existing.sharedProductId || existing.id;
        // Ensure the canonical product also has sharedProductId set
        if (!existing.sharedProductId) {
          await prisma.product.update({ where: { id: existing.id }, data: { sharedProductId: existing.id } });
        }
      }
    }

    const data = await prisma.product.create({
      data: { id: uid(), supplierId: req.user.supplierId, sharedProductId: sharedProductId as string | null, ...req.body, price: Number(req.body.price) },
    });
    res.status(201).json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to create product' }); }
});

shopRouter.patch('/products/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    if (product.supplierId !== req.user?.supplierId) { res.status(403).json({ ok: false, error: 'Нет доступа' }); return; }
    const updated = await prisma.product.update({ where: { id }, data: { ...req.body, price: req.body.price != null ? Number(req.body.price) : undefined } });
    res.json({ ok: true, data: updated });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to update product' }); }
});

shopRouter.delete('/products/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    if (product.supplierId !== req.user?.supplierId) { res.status(403).json({ ok: false, error: 'Нет доступа' }); return; }
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to delete product' }); }
});

shopRouter.get('/reviews', async (req, res) => {
  try {
    const productId = req.query.productId as string;
    const where: any = { isApproved: true };
    if (productId) where.productId = productId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { skip, take } = paginate(page, limit);
    const [items, total] = await Promise.all([
      prisma.shopReview.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.shopReview.count({ where }),
    ]);
    res.json({ ok: true, data: items, total, page, limit });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to load reviews' }); }
});

shopRouter.post('/reviews', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId, rating, pros, cons, comment } = req.body || {};
    if (!productId || !rating) return res.status(400).json({ ok: false, error: 'productId and rating are required' });
    const existing = await prisma.shopReview.findFirst({
      where: { productId, userId: req.user!.id },
    });
    if (existing) return res.status(409).json({ ok: false, error: 'Вы уже оставили отзыв' });
    const review = await prisma.shopReview.create({
      data: {
        id: uid(), productId, userId: req.user!.id,
        rating: Math.min(5, Math.max(1, Number(rating))),
        pros: pros || null, cons: cons || null, comment: comment || null,
      },
    });
    // Update product average rating
    const avg = await prisma.shopReview.aggregate({ where: { productId, isApproved: true }, _avg: { rating: true } });
    await prisma.product.update({ where: { id: productId }, data: { rating: avg._avg.rating || rating, reviewCount: { increment: 1 } } });
    res.status(201).json({ ok: true, data: review });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || 'Failed to create review' });
  }
});

shopRouter.get('/products/:productId/reviews', async (req, res) => {
  try {
    const reviews = await prisma.shopReview.findMany({
      where: { productId: req.params.productId, isApproved: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, data: reviews });
  } catch (e) { res.status(500).json({ ok: false, error: 'Failed to load reviews' }); }
});

// ─── SEED PRESETS (SuperAdmin) ───

shopRouter.post('/product-presets/seed', authenticate, requireSuperadmin, async (_req, res) => {
  try {
    const { seedProductPresets } = await import('./product-presets.seed.js');
    const result = await seedProductPresets();
    res.json({ ok: true, data: result });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to seed presets' });
  }
});

// ─── CATEGORIES CRUD (superadmin) ───

shopRouter.post('/categories', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { name, description, icon } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' });
    const slug = (req.body.slug as string) || name.toLowerCase().replace(/\s+/g, '-');
    const cat = await prisma.shopCategory.create({
      data: { id: uid(), name, slug, description: description || null, icon: icon || null },
    });
    res.status(201).json({ ok: true, data: cat });
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ ok: false, error: 'Категория с таким slug уже существует' });
    res.status(500).json({ ok: false, error: 'Failed to create category' });
  }
});

shopRouter.delete('/categories/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    await prisma.shopCategory.delete({ where: { id: req.params.id as string } });
    res.json({ ok: true });
  } catch (e: any) { res.status(e.code === 'P2025' ? 404 : 500).json({ ok: false, error: 'Failed to delete category' }); }
});

// ─── SUPPLIERS CRUD (superadmin) ───

shopRouter.post('/suppliers', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, phone, city, kind, description } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' });
    const supplier = await prisma.supplier.create({
      data: { id: uid(), name, email: email || null, phone: phone || null, city: city || null, kind: kind || 'SUPPLIER', description: description || null },
    });
    res.status(201).json({ ok: true, data: supplier });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message || 'Failed to create supplier' }); }
});

shopRouter.delete('/suppliers/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id as string } });
    res.json({ ok: true });
  } catch (e: any) { res.status(e.code === 'P2025' ? 404 : 500).json({ ok: false, error: 'Failed to delete supplier' }); }
});

// ─── PRODUCTS ADMIN (superadmin) ───

shopRouter.get('/admin/products', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { search, supplierId, category } = req.query;
    const where: any = {};
    if (search) where.name = { contains: String(search), mode: 'insensitive' };
    if (supplierId) where.supplierId = String(supplierId);
    if (category) where.category = String(category);
    const products = await prisma.product.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } }, shopCategory: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ ok: true, data: products });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to list products' }); }
});

shopRouter.post('/admin/products', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ ok: false, error: 'Название обязательно' });
    }
    const product = await prisma.product.create({
      data: {
        id: uid(),
        name: String(b.name).trim(),
        brand: b.brand || null,
        category: b.category || null,
        categoryId: b.categoryId || null,
        price: Number(b.price) || 0,
        oldPrice: b.oldPrice != null ? Number(b.oldPrice) : null,
        stock: Number(b.stock) || 0,
        minStock: Number(b.minStock) || 0,
        description: b.description || null,
        imageUrl: b.imageUrl || null,
        supplierId: b.supplierId || null,
        isActive: b.isActive !== false,
        sku: b.sku || null,
        unit: b.unit || null,
        manufacturer: b.manufacturer || null,
        country: b.country || null,
        compatibility: b.compatibility || null,
        ownBrand: !!b.ownBrand,
        tags: Array.isArray(b.tags) ? b.tags : undefined,
      },
    });
    res.status(201).json({ ok: true, data: product });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to create product' }); }
});

shopRouter.patch('/admin/products/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const data: Record<string, any> = {};
    const scalar: Array<[string, any]> = [
      ['name', b.name],
      ['brand', b.brand ?? null],
      ['category', b.category ?? null],
      ['categoryId', b.categoryId ?? null],
      ['price', b.price != null ? Number(b.price) : undefined],
      ['oldPrice', b.oldPrice != null ? Number(b.oldPrice) : null],
      ['stock', b.stock != null ? Number(b.stock) : undefined],
      ['minStock', b.minStock != null ? Number(b.minStock) : undefined],
      ['description', b.description ?? null],
      ['imageUrl', b.imageUrl ?? null],
      ['supplierId', b.supplierId ?? null],
      ['isActive', b.isActive],
      ['sku', b.sku ?? null],
      ['unit', b.unit ?? null],
      ['manufacturer', b.manufacturer ?? null],
      ['country', b.country ?? null],
      ['compatibility', b.compatibility ?? null],
      ['ownBrand', b.ownBrand],
    ];
    for (const [k, v] of scalar) {
      if (v !== undefined) data[k] = v;
    }
    if (Array.isArray(b.tags)) data.tags = b.tags;
    const product = await prisma.product.update({ where: { id: req.params.id as string }, data });
    res.json({ ok: true, data: product });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to update product' }); }
});

shopRouter.delete('/admin/products/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id as string } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to delete product' }); }
});

// ─── REVIEWS ADMIN (superadmin) ───

shopRouter.get('/admin/reviews', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { approved } = req.query;
    const where: any = {};
    if (approved === 'true') where.isApproved = true;
    if (approved === 'false') where.isApproved = false;
    const reviews = await prisma.shopReview.findMany({
      where,
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ ok: true, data: reviews });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to list reviews' }); }
});

shopRouter.patch('/admin/reviews/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const review = await prisma.shopReview.update({
      where: { id: req.params.id as string },
      data: { isApproved: req.body.isApproved },
    });
    res.json({ ok: true, data: review });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to update review' }); }
});

// ─── ANALYTICS (superadmin) ───

shopRouter.get('/admin/stats', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const [totalProducts, totalOrders, totalRevenue, activeSuppliers] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { total: true } }),
      prisma.supplier.count({ where: { status: { in: ['verified', 'official_partner'] } } }),
    ]);
    res.json({
      ok: true,
      data: {
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        activeSuppliers,
      },
    });
  } catch (e: any) { res.status(500).json({ ok: false, error: 'Failed to load stats' }); }
});

export { shopRouter };
