import React from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
  size?: 'sm' | 'md'
  variant?: 'pill' | 'underline'
}

function Tabs({ tabs, active, onChange, className, size = 'md', variant = 'pill' }: TabsProps) {
  const underline = variant === 'underline'

  return (
    <div
      className={cn(
        'w-full max-w-full overflow-x-auto overscroll-x-contain scrollbar-none',
        underline && 'border-b border-bdr-subtle',
        className
      )}
    >
      <div
        role="tablist"
        className={cn(
          'inline-flex min-w-max items-center',
          underline ? 'gap-0.5 sm:gap-1' : 'gap-1 rounded-xl bg-surface-2 p-1'
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,box-shadow] duration-base ease-dv',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0',
                size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-xs sm:px-4 sm:text-sm',
                underline
                  ? cn(
                      'rounded-t-lg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:transition-colors after:duration-[180ms]',
                      isActive
                        ? 'text-txt-primary after:bg-dv-gold'
                        : 'text-txt-muted after:bg-transparent hover:text-txt-secondary'
                    )
                  : cn(
                      'rounded-lg',
                      isActive
                        ? 'bg-surface-raised text-dv-gold shadow-sm'
                        : 'text-txt-muted hover:bg-surface-raised hover:text-txt-secondary'
                    )
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums',
                    isActive ? 'bg-dv-gold/20 text-dv-gold' : 'bg-surface-raised text-txt-muted'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <div
      className={cn(
        vertical ? 'h-5 w-px bg-bdr-subtle' : 'h-px w-full bg-bdr-subtle',
        className
      )}
    />
  )
}

function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cn('flex items-center gap-2 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-base ease-dv focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
          checked ? 'bg-dv-gold' : 'bg-surface-3 border border-bdr-subtle'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-base ease-dv',
            checked ? 'translate-x-[21px]' : 'translate-x-[3px]'
          )}
        />
      </button>
      {label && <span className="text-sm text-txt-primary">{label}</span>}
    </label>
  )
}

export { Tabs, Separator, Switch }
