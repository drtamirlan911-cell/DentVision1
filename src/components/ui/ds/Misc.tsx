import React, { useState } from 'react'
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
}

function Tabs({ tabs, active, onChange, className, size = 'md' }: TabsProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-surface-2 p-1',
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
            active === tab.id
              ? 'bg-surface-raised text-dv-gold shadow-sm'
              : 'text-txt-muted hover:text-txt-secondary hover:bg-white/[0.03]'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-2xs font-bold',
                active === tab.id
                  ? 'bg-dv-gold/20 text-dv-gold'
                  : 'bg-white/5 text-txt-muted'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
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
