import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { PlanOptionKey, PresentedOption } from '@/lib/presentation/planOptions'

/**
 * Three ways to put the same plan together.
 *
 * Deliberately not a comparison table. A table invites the patient to audit
 * rows they cannot judge; what they can judge is "this is what my doctor chose,
 * and here is what changes if we go cheaper or further". So each level is one
 * card with one price and one plain sentence, the doctor's own is marked, and
 * the level the narration is currently on is the one lit.
 *
 * The prices come from the frozen release, computed by the plan's own
 * arithmetic at approval — this component never multiplies anything.
 */

interface OptionsSceneProps {
  options: PresentedOption[]
  /** The level the current beat is talking about, if any. */
  activeKey?: PlanOptionKey | null
  className?: string
}

function formatTenge(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`
}

export function OptionsScene({ options, activeKey, className }: OptionsSceneProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  if (options.length === 0) return null

  return (
    <div className={cn('flex w-full flex-wrap items-stretch justify-center gap-3 px-2', className)}>
      {options.map((option) => {
        const active = option.key === activeKey
        const recommended = option.key === 'optimal'
        return (
          <motion.div
            key={option.key}
            className={cn(
              'flex min-w-[9rem] flex-1 basis-40 flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center transition-colors',
              active ? 'border-dv-gold' : 'border-bdr-subtle',
            )}
            style={{
              background: active
                ? 'color-mix(in srgb, var(--dv-gold) 8%, transparent)'
                : 'color-mix(in srgb, var(--dv-gold) 3%, transparent)',
            }}
            animate={{ scale: active && !prefersReducedMotion ? 1.04 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              className={cn(
                'text-2xs uppercase tracking-[0.18em]',
                active ? 'text-dv-gold' : 'text-txt-muted',
              )}
            >
              {t(`presentation.option_${option.key}`)}
            </span>

            <span className="font-serif text-lg text-txt-primary tabular-nums">
              {formatTenge(option.total)}
            </span>

            {recommended && (
              // Said because `optimal` *is* the doctor's own composition — a
              // fact about the data, not a recommendation this screen invents.
              <span
                className="rounded-full px-2 py-0.5 text-2xs text-dv-gold"
                style={{ background: 'color-mix(in srgb, var(--dv-gold) 14%, transparent)' }}
              >
                {t('presentation.option_doctor_choice')}
              </span>
            )}

            {option.changedCount > 0 && (
              <span className="text-2xs text-txt-muted">
                {t('presentation.option_changed', { count: option.changedCount })}
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
