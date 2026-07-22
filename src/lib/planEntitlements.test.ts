import { describe, expect, it } from 'vitest'
import {
  entitlementsForPlan,
  normalizeSaasPlanId,
  PLAN_ENTITLEMENTS,
  isApproachingCap,
  isHardCapReached,
  isWriteBlocked,
} from './planEntitlements'

describe('plan entitlements', () => {
  it('normalizes aliases', () => {
    expect(normalizeSaasPlanId('pro')).toBe('professional')
    expect(normalizeSaasPlanId('DEMO')).toBe('free')
  })

  it('starter caps patients/users and blocks AI', () => {
    const e = entitlementsForPlan('starter')
    expect(e.maxPatients).toBe(100)
    expect(e.maxUsers).toBe(1)
    expect(e.features.ai).toBe(false)
    expect(e.features.analytics).toBe(false)
  })

  it('professional unlocks AI with monthly quota', () => {
    const e = entitlementsForPlan('professional')
    expect(e.maxPatients).toBeNull()
    expect(e.maxUsers).toBe(10)
    expect(e.features.ai).toBe(true)
    expect(e.aiRequestsPerMonth).toBe(100)
  })

  it('enterprise is unlimited', () => {
    const e = entitlementsForPlan('ENTERPRISE')
    expect(e.maxUsers).toBeNull()
    expect(e.aiRequestsPerMonth).toBeNull()
    expect(e.features.multiClinic).toBe(true)
  })

  it('has four plans', () => {
    expect(Object.keys(PLAN_ENTITLEMENTS)).toHaveLength(4)
  })

  it('soft-approaches at 80% before hard cap', () => {
    expect(isApproachingCap(80, 100)).toBe(true)
    expect(isApproachingCap(79, 100)).toBe(false)
    expect(isApproachingCap(100, 100)).toBe(false)
    expect(isHardCapReached(100, 100)).toBe(true)
    expect(isApproachingCap(50, null)).toBe(false)
  })

  it('writeBlocked mirrors expired subscription', () => {
    expect(isWriteBlocked({ expired: true })).toBe(true)
    expect(isWriteBlocked({ writeBlocked: true })).toBe(true)
    expect(isWriteBlocked({ expired: false, writeBlocked: false })).toBe(false)
  })
})
