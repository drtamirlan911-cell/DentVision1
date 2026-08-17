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
  /**
   * `pill` is the dense control that belongs inside a working screen.
   *
   * `underline` is for a screen's primary navigation, where a filled chip
   * competes with the content it is introducing: the row reads as a quiet
   * baseline and only the active label carries the gold. It also lets the
   * tabs sit directly on the page surface instead of on a `surface-2` slab,
   * which is what makes a header feel built rather than assembled.
   */
  variant?: 'pill' | 'underline'
}

function Tabs({ tabs, active, onChange, className, size = 'md', variant = 'pill' }: TabsProps) {
  const underline = variant === 'underline'

  return (
    <div
      className={cn(
        'w-full max-w-full overflow-x-auto overscroll-x-contain',
        underline && 'border-b border-bdr-subtle',
        className
      )}
    >
      <div
        role="tablist"
        className={cn(
          'inline-flex min-w-0 items-center',
          underline ? 'gap-1 sm:gap-2' : 'gap-1 rounded-xl bg-surface-2 p-1'
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
                'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40',
                size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-xs sm:px-4 sm:text-sm',
                underline
                  ? cn(
                      // The active bar overlaps the container's own hairline, so
                      // the two read as one line rather than a stack of two.
                      'rounded-t-lg after:absolute after:inset-x-2 after:-bottom-px after:h-px after:transition-colors after:duration-200',
                      isActive
                        ? 'text-txt-primary after:bg-dv-gold'
                        : 'text-txt-muted after:bg-transparent hover:text-txt-secondary'
                    )
                  : cn(
                      'rounded-lg',
                      isActive
                        ? 'bg-surface-raised text-dv-gold shadow-sm'
                        : 'text-txt-muted hover:bg-white/[0.03] hover:text-txt-secondary'
                    )
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-2xs font-bold',
                    isActive ? 'bg-dv-gold/20 text-dv-gold' : 'bg-white/5 text-txt-muted'
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
        vertical
          ? 'h-5 w-px bg-bdr-subtle'
          : 'h-px w-full bg-bdr-subtle',
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
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
          checked ? 'bg-dv-gold' : 'bg-surface-3 border border-bdr-subtle'
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          )}
        />
      </button>
      {label && <span className="text-sm text-txt-primary">{label}</span>}
    </label>
  )
}

export { Tabs, Separator, Switch }
