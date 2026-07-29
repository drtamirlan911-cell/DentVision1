/** Pure plan catalog helpers — safe for unit tests without DB. */
export type PlanFeature =
  | 'ai'
  | 'analytics'
  | 'crm'
  | 'marketplace'
  | 'academy'
  | 'multiClinic'
  | 'prioritySupport'

export type SaasPlanKey = 'free' | 'starter' | 'professional' | 'enterprise'

export type PlanEntitlements = {
  saasPlan: SaasPlanKey
  maxPatients: number | null
  maxUsers: number | null
  aiRequestsPerMonth: number | null
  features: Record<PlanFeature, boolean>
}

export const PLAN_ENTITLEMENTS: Record<SaasPlanKey, PlanEntitlements> = {
  free: {
    saasPlan: 'free',
    maxPatients: 25,
    maxUsers: 1,
    aiRequestsPerMonth: 0,
    features: {
      ai: false,
      analytics: false,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: false,
      prioritySupport: false,
    },
  },
  starter: {
    saasPlan: 'starter',
    maxPatients: 100,
    maxUsers: 1,
    aiRequestsPerMonth: 0,
    features: {
      ai: false,
      analytics: false,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: false,
      prioritySupport: false,
    },
  },
  professional: {
    saasPlan: 'professional',
    maxPatients: null,
    maxUsers: 10,
    aiRequestsPerMonth: 100,
    features: {
      ai: true,
      analytics: true,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: false,
      prioritySupport: false,
    },
  },
  enterprise: {
    saasPlan: 'enterprise',
    maxPatients: null,
    maxUsers: null,
    aiRequestsPerMonth: null,
    features: {
      ai: true,
      analytics: true,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: true,
      prioritySupport: true,
    },
  },
}

export function normalizeSaasPlanId(raw: string | null | undefined): SaasPlanKey {
  const v = String(raw || 'free').toLowerCase()
  if (v === 'pro') return 'professional'
  if (v === 'standard') return 'starter'
  if (v === 'demo') return 'professional'
  if (v === 'free') return 'free'
  if (v === 'starter' || v === 'professional' || v === 'enterprise') return v
  return 'free'
}

export function entitlementsForPlan(plan: string): PlanEntitlements {
  const map: Record<string, SaasPlanKey> = {
    DEMO: 'professional',
    STANDARD: 'starter',
    PRO: 'professional',
    ENTERPRISE: 'enterprise',
  }
  const key = map[plan] || normalizeSaasPlanId(plan)
  return { ...PLAN_ENTITLEMENTS[key] }
}

/** Soft warning threshold before hard block (matches backend). */
export const PLAN_APPROACH_RATIO = 0.8

export function isApproachingCap(used: number, max: number | null | undefined, ratio = PLAN_APPROACH_RATIO): boolean {
  if (max == null || max <= 0) return false
  if (used >= max) return false
  return used / max >= ratio
}

export function isHardCapReached(used: number, max: number | null | undefined): boolean {
  return max != null && max > 0 && used >= max
}

/** Whether a write should be blocked for an expired / suspended clinic. */
export function isWriteBlocked(snap: {
  expired?: boolean
  writeBlocked?: boolean
} | null | undefined): boolean {
  return Boolean(snap?.expired || snap?.writeBlocked)
}
