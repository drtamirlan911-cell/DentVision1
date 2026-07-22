/**
 * Pure unit tests for SaaS plan gate helpers (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  PLAN_ENTITLEMENTS,
  entitlementsForPlan,
  normalizeSaasPlanId,
  assertClinicWritable,
  assertFeature,
  assertPatientSlot,
  assertAiAllowed,
  PlanGateError,
  type ClinicAccessState,
} from './planEntitlements.js'

function baseAccess(over: Partial<ClinicAccessState> = {}): ClinicAccessState {
  const entitlements = PLAN_ENTITLEMENTS.starter
  return {
    clinicId: 'c1',
    clinicName: 'Test',
    clinicPlan: 'STANDARD',
    saasPlan: 'starter',
    status: 'active',
    active: true,
    expired: false,
    writeBlocked: false,
    periodEnd: null,
    daysLeft: null,
    entitlements,
    usage: { patients: 0, users: 1, aiRequestsThisMonth: 0 },
    limits: { patientsReached: false, usersReached: false, aiQuotaReached: false },
    approaching: { patients: false, users: false, ai: false },
    ...over,
  }
}

describe('planEntitlements gate logic', () => {
  it('maps legacy clinic plans', () => {
    expect(normalizeSaasPlanId('pro')).toBe('professional')
    expect(entitlementsForPlan('PRO').saasPlan).toBe('professional')
    expect(entitlementsForPlan('DEMO').maxPatients).toBe(25)
  })

  it('blocks writes when subscription expired', () => {
    const access = baseAccess({ writeBlocked: true, expired: true, status: 'expired' })
    expect(() => assertClinicWritable(access)).toThrow(PlanGateError)
    try {
      assertClinicWritable(access)
    } catch (e) {
      expect((e as PlanGateError).code).toBe('SUBSCRIPTION_EXPIRED')
    }
  })

  it('blocks AI on starter', () => {
    const access = baseAccess()
    expect(() => assertAiAllowed(access)).toThrow(PlanGateError)
    try {
      assertAiAllowed(access)
    } catch (e) {
      expect((e as PlanGateError).code).toBe('PLAN_FEATURE_REQUIRED')
    }
  })

  it('allows analytics only on professional+', () => {
    const starter = baseAccess()
    expect(() => assertFeature(starter, 'analytics')).toThrow(PlanGateError)

    const pro = baseAccess({
      saasPlan: 'professional',
      entitlements: PLAN_ENTITLEMENTS.professional,
    })
    expect(() => assertFeature(pro, 'analytics')).not.toThrow()
  })

  it('enforces patient hard cap', () => {
    const access = baseAccess({
      usage: { patients: 100, users: 1, aiRequestsThisMonth: 0 },
      limits: { patientsReached: true, usersReached: false, aiQuotaReached: false },
    })
    expect(() => assertPatientSlot(access)).toThrow(PlanGateError)
    try {
      assertPatientSlot(access)
    } catch (e) {
      expect((e as PlanGateError).code).toBe('PLAN_PATIENT_LIMIT')
    }
  })

  it('enforces AI monthly quota on professional', () => {
    const access = baseAccess({
      saasPlan: 'professional',
      entitlements: PLAN_ENTITLEMENTS.professional,
      usage: { patients: 10, users: 2, aiRequestsThisMonth: 100 },
      limits: { patientsReached: false, usersReached: false, aiQuotaReached: true },
    })
    expect(() => assertAiAllowed(access)).toThrow(PlanGateError)
    try {
      assertAiAllowed(access)
    } catch (e) {
      expect((e as PlanGateError).code).toBe('PLAN_AI_QUOTA')
    }
  })
})
