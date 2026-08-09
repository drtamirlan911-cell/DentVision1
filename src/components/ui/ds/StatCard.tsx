import React from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  change?: { value: number; positive: boolean }
  className?: string
  onClick?: () => void
}

function StatCard({ label, value, icon, change, className, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-bdr-subtle bg-surface-raised p-4 transition-all duration-200',
        onClick && 'hover:bg-surface-raised-hover hover:border-bdr/50 cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold">
          {icon}
        </div>
        {change && (
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded',
              change.positive ? 'text-success bg-success/10' : 'text-error bg-error/10'
            )}
          >
            {change.positive ? '+' : ''}{change.value}%
          </span>
        )}
      </div>
      <p className="text-3xl font-semibold text-txt-primary tracking-tight">{value}</p>
      <p className="text-sm text-txt-muted mt-1">{label}</p>
    </div>
  )
}

function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold sm:h-12 sm:w-12">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-txt-primary tracking-tight leading-tight break-words">{title}</h1>
          {subtitle && (
            <p className="text-sm text-txt-secondary mt-1 leading-snug break-words">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

/**
 * The one number a screen leads with — at least 48px, exactly one per view.
 *
 * A dashboard where every figure is the same size has no lead, which is what
 * made these screens read flat: page titles and stat values sat within one step
 * of body text. This is the deliberate exception, so it stays a named component
 * rather than a size someone reaches for ad hoc.
 *
 * Proportional figures on purpose — `tabular-nums` gives every digit the width
 * of a zero, which looks loose at display sizes.
 */
function HeroStat({
  value,
  label,
  hint,
  icon,
  tone = 'gold',
  className,
}: {
  value: string | number
  label: string
  /** Secondary line — the context that makes the number mean something. */
  hint?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'gold' | 'success' | 'warning' | 'error'
  className?: string
}) {
  const toneRing: Record<string, string> = {
    gold: 'bg-dv-gold/10 text-dv-gold',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
  }

  return (
    <div className={cn('flex items-center gap-4 sm:gap-5', className)}>
      {icon && (
        <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16', toneRing[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-6xl font-semibold leading-none tracking-tight text-txt-primary sm:text-7xl">
          {value}
        </p>
        <p className="mt-2 text-base font-medium text-txt-primary">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-txt-muted">{hint}</p>}
      </div>
    </div>
  )
}

export { StatCard, PageHeader, HeroStat }
