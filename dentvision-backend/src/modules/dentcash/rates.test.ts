import { describe, it, expect } from 'vitest'
import {
  RATE_BPS,
  cashbackMinor,
  defaultShopRateBps,
  isEquipmentCategory,
  pickBestRule,
} from './rates'

function clampRateBps(rateBps: number): number {
  return Math.max(0, Math.min(RATE_BPS.absoluteMax, Math.floor(rateBps || 0)))
}

describe('defaultShopRateBps', () => {
  it('uses own-brand tier', () => {
    expect(defaultShopRateBps({ ownBrand: true })).toBe(RATE_BPS.ownBrand)
  })
  it('uses equipment hints', () => {
    expect(defaultShopRateBps({ category: 'Оборудование' })).toBe(RATE_BPS.equipment)
    expect(isEquipmentCategory('сканер')).toBe(true)
  })
  it('defaults to consumables', () => {
    expect(defaultShopRateBps({ category: 'Расходники' })).toBe(RATE_BPS.consumables)
  })
})

describe('cashbackMinor', () => {
  it('computes 1% of 10_000 tenge (1_000_000 tiyn)', () => {
    expect(cashbackMinor(1_000_000n, 100)).toBe(10_000n)
  })
  it('applies cap', () => {
    expect(cashbackMinor(1_000_000n, 1000, 5_000n)).toBe(5_000n)
  })
  it('clamps rate to absolute max', () => {
    expect(cashbackMinor(1_000_000n, 99999)).toBe(cashbackMinor(1_000_000n, RATE_BPS.absoluteMax))
  })
})

describe('pickBestRule', () => {
  const rules = [
    { scope: 'ALL', rateBps: 100, active: true },
    { scope: 'CATEGORY', scopeKey: 'implants', rateBps: 300, active: true },
    { scope: 'PRODUCT', scopeKey: 'p1', rateBps: 500, active: true },
    { scope: 'OWN_BRAND', rateBps: 700, active: true },
    { scope: 'PRODUCT', scopeKey: 'p2', rateBps: 200, active: false },
  ]

  it('prefers PRODUCT over CATEGORY/ALL', () => {
    const r = pickBestRule(rules, { productId: 'p1', category: 'implants' })
    expect(r?.scope).toBe('PRODUCT')
    expect(r?.rateBps).toBe(500)
  })

  it('uses OWN_BRAND when no product rule', () => {
    const r = pickBestRule(rules, { productId: 'other', category: 'x', ownBrand: true })
    expect(r?.scope).toBe('OWN_BRAND')
  })

  it('falls back to ALL', () => {
    const r = pickBestRule(rules, { productId: 'x', category: 'y' })
    expect(r?.scope).toBe('ALL')
  })

  it('ignores expired rules', () => {
    const past = new Date('2020-01-01')
    const r = pickBestRule(
      [{ scope: 'ALL', rateBps: 900, active: true, endsAt: past }],
      {},
      new Date('2024-01-01'),
    )
    expect(r).toBeNull()
  })
})

describe('clampRateBps / fraud helpers', () => {
  it('clamps to 0..promoMax', () => {
    expect(clampRateBps(-10)).toBe(0)
    expect(clampRateBps(2000)).toBe(RATE_BPS.absoluteMax)
    expect(clampRateBps(750.9)).toBe(750)
  })
})

/** Proportional refund remaining after partial spend (pure math used by refund path). */
describe('refund proportional remaining', () => {
  function remainingAfterSpend(earned: bigint, spentFromEarn: bigint): bigint {
    const left = earned - spentFromEarn
    return left < 0n ? 0n : left
  }

  it('reverses unused portion', () => {
    expect(remainingAfterSpend(10_000n, 3_000n)).toBe(7_000n)
  })
  it('zero when fully spent', () => {
    expect(remainingAfterSpend(10_000n, 10_000n)).toBe(0n)
  })
})
