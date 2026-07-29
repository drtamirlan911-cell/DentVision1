/**
 * Client-side DentCash rate helpers (mirrors backend rates.ts).
 * 100 bps = 1%. Used for catalog badges before checkout quote.
 */

export const DENTCASH_RATE_BPS = {
  consumables: 100, // 1%
  equipment: 200, // 2%
  ownBrand: 700, // 7%
  academy: 500, // 5%
  saas: 1000, // 10%
  promoMax: 1500,
} as const

const EQUIPMENT_HINTS = [
  'оборуд', 'equipment', 'микроскоп', 'кресл', 'компрессор', 'лазер',
  'сканер', 'установк', 'наконечник', 'мотор', 'автоклав',
]

export function isEquipmentCategory(category?: string | null, name?: string | null): boolean {
  const hay = `${category || ''} ${name || ''}`.toLowerCase()
  return EQUIPMENT_HINTS.some((h) => hay.includes(h))
}

export function estimateCashbackBps(opts: {
  ownBrand?: boolean
  category?: string | null
  name?: string | null
  promo?: boolean
}): number {
  if (opts.ownBrand) return DENTCASH_RATE_BPS.ownBrand
  if (opts.promo) return Math.min(DENTCASH_RATE_BPS.promoMax, 1000)
  if (isEquipmentCategory(opts.category, opts.name)) return DENTCASH_RATE_BPS.equipment
  return DENTCASH_RATE_BPS.consumables
}

export function estimateCashbackTenge(priceTenge: number, opts: {
  ownBrand?: boolean
  category?: string | null
  name?: string | null
  promo?: boolean
  qty?: number
} = {}): { bps: number; percent: number; tenge: number } {
  const bps = estimateCashbackBps(opts)
  const qty = Math.max(1, opts.qty || 1)
  const tenge = Math.floor((Math.round(priceTenge) * qty * bps) / 10000)
  return { bps, percent: bps / 100, tenge }
}

export function formatCashbackPercent(bps: number): string {
  const pct = bps / 100
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`
}
