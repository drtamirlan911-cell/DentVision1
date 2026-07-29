/**
 * Match clinic warehouse items to marketplace products (exact / analog).
 * Inventory and shop catalogs are separate — matching is name/category fuzzy.
 */

export type LowStockLike = {
  id?: string;
  name?: string | null;
  quantity?: number | null;
  minQuantity?: number | null;
  min?: number | null;
  minimum?: number | null;
  category?: string | null;
  unit?: string | null;
};

export type ShopMatchLike = {
  id: string;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  category_name?: string | null;
  description?: string | null;
  stock?: number | null;
  price?: number | null;
};

export type ClinicRestockSuggestion = {
  item: LowStockLike;
  min: number;
  matches: Array<ShopMatchLike & { score: number; kind: 'exact' | 'analog' }>;
  query: string;
};

const STOP = new Set([
  'и', 'для', 'the', 'a', 'an', 'of', 'шт', 'уп', 'упак', 'упаковка', 'набор',
  'dental', 'dent', 'стомат', 'клиника',
]);

export function clinicMinQty(item: LowStockLike): number {
  return Number(item.minQuantity ?? item.min ?? item.minimum ?? 0) || 0;
}

export function isClinicLowStock(item: LowStockLike): boolean {
  const min = clinicMinQty(item);
  return min > 0 && Number(item.quantity ?? 0) <= min;
}

export function tokenizeName(raw: string): string[] {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+-]/gu, ' ')
    .split(/[\s+/,-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function scoreMatch(item: LowStockLike, product: ShopMatchLike): { score: number; kind: 'exact' | 'analog' } {
  const invName = String(item.name || '').toLowerCase().trim();
  const prodName = String(product.name || '').toLowerCase().trim();
  const brand = String(product.brand || '').toLowerCase().trim();
  const cat = String(product.category || product.category_name || '').toLowerCase().trim();
  const invCat = String(item.category || '').toLowerCase().trim();
  const hay = `${prodName} ${brand} ${cat} ${String(product.description || '').toLowerCase()}`;

  if (!invName || !prodName) return { score: 0, kind: 'analog' };

  if (prodName === invName || prodName.includes(invName) || invName.includes(prodName)) {
    return { score: 100, kind: 'exact' };
  }

  const tokens = tokenizeName(invName);
  if (!tokens.length) return { score: 0, kind: 'analog' };

  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  const ratio = hits / tokens.length;
  let score = Math.round(ratio * 70);

  if (invCat && cat && (cat.includes(invCat) || invCat.includes(cat))) {
    score += 15;
  }
  if (brand && tokens.some((t) => brand.includes(t))) {
    score += 10;
  }
  if ((product.stock ?? 0) <= 0) {
    score = Math.max(0, score - 25);
  }

  return { score, kind: score >= 85 ? 'exact' : 'analog' };
}

export function findShopMatches(
  item: LowStockLike,
  products: ShopMatchLike[],
  limit = 3,
): Array<ShopMatchLike & { score: number; kind: 'exact' | 'analog' }> {
  return products
    .map((p) => {
      const { score, kind } = scoreMatch(item, p);
      return { ...p, score, kind };
    })
    .filter((p) => p.score >= 28)
    .sort((a, b) => b.score - a.score || (b.stock || 0) - (a.stock || 0))
    .slice(0, limit);
}

export function buildClinicRestockSuggestions(
  inventory: LowStockLike[],
  products: ShopMatchLike[],
  opts?: { onlyWithMatches?: boolean; limit?: number },
): ClinicRestockSuggestion[] {
  const onlyWithMatches = opts?.onlyWithMatches ?? false;
  const limit = opts?.limit ?? 8;
  const low = inventory.filter(isClinicLowStock);
  const out: ClinicRestockSuggestion[] = [];

  for (const item of low) {
    const matches = findShopMatches(item, products, 3);
    if (onlyWithMatches && matches.length === 0) continue;
    out.push({
      item,
      min: clinicMinQty(item),
      matches,
      query: String(item.name || '').trim(),
    });
  }

  return out
    .sort((a, b) => {
      const aAvail = a.matches.some((m) => (m.stock || 0) > 0) ? 1 : 0;
      const bAvail = b.matches.some((m) => (m.stock || 0) > 0) ? 1 : 0;
      if (bAvail !== aAvail) return bAvail - aAvail;
      return b.matches.length - a.matches.length;
    })
    .slice(0, limit);
}
