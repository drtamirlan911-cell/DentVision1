import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { recordMovement, isMovementApplied } from './ledger.js';
import { SUPPLY_CATALOG, SUPPLY_CATEGORIES } from './supplyCatalog.js';
import { normalizeItemName } from './orderRestock.js';

const inventoryRouter = Router();

/** Дата срока годности из формы: пустая строка означает «снять срок». */
function parseExpiry(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

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

// ─── Подсказки при добавлении вручную ───

interface Suggestion {
  key: string;
  source: 'clinic' | 'shop' | 'preset' | 'catalog';
  name: string;
  category: string | null;
  unit: string | null;
  price: number | null;
  supplier: string | null;
  sku: string | null;
  productId: string | null;
  /** Позиция с таким названием уже есть на складе — предложим пополнить, а не заводить вторую. */
  existingItemId: string | null;
  existingQuantity: number | null;
  /** Остаток у продавца, если товар из маркетплейса. */
  stock: number | null;
  score: number;
}

/**
 * Насколько подсказка отвечает запросу.
 *
 * Совпадение с начала названия важнее совпадения с начала слова, а оно —
 * важнее совпадения где-то внутри: набирая «перч», человек ищет перчатки,
 * а не «Чехол на наконечник».
 */
function scoreSuggestion(name: string, query: string): number {
  const n = normalizeItemName(name);
  const q = normalizeItemName(query);
  if (!q) return 1;
  if (!n) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(` ${q}`)) return 60;
  if (n.includes(q)) return 40;
  // Все слова запроса нашлись, пусть и вразбивку.
  const words = q.split(' ').filter(Boolean);
  if (words.length > 1 && words.every((w) => n.includes(w))) return 30;
  return 0;
}

inventoryRouter.get('/suggest', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 40);

    const [own, products, presets] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { clinicId },
        select: { id: true, name: true, category: true, unit: true, price: true, supplier: true, sku: true, productId: true, quantity: true },
      }),
      // Товары маркетплейса — единственный источник, где есть живой поставщик
      // и настоящая цена, поэтому берём широкую выборку и режем скорингом.
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, sku: true, unit: true, price: true, stock: true,
          category: true, shopCategory: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        take: 400,
      }),
      prisma.productPreset.findMany({
        where: { isActive: true },
        select: { id: true, name: true, unit: true, avgPrice: true, manufacturer: true, category: { select: { name: true } } },
        take: 300,
      }),
    ]);

    const ownByName = new Map(own.map((i) => [normalizeItemName(i.name), i]));
    const out: Suggestion[] = [];

    const push = (s: Omit<Suggestion, 'score' | 'existingItemId' | 'existingQuantity'>) => {
      const score = scoreSuggestion(s.name, q);
      if (score === 0) return;
      // Признак «эта позиция уже есть на складе» заполняется и для строк
      // самого склада: выбор любой из них должен вести к пополнению
      // существующей позиции, а не к заведению второй такой же.
      const existing = ownByName.get(normalizeItemName(s.name));
      out.push({
        ...s,
        existingItemId: existing ? existing.id : null,
        existingQuantity: existing ? existing.quantity : null,
        score,
      });
    };

    for (const i of own) {
      push({
        key: `clinic:${i.id}`, source: 'clinic', name: i.name,
        category: i.category, unit: i.unit, price: i.price,
        supplier: i.supplier, sku: i.sku, productId: i.productId, stock: null,
      });
    }
    for (const p of products) {
      push({
        key: `shop:${p.id}`, source: 'shop', name: p.name,
        category: p.shopCategory?.name || p.category || null,
        unit: p.unit, price: Number(p.price) || null,
        supplier: p.supplier?.name || null, sku: p.sku, productId: p.id,
        stock: Number(p.stock) || 0,
      });
    }
    for (const p of presets) {
      push({
        key: `preset:${p.id}`, source: 'preset', name: p.name,
        category: p.category?.name || null, unit: p.unit,
        price: Number(p.avgPrice) || null, supplier: p.manufacturer || null,
        sku: null, productId: null, stock: null,
      });
    }
    for (const c of SUPPLY_CATALOG) {
      push({
        key: `catalog:${c.name}`, source: 'catalog', name: c.name,
        category: c.category, unit: c.unit, price: c.price,
        supplier: null, sku: null, productId: null, stock: null,
      });
    }

    // Один и тот же товар приходит из нескольких источников. Оставляем тот,
    // что даёт больше: своя позиция (её надо пополнить, а не дублировать),
    // затем товар маркета (его можно заказать), потом пресет и справочник.
    const rank = { clinic: 3, shop: 2, preset: 1, catalog: 0 } as const;
    const best = new Map<string, Suggestion>();
    for (const s of out) {
      const key = normalizeItemName(s.name);
      const prev = best.get(key);
      if (!prev || rank[s.source] > rank[prev.source] || (rank[s.source] === rank[prev.source] && s.score > prev.score)) {
        best.set(key, s);
      }
    }

    const ranked = [...best.values()]
      .sort((a, b) => b.score - a.score || rank[b.source] - rank[a.source] || a.name.localeCompare(b.name, 'ru'))
      .slice(0, limit);

    res.json({ ok: true, data: { suggestions: ranked, categories: SUPPLY_CATEGORIES } });
  } catch (error) {
    console.error('[inventory] suggest', error);
    res.status(500).json({ ok: false, error: 'Не удалось загрузить подсказки' });
  }
});

inventoryRouter.post('/', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { name, category, quantity, minimum, price, unit, supplier, sku, productId, autoRestock, expiryDate } = req.body;
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

    const startQty = qty ?? 0;
    const item = await prisma.inventoryItem.create({
      data: {
        id: uid(),
        name,
        clinicId,
        category: category || null,
        // Заводим пустой, а начальный остаток проводим движением — иначе в
        // журнале дыра: количество есть, объяснения нет.
        quantity: 0,
        minimum: min ?? 0,
        price: prc ?? 0,
        unit: unit || null,
        supplier: supplier || null,
        sku: sku || null,
        productId: productId || null,
        autoRestock: autoRestock !== false,
        expiryDate: parseExpiry(expiryDate) ?? null,
      },
    });

    if (startQty > 0) {
      await prisma.$transaction((tx) => recordMovement(tx, {
        clinicId,
        itemId: item.id,
        delta: startQty,
        reason: 'manual',
        note: 'Начальный остаток',
        userId: user?.id || null,
      }));
    }

    res.status(201).json({ ok: true, data: { ...item, quantity: startQty } });
  } catch (error) {
    console.error('[inventory] create', error);
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
    const { name, category, quantity, minimum, price, unit, supplier, sku, productId, autoRestock, expiryDate } = req.body;

    // Tenant scope: the item must belong to the caller's clinic (prevents cross-clinic IDOR).
    const existing = await prisma.inventoryItem.findFirst({
      where: { id, clinicId },
      select: { id: true, quantity: true },
    });
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

    await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(min !== undefined && { minimum: min }),
        ...(prc !== undefined && { price: prc }),
        ...(unit !== undefined && { unit }),
        ...(supplier !== undefined && { supplier }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(productId !== undefined && { productId: productId || null }),
        ...(autoRestock !== undefined && { autoRestock: autoRestock !== false }),
        ...(expiryDate !== undefined && { expiryDate: parseExpiry(expiryDate) ?? null }),
      },
    });

    // Остаток правим движением, а не присваиванием: иначе правка руками
    // выпадает из истории и «куда делись перчатки» снова без ответа.
    if (qty !== undefined && qty !== existing.quantity) {
      await prisma.$transaction((tx) => recordMovement(tx, {
        clinicId,
        itemId: id,
        delta: qty - existing.quantity,
        reason: 'correction',
        note: 'Правка остатка вручную',
        userId: req.user?.id || null,
      }));
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    res.json({ ok: true, data: item });
  } catch (error) {
    console.error('[inventory] update', error);
    res.status(500).json({ ok: false, error: 'Failed to update inventory item' });
  }
});

/** Приход или списание на заданное число единиц — кнопки «+/−» на складе. */
inventoryRouter.post('/:id/adjust', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }
    const delta = Math.trunc(Number(req.body?.delta));
    if (!Number.isFinite(delta) || delta === 0) {
      res.status(400).json({ ok: false, error: 'delta должна быть ненулевым целым числом' });
      return;
    }

    const outcome = await prisma.$transaction((tx) => recordMovement(tx, {
      clinicId,
      itemId: id,
      delta,
      reason: delta > 0 ? 'manual' : 'correction',
      note: req.body?.note ? String(req.body.note).slice(0, 200) : null,
      userId: req.user?.id || null,
    }));

    if (!isMovementApplied(outcome)) {
      const message = outcome.reason === 'empty'
        ? 'На складе нечего списывать'
        : 'Движение уже проведено';
      res.status(409).json({ ok: false, error: message });
      return;
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    res.json({ ok: true, data: { item, applied: outcome.delta, shortfall: outcome.shortfall } });
  } catch (error) {
    console.error('[inventory] adjust', error);
    res.status(500).json({ ok: false, error: 'Не удалось изменить остаток' });
  }
});

/** История движений позиции — ответ на «куда делись перчатки». */
inventoryRouter.get('/:id/movements', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(400).json({ ok: false, error: 'Clinic ID not found' });
      return;
    }
    const item = await prisma.inventoryItem.findFirst({ where: { id, clinicId }, select: { id: true } });
    if (!item) {
      res.status(404).json({ ok: false, error: 'Позиция склада не найдена' });
      return;
    }
    const movements = await prisma.inventoryMovement.findMany({
      where: { itemId: id, clinicId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(req.query.limit) || 50, 1), 200),
    });
    res.json({ ok: true, data: movements });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Не удалось загрузить историю' });
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
