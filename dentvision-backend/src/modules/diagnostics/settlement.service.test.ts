import { describe, expect, it } from 'vitest'
import { sumPlatformFeeMinor, referralOwner } from './settlement.service.js'

describe('sumPlatformFeeMinor', () => {
  it('sums platformFee (tenge) into minor units (тиын)', () => {
    // 1000 + 500.50 + 0 = 1500.50 tenge → 150050 тиын
    expect(sumPlatformFeeMinor([
      { platformFee: 1000 },
      { platformFee: 500.5 },
      { platformFee: 0 },
    ])).toBe(150050n)
  })

  it('treats null/undefined/garbage fees as zero', () => {
    expect(sumPlatformFeeMinor([
      { platformFee: null },
      { platformFee: undefined },
      { platformFee: 'x' as unknown },
      {},
    ])).toBe(0n)
  })

  it('accepts Decimal-like values via String coercion', () => {
    // Prisma Decimal stringifies; Number('2500.75') = 2500.75 → 250075 тиын
    expect(sumPlatformFeeMinor([{ platformFee: '2500.75' }])).toBe(250075n)
  })

  it('returns 0n for an empty list', () => {
    expect(sumPlatformFeeMinor([])).toBe(0n)
  })
})

describe('referralOwner', () => {
  it('prefers center over lab', () => {
    expect(referralOwner({ centerId: 'c1', labId: 'l1' })).toEqual({ ownerType: 'CENTER', ownerId: 'c1' })
  })

  it('falls back to lab when no center', () => {
    expect(referralOwner({ centerId: null, labId: 'l1' })).toEqual({ ownerType: 'LAB', ownerId: 'l1' })
  })

  it('returns null when neither is set', () => {
    expect(referralOwner({ centerId: null, labId: null })).toBeNull()
    expect(referralOwner({})).toBeNull()
  })
})
