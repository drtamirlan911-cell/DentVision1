import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Crown, Lock } from 'lucide-react'
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

/** Global banner when subscription expired, hard limit hit, or soft cap approaching. */
export function PlanAccessBanner({
  snap,
  className,
}: {
  snap: PlanEntitlementsSnapshot | null | undefined
  className?: string
}) {
  const navigate = useNavigate()
  if (!snap) return null

  if (snap.expired || snap.writeBlocked) {
    return (
      <div className={cn('rounded-xl border border-error/30 bg-error/10 px-4 py-3 flex flex-wrap items-center gap-3', className)}>
        <Lock size={16} className="text-error shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-txt-primary m-0">Подписка истекла — запись заблокирована</p>
          <p className="text-xs text-txt-muted m-0">Можно смотреть данные. Чтобы создавать записи, пациентов и счета — продлите тариф.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/crm/billing')} icon={<Crown size={14} />}>
          Тарифы
        </Button>
      </div>
    )
  }

  if (snap.limits?.patientsReached || snap.limits?.usersReached || snap.limits?.aiQuotaReached) {
    const parts: string[] = []
    if (snap.limits.patientsReached) parts.push(`пациенты ${snap.usage?.patients}/${snap.entitlements?.maxPatients}`)
    if (snap.limits.usersReached) parts.push(`сотрудники ${snap.usage?.users}/${snap.entitlements?.maxUsers}`)
    if (snap.limits.aiQuotaReached) {
      parts.push(`AI ${snap.usage?.aiRequestsThisMonth}/${snap.entitlements?.aiRequestsPerMonth}`)
    }
    return (
      <div className={cn('rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-3', className)}>
        <AlertTriangle size={16} className="text-amber-300 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-txt-primary m-0">Лимит тарифа {snap.saasPlan}</p>
          <p className="text-xs text-txt-muted m-0">{parts.join(' · ')}. Обновите план, чтобы продолжить.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate('/crm/billing')}>
          Обновить
        </Button>
      </div>
    )
  }

  if (snap.approaching?.patients || snap.approaching?.users || snap.approaching?.ai) {
    const parts: string[] = []
    if (snap.approaching.patients) parts.push(`пациенты ${snap.usage?.patients}/${snap.entitlements?.maxPatients}`)
    if (snap.approaching.users) parts.push(`сотрудники ${snap.usage?.users}/${snap.entitlements?.maxUsers}`)
    if (snap.approaching.ai) parts.push(`AI ${snap.usage?.aiRequestsThisMonth}/${snap.entitlements?.aiRequestsPerMonth}`)
    return (
      <div className={cn('rounded-xl border border-dv-gold/25 bg-dv-gold/5 px-4 py-3 flex flex-wrap items-center gap-3', className)}>
        <AlertTriangle size={16} className="text-dv-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-txt-primary m-0">Близко к лимиту {snap.saasPlan}</p>
          <p className="text-xs text-txt-muted m-0">{parts.join(' · ')}. Лучше обновить тариф заранее.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/crm/billing')}>
          Тарифы
        </Button>
      </div>
    )
  }

  if (snap.expiringSoon && snap.daysLeft != null) {
    return (
      <div className={cn('rounded-xl border border-dv-gold/30 bg-dv-gold/10 px-4 py-3 flex flex-wrap items-center gap-3', className)}>
        <Badge variant="gold" size="xs">Скоро конец</Badge>
        <p className="text-xs text-txt-secondary m-0 flex-1">
          До конца тарифа {snap.daysLeft} дн. Продлите заранее, чтобы не потерять доступ к записи.
        </p>
        <Button size="sm" variant="ghost" onClick={() => navigate('/crm/billing')}>
          Продлить
        </Button>
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
