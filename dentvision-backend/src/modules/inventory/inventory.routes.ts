import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { recordMovement, isMovementApplied } from './ledger.js';
import { SUPPLY_CATALOG, SUPPLY_CATEGORIES } from './supplyCatalog.js';
import { normalizeItemName } from './orderRestock.js';
import { resolveInventoryBranchContext, assertInventoryBranch } from '../../lib/inventoryBranchScope.js';

const inventoryRouter = Router();

function parseExpiry(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function nonNegativeNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

async function getBranchContext(req: AuthRequest, clinicId: string) {
  const user = req.user;
  if (!user?.id) return null;
  return resolveInventoryBranchContext(user.id, clinicId, String(user.role || ''));
}

function scopedWhere(context: Awaited<ReturnType<typeof resolveInventoryBranchContext>>) {
  return context.organizationWide
    ? { clinicId: context.clinicId }
    : { clinicId: context.clinicId, branchId: { in: context.branchIds } };
}

async function resolveCreateBranch(req: AuthRequest, clinicId: string) {
  const context = await getBranchContext(req, clinicId);
  if (!context || !context.branchIds.length) return null;
  const requested = typeof req.body?.branchId === 'string' ? req.body.branchId : null;
  const branchId = requested || context.branchId || context.branchIds[0];
  if (!context.branchIds.includes(branchId)) return null;
  if (!(await assertInventoryBranch(branchId, clinicId))) return null;
  return { context, branchId };
}

inventoryRouter.use(authenticate);
inventoryRouter.use(loadClinicAccess);
inventoryRouter.use(blockClinicWrites);

inventoryRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) {
      res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return;
    }
    const { q, category } = req.query;
    const where: any = scopedWhere(context);
    if (q && typeof q === 'string') where.OR = [{ name: { contains: q } }, { supplier: { contains: q } }];
    if (category && typeof category === 'string') where.category = category;
    const items = await prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ ok: true, data: items });
  } catch { res.status(500).json({ ok: false, error: 'Failed to fetch inventory items' }); }
});

interface Suggestion {
  key: string; source: 'clinic' | 'shop' | 'preset' | 'catalog'; name: string; category: string | null;
  unit: string | null; price: number | null; supplier: string | null; sku: string | null;
  productId: string | null; existingItemId: string | null; existingQuantity: number | null;
  stock: number | null; score: number;
}

function scoreSuggestion(name: string, query: string): number {
  const n = normalizeItemName(name), q = normalizeItemName(query);
  if (!q) return 1; if (!n) return 0; if (n === q) return 100; if (n.startsWith(q)) return 80;
  if (n.includes(` ${q}`)) return 60; if (n.includes(q)) return 40;
  const words = q.split(' ').filter(Boolean);
  return words.length > 1 && words.every((w) => n.includes(w)) ? 30 : 0;
}

inventoryRouter.get('/suggest', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) {
      res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return;
    }
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 40);
    const [own, products, presets] = await Promise.all([
      prisma.inventoryItem.findMany({ where: scopedWhere(context), select: { id: true, name: true, category: true, unit: true, price: true, supplier: true, sku: true, productId: true, quantity: true } }),
      prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, sku: true, unit: true, price: true, stock: true, category: true, shopCategory: { select: { name: true } }, supplier: { select: { name: true } } }, take: 400 }),
      prisma.productPreset.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true, avgPrice: true, manufacturer: true, category: { select: { name: true } } }, take: 300 }),
    ]);
    const ownByName = new Map(own.map((i) => [normalizeItemName(i.name), i]));
    const out: Suggestion[] = [];
    const push = (s: Omit<Suggestion, 'score' | 'existingItemId' | 'existingQuantity'>) => {
      const score = scoreSuggestion(s.name, q); if (!score) return;
      const existing = ownByName.get(normalizeItemName(s.name));
      out.push({ ...s, existingItemId: existing?.id || null, existingQuantity: existing?.quantity ?? null, score });
    };
    for (const i of own) push({ key: `clinic:${i.id}`, source: 'clinic', name: i.name, category: i.category, unit: i.unit, price: i.price, supplier: i.supplier, sku: i.sku, productId: i.productId, stock: null });
    for (const p of products) push({ key: `shop:${p.id}`, source: 'shop', name: p.name, category: p.shopCategory?.name || p.category || null, unit: p.unit, price: Number(p.price) || null, supplier: p.supplier?.name || null, sku: p.sku, productId: p.id, stock: Number(p.stock) || 0 });
    for (const p of presets) push({ key: `preset:${p.id}`, source: 'preset', name: p.name, category: p.category?.name || null, unit: p.unit, price: Number(p.avgPrice) || null, supplier: p.manufacturer || null, sku: null, productId: null, stock: null });
    for (const c of SUPPLY_CATALOG) push({ key: `catalog:${c.name}`, source: 'catalog', name: c.name, category: c.category, unit: c.unit, price: c.price, supplier: null, sku: null, productId: null, stock: null });
    const rank = { clinic: 3, shop: 2, preset: 1, catalog: 0 } as const;
    const best = new Map<string, Suggestion>();
    for (const s of out) { const key = normalizeItemName(s.name), prev = best.get(key); if (!prev || rank[s.source] > rank[prev.source] || (rank[s.source] === rank[prev.source] && s.score > prev.score)) best.set(key, s); }
    const ranked = [...best.values()].sort((a, b) => b.score - a.score || rank[b.source] - rank[a.source] || a.name.localeCompare(b.name, 'ru')).slice(0, limit);
    res.json({ ok: true, data: { suggestions: ranked, categories: SUPPLY_CATEGORIES } });
  } catch (error) { console.error('[inventory] suggest', error); res.status(500).json({ ok: false, error: 'Не удалось загрузить подсказки' }); }
});

inventoryRouter.post('/', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const user = req.user, clinicId = user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const target = await resolveCreateBranch(req, clinicId);
    if (!target) { res.status(403).json({ ok: false, error: 'Branch access is not configured or branch is not allowed' }); return; }
    const { name, category, quantity, minimum, price, unit, supplier, sku, productId, autoRestock, expiryDate } = req.body;
    if (!name || quantity === undefined) { res.status(400).json({ ok: false, error: 'name and quantity are required' }); return; }
    const qty = nonNegativeNumber(quantity), min = nonNegativeNumber(minimum), prc = nonNegativeNumber(price);
    if (Number.isNaN(qty) || Number.isNaN(min) || Number.isNaN(prc)) { res.status(400).json({ ok: false, error: 'quantity, minimum и price должны быть числом ≥ 0' }); return; }
    const startQty = qty ?? 0;
    const item = await prisma.inventoryItem.create({ data: { id: uid(), name, clinicId, branchId: target.branchId, category: category || null, quantity: 0, minimum: min ?? 0, price: prc ?? 0, unit: unit || null, supplier: supplier || null, sku: sku || null, productId: productId || null, autoRestock: autoRestock !== false, expiryDate: parseExpiry(expiryDate) ?? null } });
    if (startQty > 0) await prisma.$transaction((tx) => recordMovement(tx, { clinicId, itemId: item.id, delta: startQty, reason: 'manual', note: 'Начальный остаток', userId: user?.id || null }));
    res.status(201).json({ ok: true, data: { ...item, quantity: startQty } });
  } catch (error) { console.error('[inventory] create', error); res.status(500).json({ ok: false, error: 'Failed to create inventory item' }); }
});

inventoryRouter.patch('/:id', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string }, clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) { res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return; }
    const { name, category, quantity, minimum, price, unit, supplier, sku, productId, autoRestock, expiryDate, branchId } = req.body;
    const existing = await prisma.inventoryItem.findFirst({ where: { id, ...scopedWhere(context) }, select: { id: true, quantity: true, branchId: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Позиция склада не найдена' }); return; }
    if (branchId !== undefined && (!context.organizationWide || !(await assertInventoryBranch(branchId, clinicId)))) { res.status(403).json({ ok: false, error: 'Недопустимый филиал' }); return; }
    if (branchId !== undefined && !context.branchIds.includes(branchId)) { res.status(403).json({ ok: false, error: 'Недопустимый филиал' }); return; }
    const qty = nonNegativeNumber(quantity), min = nonNegativeNumber(minimum), prc = nonNegativeNumber(price);
    if (Number.isNaN(qty) || Number.isNaN(min) || Number.isNaN(prc)) { res.status(400).json({ ok: false, error: 'quantity, minimum и price должны быть числом ≥ 0' }); return; }
    await prisma.inventoryItem.update({ where: { id }, data: { ...(name !== undefined && { name }), ...(category !== undefined && { category }), ...(min !== undefined && { minimum: min }), ...(prc !== undefined && { price: prc }), ...(unit !== undefined && { unit }), ...(supplier !== undefined && { supplier }), ...(sku !== undefined && { sku: sku || null }), ...(productId !== undefined && { productId: productId || null }), ...(autoRestock !== undefined && { autoRestock: autoRestock !== false }), ...(expiryDate !== undefined && { expiryDate: parseExpiry(expiryDate) ?? null }), ...(branchId !== undefined && { branchId }) } });
    if (qty !== undefined && qty !== existing.quantity) await prisma.$transaction((tx) => recordMovement(tx, { clinicId, itemId: id, delta: qty - existing.quantity, reason: 'correction', note: 'Правка остатка вручную', userId: req.user?.id || null }));
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    res.json({ ok: true, data: item });
  } catch (error) { console.error('[inventory] update', error); res.status(500).json({ ok: false, error: 'Failed to update inventory item' }); }
});

inventoryRouter.post('/:id/adjust', requirePermission('inventory.write'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string }, clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) { res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return; }
    const item = await prisma.inventoryItem.findFirst({ where: { id, ...scopedWhere(context) }, select: { id: true } });
    if (!item) { res.status(404).json({ ok: false, error: 'Позиция склада не найдена' }); return; }
    const delta = Math.trunc(Number(req.body?.delta));
    if (!Number.isFinite(delta) || delta === 0) { res.status(400).json({ ok: false, error: 'delta должна быть ненулевым целым числом' }); return; }
    const outcome = await prisma.$transaction((tx) => recordMovement(tx, { clinicId, itemId: id, delta, reason: delta > 0 ? 'manual' : 'correction', note: req.body?.note ? String(req.body.note).slice(0, 200) : null, userId: req.user?.id || null }));
    if (!isMovementApplied(outcome)) { res.status(409).json({ ok: false, error: outcome.reason === 'empty' ? 'На складе нечего списывать' : 'Движение уже проведено' }); return; }
    const updated = await prisma.inventoryItem.findUnique({ where: { id } });
    res.json({ ok: true, data: { item: updated, applied: outcome.delta, shortfall: outcome.shortfall } });
  } catch (error) { console.error('[inventory] adjust', error); res.status(500).json({ ok: false, error: 'Не удалось изменить остаток' }); }
});

inventoryRouter.get('/:id/movements', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string }, clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) { res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return; }
    const item = await prisma.inventoryItem.findFirst({ where: { id, ...scopedWhere(context) }, select: { id: true } });
    if (!item) { res.status(404).json({ ok: false, error: 'Позиция склада не найдена' }); return; }
    const movements = await prisma.inventoryMovement.findMany({ where: { itemId: id, clinicId }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(Number(req.query.limit) || 50, 1), 200) });
    res.json({ ok: true, data: movements });
  } catch { res.status(500).json({ ok: false, error: 'Не удалось загрузить историю' }); }
});

inventoryRouter.delete('/:id', requirePermission('inventory.delete'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string }, clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) { res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return; }
    const result = await prisma.inventoryItem.deleteMany({ where: { id, ...scopedWhere(context) } });
    if (!result.count) { res.status(404).json({ ok: false, error: 'Позиция склада не найдена' }); return; }
    res.json({ ok: true, data: null });
  } catch { res.status(500).json({ ok: false, error: 'Failed to delete inventory item' }); }
});

inventoryRouter.get('/low-stock', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) { res.status(400).json({ ok: false, error: 'Clinic ID not found' }); return; }
    const context = await getBranchContext(req, clinicId);
    if (!context || (!context.organizationWide && !context.branchIds.length)) { res.status(403).json({ ok: false, error: 'Branch access is not configured' }); return; }
    const allItems = await prisma.inventoryItem.findMany({ where: scopedWhere(context) });
    res.json({ ok: true, data: allItems.filter((item) => item.quantity <= item.minimum) });
  } catch { res.status(500).json({ ok: false, error: 'Failed to fetch low stock items' }); }
});

export { inventoryRouter };
