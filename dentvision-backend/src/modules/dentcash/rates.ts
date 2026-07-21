/**
 * DentCash rate helpers (pure) — 1 DentCash = 1 ₸ = 100 тиын.
 * Rates are in basis points (100 = 1%).
 */

export const RATE_BPS = {
  consumables: 100,   // 1%
  equipment: 200,     // 2%
  ownBrand: 700,      // 7%
  academy: 500,       // 5%
  saas: 1000,         // 10% PLATFORM-funded
  promoMax: 1500,     // 15% cap for promo rules
  absoluteMax: 1500,
} as const;

const EQUIPMENT_HINTS = [
  'оборуд', 'equipment', 'микроскоп', 'кресл', 'компрессор', 'лазер',
  'сканер', 'установк', 'наконечник', 'мотор', 'автоклав',
];

export function isEquipmentCategory(category?: string | null, name?: string | null): boolean {
  const hay = `${category || ''} ${name || ''}`.toLowerCase();
  return EQUIPMENT_HINTS.some((h) => hay.includes(h));
}

export function defaultShopRateBps(opts: {
  ownBrand?: boolean;
  category?: string | null;
  name?: string | null;
  promo?: boolean;
}): number {
  if (opts.ownBrand) return RATE_BPS.ownBrand;
  if (opts.promo) return Math.min(RATE_BPS.promoMax, 1000);
  if (isEquipmentCategory(opts.category, opts.name)) return RATE_BPS.equipment;
  return RATE_BPS.consumables;
}

export function cashbackMinor(amountMinor: bigint, rateBps: number, capMinor?: bigint | null): bigint {
  const bps = Math.max(0, Math.min(RATE_BPS.absoluteMax, Math.floor(rateBps)));
  let earned = (amountMinor * BigInt(bps)) / 10000n;
  if (capMinor != null && capMinor > 0n && earned > capMinor) earned = capMinor;
  return earned < 0n ? 0n : earned;
}

/**
 * Scale cashback when DentCash was spent on the order.
 * Earn applies to the cash portion of goods only (delivery excluded from base).
 */
export function scaleEarnAfterSpend(opts: {
  earnMinor: bigint;
  goodsMinor: bigint;
  spendMinor: bigint;
}): bigint {
  if (opts.earnMinor <= 0n || opts.goodsMinor <= 0n) return 0n;
  const spendOnGoods = opts.spendMinor > opts.goodsMinor ? opts.goodsMinor : opts.spendMinor < 0n ? 0n : opts.spendMinor;
  const paidCash = opts.goodsMinor - spendOnGoods;
  if (paidCash <= 0n) return 0n;
  if (paidCash >= opts.goodsMinor) return opts.earnMinor;
  return (opts.earnMinor * paidCash) / opts.goodsMinor;
}

export type RuleLike = {
  scope: string;
  scopeKey?: string | null;
  rateBps: number;
  capMinor?: bigint | null;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

/** Pick best matching rule: PRODUCT > OWN_BRAND > CATEGORY > ALL. Higher rate wins ties. */
export function pickBestRule(
  rules: RuleLike[],
  ctx: { productId?: string; category?: string | null; ownBrand?: boolean },
  now = new Date(),
): RuleLike | null {
  const live = rules.filter((r) => {
    if (r.active === false) return false;
    if (r.startsAt && r.startsAt > now) return false;
    if (r.endsAt && r.endsAt < now) return false;
    return true;
  });

  const ranked: Array<{ score: number; rule: RuleLike }> = [];
  for (const r of live) {
    const scope = String(r.scope || 'ALL').toUpperCase();
    if (scope === 'PRODUCT' && ctx.productId && r.scopeKey === ctx.productId) {
      ranked.push({ score: 400 + r.rateBps, rule: r });
    } else if (scope === 'OWN_BRAND' && ctx.ownBrand) {
      ranked.push({ score: 300 + r.rateBps, rule: r });
    } else if (scope === 'CATEGORY' && ctx.category && r.scopeKey?.toLowerCase() === ctx.category.toLowerCase()) {
      ranked.push({ score: 200 + r.rateBps, rule: r });
    } else if (scope === 'ALL') {
      ranked.push({ score: 100 + r.rateBps, rule: r });
    }
  }
  if (!ranked.length) return null;
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0].rule;
}
