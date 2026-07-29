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
      <p className="text-2xl font-bold text-txt-primary tracking-tight">{value}</p>
      <p className="text-xs text-txt-muted mt-1">{label}</p>
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-txt-primary leading-tight break-words">{title}</h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-txt-secondary mt-0.5 leading-snug break-words">{subtitle}</p>
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

export { StatCard, PageHeader }
