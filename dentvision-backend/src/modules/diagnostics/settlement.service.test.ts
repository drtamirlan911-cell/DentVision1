import { describe, expect, it } from 'vitest'
import { sumPlatformFeeMinor, referralOwner, referralPartnerVertical } from './settlement.service.js'
import { PARTNER_VERTICALS } from '../finance/partner-economics.service.js'

describe('sumPlatformFeeMinor', () => {
  it('sums platformFee (tenge) into minor units (тиын)', () => {
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

describe('referralPartnerVertical', () => {
  it('routes diagnostic centers to the 3D diagnostics economics rule', () => {
    expect(referralPartnerVertical({ centerId: 'c1', labId: null })).toBe(PARTNER_VERTICALS.DIAGNOSTIC_3D)
  })

  it('routes medical laboratories to the medical analysis economics rule', () => {
    expect(referralPartnerVertical({ centerId: null, labId: 'l1' })).toBe(PARTNER_VERTICALS.MEDICAL_ANALYSIS)
  })

  it('returns null for an unowned referral', () => {
    expect(referralPartnerVertical({ centerId: null, labId: null })).toBeNull()
  })
})
