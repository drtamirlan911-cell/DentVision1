import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from '../finance/finance.service.js';

export interface SupplierInsight {
  id: string;
  type: 'stock' | 'demand' | 'price' | 'rating' | 'promo' | 'return';
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  productId?: string;
  productName?: string;
  metric?: number;
}

function parseOrderItems(raw: unknown): Array<{ productId?: string; product_id?: string; name?: string; qty?: number; price?: number; quantity?: number }> {
  if (!Array.isArray(raw)) return [];
  return raw as any[];
}

function itemProductId(item: { productId?: string; product_id?: string }): string | null {
  return item.productId || item.product_id || null;
}

export async function getSupplierOrders(supplierId: string) {
  const products = await prisma.product.findMany({
    where: { supplierId },
    select: { id: true, name: true },
  });
  const productIds = new Set(products.map((p) => p.id));
  const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      clinic: { select: { id: true, name: true, city: true } },
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return orders
    .map((order) => {
      const items = parseOrderItems(order.items)
        .filter((it) => {
          const pid = itemProductId(it);
          return pid && productIds.has(pid);
        })
        .map((it) => {
          const pid = itemProductId(it)!;
          const qty = Number(it.qty || it.quantity || 1);
          const price = Number(it.price || 0);
          return {
            productId: pid,
            name: it.name || nameById[pid] || 'Товар',
            qty,
            price,
            total: qty * price,
          };
        });

      if (items.length === 0) return null;

      const subtotal = items.reduce((s, i) => s + i.total, 0);
      return {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        clinicName: order.clinic?.name || 'Клиника',
        clinicCity: order.clinic?.city || null,
        buyerName: order.user ? `${order.user.firstName} ${order.user.lastName}`.trim() : 'Покупатель',
        items,
        subtotal,
        total: order.total,
      };
    })
    .filter(Boolean);
}

export async function buildSupplierInsights(supplierId: string): Promise<SupplierInsight[]> {
  const products = await prisma.product.findMany({ where: { supplierId } });
  const insights: SupplierInsight[] = [];

  for (const p of products) {
    if (p.stock <= 0) {
      insights.push({
        id: `stock-out-${p.id}`,
        type: 'stock',
        severity: 'warning',
        title: 'Товар закончился',
        message: `«${p.name}» — остаток 0. Пополните склад, чтобы не терять заказы.`,
        productId: p.id,
        productName: p.name,
        metric: 0,
      });
    } else if (p.stock <= 5) {
      insights.push({
        id: `stock-low-${p.id}`,
        type: 'stock',
        severity: 'warning',
        title: 'Заканчивается товар',
        message: `У вас заканчивается «${p.name}». Осталось ${p.stock} шт.`,
        productId: p.id,
        productName: p.name,
        metric: p.stock,
      });
    }
  }

  // Demand: compare recent 14d order mentions vs previous 14d for same product
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const recentFrom = new Date(now - 14 * day);
  const prevFrom = new Date(now - 28 * day);
  const prevTo = recentFrom;

  const recentOrders = await prisma.order.findMany({
    where: { createdAt: { gte: recentFrom } },
    select: { items: true },
  });
  const prevOrders = await prisma.order.findMany({
    where: { createdAt: { gte: prevFrom, lt: prevTo } },
    select: { items: true },
  });

  const countByProduct = (rows: Array<{ items: unknown }>) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      for (const it of parseOrderItems(row.items)) {
        const pid = itemProductId(it);
        if (!pid) continue;
        map.set(pid, (map.get(pid) || 0) + Number(it.qty || it.quantity || 1));
      }
    }
    return map;
  };

  const recentMap = countByProduct(recentOrders);
  const prevMap = countByProduct(prevOrders);
  const myIds = new Set(products.map((p) => p.id));

  for (const p of products) {
    if (!myIds.has(p.id)) continue;
    const recent = recentMap.get(p.id) || 0;
    const prev = prevMap.get(p.id) || 0;
    if (recent >= 3 && prev > 0) {
      const growth = Math.round(((recent - prev) / prev) * 100);
      if (growth >= 20) {
        insights.push({
          id: `demand-${p.id}`,
          type: 'demand',
          severity: 'success',
          title: 'Рост спроса',
          message: `Сейчас спрос на «${p.name}» вырос на ${growth}% за 14 дней. Увеличьте остаток и включите рекламу.`,
          productId: p.id,
          productName: p.name,
          metric: growth,
        });
      }
    } else if (recent >= 5 && prev === 0) {
      insights.push({
        id: `demand-new-${p.id}`,
        type: 'demand',
        severity: 'success',
        title: 'Горячий спрос',
        message: `«${p.name}» активно покупают клиники (${recent} шт. за 2 недели). Рекомендуем промо-слот на витрине.`,
        productId: p.id,
        productName: p.name,
        metric: recent,
      });
    }
  }

  // Price vs category average
  for (const p of products) {
    if (!p.category) continue;
    const agg = await prisma.product.aggregate({
      where: { category: p.category, id: { not: p.id } },
      _avg: { price: true },
      _count: true,
    });
    if (!agg._count || !agg._avg.price) continue;
    const avg = agg._avg.price;
    const deltaPct = Math.round(((p.price - avg) / avg) * 100);
    if (deltaPct > 20) {
      insights.push({
        id: `price-high-${p.id}`,
        type: 'price',
        severity: 'info',
        title: 'Цена выше рынка',
        message: `«${p.name}» дороже рынка на ${deltaPct}%. Добавьте сертификаты или скорректируйте цену.`,
        productId: p.id,
        productName: p.name,
        metric: deltaPct,
      });
    } else if (deltaPct < -15) {
      insights.push({
        id: `price-low-${p.id}`,
        type: 'price',
        severity: 'info',
        title: 'Цена ниже рынка',
        message: `«${p.name}» дешевле рынка на ${Math.abs(deltaPct)}%. Можно поднять цену или усилить маржинальность.`,
        productId: p.id,
        productName: p.name,
        metric: deltaPct,
      });
    }
  }

  // Rating
  const rated = products.filter((p) => p.rating != null);
  if (rated.length) {
    const avgRating = rated.reduce((s, p) => s + (p.rating || 0), 0) / rated.length;
    if (avgRating < 4) {
      insights.push({
        id: 'rating-low',
        type: 'rating',
        severity: 'warning',
        title: 'Рейтинг требует внимания',
        message: `Средний рейтинг товаров ${avgRating.toFixed(1)}. Улучшите описания и скорость отгрузки.`,
        metric: Number(avgRating.toFixed(1)),
      });
    } else if (avgRating >= 4.5) {
      insights.push({
        id: 'rating-high',
        type: 'rating',
        severity: 'success',
        title: 'Сильный рейтинг',
        message: `Средний рейтинг ${avgRating.toFixed(1)}. Включите рекламу на топ-позиции витрины.`,
        metric: Number(avgRating.toFixed(1)),
      });
    }
  }

  // Open returns/disputes referencing supplier orders
  const myOrderIds = (await getSupplierOrders(supplierId)).map((o: any) => o.id);
  if (myOrderIds.length) {
    const openDisputes = await prisma.dispute.count({
      where: {
        status: { in: ['open', 'OPEN', 'pending'] },
        refType: { in: ['order', 'ORDER', 'shop_order'] },
        refId: { in: myOrderIds },
      },
    });
    if (openDisputes > 0) {
      insights.push({
        id: 'returns-open',
        type: 'return',
        severity: 'warning',
        title: 'Открытые возвраты',
        message: `У вас ${openDisputes} открытых возвратов/споров. Закройте их, чтобы не терять рейтинг.`,
        metric: openDisputes,
      });
    }
  }

  if (products.length > 0 && !insights.some((i) => i.type === 'promo')) {
    insights.push({
      id: 'promo-tip',
      type: 'promo',
      severity: 'info',
      title: 'Реклама и акции',
      message: 'Запустите акцию −10% на расходники — клиники чаще докупают по напоминанию со склада CRM.',
    });
  }

  // Stable ordering: warnings first
  const rank = { warning: 0, info: 1, success: 2 };
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export async function buildSupplierDashboard(supplierId: string) {
  const wallet = await getOrCreateWallet('SUPPLIER', supplierId);
  const [products, creditAgg, insights, orders, disputes] = await Promise.all([
    prisma.product.findMany({ where: { supplierId }, orderBy: { updatedAt: 'desc' } }),
    prisma.ledgerEntry.aggregate({
      where: { walletId: wallet.id, direction: 'credit' },
      _sum: { amount: true },
      _count: true,
    }),
    buildSupplierInsights(supplierId),
    getSupplierOrders(supplierId),
    prisma.dispute.findMany({
      where: { status: { in: ['open', 'OPEN', 'pending', 'resolved', 'RESOLVED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const productIds = new Set(products.map((p) => p.id));
  const myOrderIds = new Set((orders as any[]).map((o) => o.id));
  const returns = disputes.filter(
    (d) => myOrderIds.has(d.refId) || (d.refType === 'product' && productIds.has(d.refId)),
  );

  const rated = products.filter((p) => p.rating != null);
  const avgRating = rated.length
    ? rated.reduce((s, p) => s + (p.rating || 0), 0) / rated.length
    : null;

  const lowStock = products.filter((p) => p.stock <= 5);
  const outOfStock = products.filter((p) => p.stock <= 0);

  const sales30 = (orders as any[]).filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  });
  const revenue30 = sales30.reduce((s, o) => s + Number(o.subtotal || 0), 0);

  const demandTop = insights
    .filter((i) => i.type === 'demand')
    .slice(0, 5);

  // Lightweight promotions derived from catalog (no schema migration)
  const promotions = products
    .filter((p) => (p.description || '').toLowerCase().includes('акци') || (p.category || '').toLowerCase().includes('акци'))
    .map((p) => ({
      id: `promo-${p.id}`,
      title: `Акция: ${p.name}`,
      productId: p.id,
      productName: p.name,
      discountLabel: 'Спецпредложение',
      active: p.stock > 0,
    }));

  return {
    kpis: {
      balanceMinor: wallet.balance.toString(),
      earnedMinor: (creditAgg._sum.amount ?? 0n).toString(),
      salesCount: creditAgg._count,
      orders30: sales30.length,
      revenue30,
      productCount: products.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      openReturns: returns.filter((r) => ['open', 'OPEN', 'pending'].includes(r.status)).length,
      avgRating: avgRating != null ? Number(avgRating.toFixed(2)) : null,
      currency: wallet.currency,
    },
    insights,
    demandTop,
    orders: (orders as any[]).slice(0, 40),
    returns: returns.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      refType: r.refType,
      refId: r.refId,
      createdAt: r.createdAt,
    })),
    stock: {
      low: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, price: p.price, category: p.category })),
      out: outOfStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, price: p.price, category: p.category })),
    },
    promotions,
    ads: [
      {
        id: 'ad-home',
        title: 'Витрина маркетплейса',
        status: products.length >= 3 ? 'recommended' : 'locked',
        description: products.length >= 3
          ? 'Рекомендуем промо-слот на главной — у вас достаточно SKU для витрины.'
          : 'Добавьте минимум 3 товара, чтобы открыть рекламный слот.',
      },
      {
        id: 'ad-crm',
        title: 'Реклама в CRM-закупках',
        status: 'available',
        description: 'Показ оффера клиникам, у которых заканчивается аналог на складе.',
      },
    ],
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      rating: p.rating,
      brand: p.brand,
      description: p.description,
      imageUrl: p.imageUrl || null,
      ownBrand: Boolean((p as { ownBrand?: boolean }).ownBrand),
    })),
  };
}
