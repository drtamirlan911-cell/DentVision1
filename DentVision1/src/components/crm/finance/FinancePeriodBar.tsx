import React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PERIOD_CHIPS,
  type FinancePeriod,
  type FinancePeriodPreset,
  buildPeriod,
} from '@/lib/financePeriod'

interface Props {
  period: FinancePeriod
  onChange: (next: FinancePeriod) => void
  className?: string
}

export function FinancePeriodBar({ period, onChange, className }: Props) {
  const setPreset = (preset: FinancePeriodPreset) => {
    if (preset === 'custom') {
      onChange({ ...period, preset: 'custom' })
      return
    }
    onChange(buildPeriod(preset))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="inline-flex items-center gap-1.5 text-xs text-txt-muted mr-1">
        <Calendar size={13} />
        Период
      </span>
      {PERIOD_CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => setPreset(chip.id)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
            period.preset === chip.id
              ? 'bg-dv-gold/15 border-dv-gold/40 text-dv-gold'
              : 'bg-white/[0.02] border-bdr-subtle text-txt-muted hover:text-txt-primary hover:border-dv-gold/25',
          )}
        >
          {chip.label}
        </button>
      ))}
      {period.preset === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={period.from}
            onChange={(e) => onChange({ ...period, from: e.target.value, preset: 'custom' })}
            className="h-8 rounded-lg bg-surface-2 border border-bdr-subtle px-2 text-xs text-txt-primary"
          />
          <span className="text-txt-muted text-xs">—</span>
          <input
            type="date"
            value={period.to}
            onChange={(e) => onChange({ ...period, to: e.target.value, preset: 'custom' })}
            className="h-8 rounded-lg bg-surface-2 border border-bdr-subtle px-2 text-xs text-txt-primary"
          />
        </div>
      )}
    </div>
  )
}
