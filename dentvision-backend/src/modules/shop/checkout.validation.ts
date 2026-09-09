/**
 * Security boundary for Shop checkout input.
 * Never coerce malformed quantities into a valid quantity: client input is
 * untrusted and must be a positive integer before inventory is touched.
 */
export function parseCheckoutQuantity(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }

  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function parseCheckoutCashMinor(raw: unknown): bigint | null {
  if (typeof raw === 'bigint') return raw >= 0n ? raw : null;
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0) return null;
    return BigInt(raw);
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!/^\d+$/.test(value)) return null;
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function isValidCheckoutItem(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

export interface NormalizedCheckoutItem {
  productId: string;
  quantity: number;
}

/**
 * Canonicalize cart items once, before any product lookup or stock mutation.
 * Duplicate product ids are rejected rather than silently creating multiple
 * inventory mutations with ambiguous semantics.
 */
export function normalizeCheckoutItems(rawItems: unknown): NormalizedCheckoutItem[] | null {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

  const normalized: NormalizedCheckoutItem[] = [];
  const seen = new Set<string>();

  for (const raw of rawItems) {
    if (!isValidCheckoutItem(raw)) return null;

    const productId = String(raw.product_id ?? raw.productId ?? raw.id ?? '').trim();
    const hasExplicitQuantity = Object.prototype.hasOwnProperty.call(raw, 'quantity') || Object.prototype.hasOwnProperty.call(raw, 'qty');
    const quantityRaw = raw.quantity ?? raw.qty;
    const quantity = hasExplicitQuantity ? parseCheckoutQuantity(quantityRaw) : 1;

    if (!productId || quantity === null || seen.has(productId)) return null;

    seen.add(productId);
    normalized.push({ productId, quantity });
  }

  return normalized;
}
