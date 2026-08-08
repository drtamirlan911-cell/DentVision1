import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Crown, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { cn } from '@/lib/utils'

export type PlanEntitlementsSnapshot = {
  expired?: boolean
  writeBlocked?: boolean
  saasPlan?: string
  expiringSoon?: boolean
  daysLeft?: number | null
  entitlements?: {
    maxPatients?: number | null
    maxUsers?: number | null
    aiRequestsPerMonth?: number | null
    features?: Record<string, boolean>
  }
  usage?: { patients?: number; users?: number; aiRequestsThisMonth?: number }
  limits?: { patientsReached?: boolean; usersReached?: boolean; aiQuotaReached?: boolean }
  approaching?: { patients?: boolean; users?: boolean; ai?: boolean }
}

const DISMISS_KEY = 'dv_plan_banner_dismissed'

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  DEMO: 'Демо',
  STANDARD: 'Starter',
  PRO: 'Professional',
  ENTERPRISE: 'Enterprise',
}

function planLabel(id: string | null | undefined, t: ReturnType<typeof useTranslation>['t']): string {
  if (!id) return t('billing.current')
  const raw = PLAN_LABELS[id] || PLAN_LABELS[String(id).toLowerCase()] || id
  const key = String(id).toLowerCase()
  if (key === 'free') return t('billing.free')
  if (key === 'demo') return t('billing.demo')
  if (key === 'standard' || key === 'starter') return t('billing.starter')
  if (key === 'pro' || key === 'professional') return t('billing.professional')
  if (key === 'enterprise') return t('billing.enterprise')
  return raw
}

function dismissKey(snap: PlanEntitlementsSnapshot): string {
  const kind = snap.expired || snap.writeBlocked
    ? 'expired'
    : snap.limits?.patientsReached || snap.limits?.usersReached || snap.limits?.aiQuotaReached
      ? 'limit'
      : snap.approaching?.patients || snap.approaching?.users || snap.approaching?.ai
        ? 'approach'
        : 'expiring'
  return `${kind}:${snap.saasPlan || 'x'}:${snap.usage?.users || 0}:${snap.usage?.patients || 0}`
}

/** Global banner when subscription expired, hard limit hit, or soft cap approaching. */
export function PlanAccessBanner({
  snap,
  className,
}: {
  snap: PlanEntitlementsSnapshot | null | undefined
  className?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!snap) return
    try {
      setHidden(sessionStorage.getItem(DISMISS_KEY) === dismissKey(snap))
    } catch {
      setHidden(false)
    }
  }, [snap])

  if (!snap || hidden) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, dismissKey(snap)) } catch { /* ignore */ }
    setHidden(true)
  }

  if (snap.expired || snap.writeBlocked) {
    return (
      <div className={cn('rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3', className)}>
        <Lock size={16} className="text-error shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-txt-primary m-0">{t('billing.expired_title')}</p>
          <p className="text-xs text-txt-muted m-0">{t('billing.expired_body')}</p>
        </div>
        <Button size="sm" onClick={() => navigate('/crm/billing')} icon={<Crown size={14} />}>
          {t('billing.plans_btn')}
        </Button>
      </div>
    )
  }

  if (snap.limits?.patientsReached || snap.limits?.usersReached || snap.limits?.aiQuotaReached) {
    const parts: string[] = []
    if (snap.limits.patientsReached) parts.push(`${t('crm.patient_fallback')} ${snap.usage?.patients}/${snap.entitlements?.maxPatients}`)
    if (snap.limits.usersReached) parts.push(`${t('billing.staff')} ${snap.usage?.users}/${snap.entitlements?.maxUsers}`)
    if (snap.limits.aiQuotaReached) {
      parts.push(`AI ${snap.usage?.aiRequestsThisMonth}/${snap.entitlements?.aiRequestsPerMonth}`)
    }
    return (
      <div className={cn('rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-3', className)}>
        <AlertTriangle size={15} className="text-amber-300 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-semibold text-txt-primary m-0">{t('billing.limit_title', { plan: planLabel(snap.saasPlan, t) })}</p>
          <p className="text-[11px] sm:text-xs text-txt-muted m-0">{parts.join(' · ')}. {t('billing.limit_approaching', { plan: planLabel(snap.saasPlan, t) })}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate('/crm/billing')}>
          {t('billing.upgrade_btn')}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5"
          aria-label={t('common.hide')}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  if (snap.approaching?.patients || snap.approaching?.users || snap.approaching?.ai) {
    const parts: string[] = []
    if (snap.approaching.patients) parts.push(`${t('crm.patient_fallback')} ${snap.usage?.patients}/${snap.entitlements?.maxPatients}`)
    if (snap.approaching.users) parts.push(`${t('billing.staff')} ${snap.usage?.users}/${snap.entitlements?.maxUsers}`)
    if (snap.approaching.ai) parts.push(`AI ${snap.usage?.aiRequestsThisMonth}/${snap.entitlements?.aiRequestsPerMonth}`)
    return (
      <div className={cn('rounded-xl border border-dv-gold/25 bg-dv-gold/5 px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-3', className)}>
        <AlertTriangle size={15} className="text-dv-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-semibold text-txt-primary m-0">{t('billing.limit_title', { plan: planLabel(snap.saasPlan, t) })}</p>
          <p className="text-[11px] sm:text-xs text-txt-muted m-0">{parts.join(' · ')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/crm/billing')}>
          {t('billing.plans_btn')}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5"
          aria-label={t('common.hide')}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  if (snap.expiringSoon && snap.daysLeft != null) {
    return (
      <div className={cn('rounded-xl border border-dv-gold/30 bg-dv-gold/10 px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-3', className)}>
        <Badge variant="gold" size="xs">{t('billing.soon_ending')}</Badge>
        <p className="text-[11px] sm:text-xs text-txt-secondary m-0 flex-1">
          {t('billing.days_left', { n: snap.daysLeft })}
        </p>
        <Button size="sm" variant="ghost" onClick={() => navigate('/crm/billing')}>
          {t('billing.renew_btn')}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5"
          aria-label={t('common.hide')}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return null
}

export function featureAllowed(snap: PlanEntitlementsSnapshot | null | undefined, feature: string): boolean {
  if (!snap) return true
  if (snap.expired || snap.writeBlocked) return feature === 'crm' // read-only crm pages still open
  return snap.entitlements?.features?.[feature] !== false
}
