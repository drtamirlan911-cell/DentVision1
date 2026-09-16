import React from 'react'
import { Calendar, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PERIOD_CHIPS,
  type FinancePeriod,
  type FinancePeriodPreset,
  buildPeriod,
} from '@/lib/financePeriod'
import { useTranslation } from 'react-i18next'
import { DatePicker } from '@/components/ui/ds/DatePicker'
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext'
import { withEcosystemContext } from '@/config/ecosystemContextLink'
import { useNavigate } from 'react-router-dom'

interface Props {
  period: FinancePeriod
  onChange: (next: FinancePeriod) => void
  className?: string
}

export function FinancePeriodBar({ period, onChange, className }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const context = useEcosystemUrlContext()
  const hasClinicalContext = Boolean(context.patientId || context.caseId)
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
        {t('finance.period')}
      </span>
      {hasClinicalContext && (
        <button
          type="button"
          onClick={() => navigate(withEcosystemContext('/crm/cases', context))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dv-gold/25 bg-dv-gold/8 px-2.5 py-1 text-xs font-medium text-dv-gold transition-colors hover:border-dv-gold/45 hover:bg-dv-gold/12"
          title="Вернуться к клиническому кейсу"
        >
          <Link2 size={12} />
          {context.caseId ? 'Клинический кейс' : 'Пациент'}
        </button>
      )}
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
          <DatePicker
            size="sm"
            aria-label="Дата начала"
            value={period.from}
            onChange={(e) => onChange({ ...period, from: e.target.value, preset: 'custom' })}
            className="bg-surface-2 border-bdr-subtle"
          />
          <span className="text-txt-muted text-xs">—</span>
          <DatePicker
            size="sm"
            aria-label="Дата окончания"
            value={period.to}
            onChange={(e) => onChange({ ...period, to: e.target.value, preset: 'custom' })}
            className="bg-surface-2 border-bdr-subtle"
          />
        </div>
      )}
    </div>
  )
}
