import React, { useMemo, useState } from 'react'
import { Layers, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { TreatmentPlanAlternative, TreatmentPlanLineItem } from '@/lib/treatment-plan'

/**
 * The doctor's whole part in Essential / Optimal / Premium.
 *
 * They pick another service from the clinic's own price list and say whether it
 * is the cheaper or the fuller version of this line. That is all — the three
 * levels are assembled from these marks at approval, by the backend, using the
 * plan's own arithmetic. Nothing here computes a level or a total, so the doctor
 * cannot be shown a number the patient will not see.
 *
 * Prices come from the price list, never typed: an invented price is a quote
 * the clinic has to honour.
 */

interface ServiceOption {
  id: string
  name: string
  price: number
  cat: string
}

interface PlanItemAlternativesProps {
  item: TreatmentPlanLineItem
  services: ServiceOption[]
  onChange: (alternatives: TreatmentPlanAlternative[]) => void
}

function formatTenge(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`
}

export function PlanItemAlternatives({ item, services, onChange }: PlanItemAlternativesProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState('')

  // Memoised rather than `?? []` inline: a fresh empty array on every render
  // would churn the dependency list of the memo below for no reason.
  const alternatives = useMemo(() => item.alternatives ?? [], [item.alternatives])

  /**
   * Only services that would actually change the price, and only in the
   * direction that makes sense. A cheaper service can be an "Essential"; a
   * dearer one can be a "Premium"; one priced the same is neither, and offering
   * it would put a third identical card in front of the patient.
   */
  const options = useMemo(() => {
    const taken = new Set(alternatives.map((a) => a.serviceId))
    return services
      .filter((s) => s.id !== item.serviceId && !taken.has(s.id) && s.price !== item.price && s.price > 0)
      .map((s) => ({ ...s, tier: (s.price < item.price ? 'essential' : 'premium') as TreatmentPlanAlternative['tier'] }))
  }, [services, alternatives, item.serviceId, item.price])

  const add = () => {
    const chosen = options.find((s) => s.id === serviceId)
    if (!chosen) return
    onChange([
      ...alternatives,
      { serviceId: chosen.id, serviceName: chosen.name, price: chosen.price, tier: chosen.tier },
    ])
    setServiceId('')
  }

  const remove = (id: string) => {
    onChange(alternatives.filter((a) => a.serviceId !== id))
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs transition-colors',
          alternatives.length > 0 ? 'text-dv-gold' : 'text-txt-muted hover:text-txt-secondary',
        )}
      >
        <Layers size={12} aria-hidden />
        {alternatives.length > 0
          ? t('treatmentPlan.alternatives_count', { count: alternatives.length })
          : t('treatmentPlan.alternatives_add')}
      </button>

      {open && (
        <div className="space-y-2 rounded-lg border border-bdr-subtle p-3">
          <p className="text-2xs text-txt-muted">{t('treatmentPlan.alternatives_hint')}</p>

          {alternatives.map((alt) => (
            <div key={alt.serviceId} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-txt-secondary">
                {alt.serviceName}
                <span className="text-txt-muted">
                  {' · '}
                  {t(`treatmentPlan.tier_${alt.tier}`)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono tabular-nums text-txt-muted">{formatTenge(alt.price)}</span>
                <button
                  type="button"
                  onClick={() => remove(alt.serviceId)}
                  className="text-txt-muted transition-colors hover:text-error"
                  aria-label={t('common.delete')}
                >
                  <X size={12} />
                </button>
              </span>
            </div>
          ))}

          {options.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="dv-select flex-1 text-xs"
              >
                <option value="">{t('treatmentPlan.select_service')}</option>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatTenge(s.price)} · {t(`treatmentPlan.tier_${s.tier}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={!serviceId}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-dv-gold transition-opacity disabled:opacity-40"
                style={{ background: 'color-mix(in srgb, var(--dv-gold) 12%, transparent)' }}
              >
                <Plus size={12} aria-hidden />
                {t('treatmentPlan.add_service')}
              </button>
            </div>
          ) : (
            <p className="text-2xs text-txt-muted">{t('treatmentPlan.alternatives_none_available')}</p>
          )}
        </div>
      )}
    </div>
  )
}
