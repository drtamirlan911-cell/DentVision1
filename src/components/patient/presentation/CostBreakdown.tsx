import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { readCostBreakdown } from '@/lib/presentation/planOptions'

/**
 * "Explain the price" — what the total is actually made of.
 *
 * Closed by default and never narrated. A patient who accepts the number should
 * not have to walk a table to get past it; a patient who does not should be
 * able to see every line without asking a person. That is the whole design: an
 * itemised plan is what a patient asks for when they suspect the number, so
 * refusing to show it is what makes a clinic look expensive.
 *
 * Every figure is read from the frozen release. Nothing here recomputes a
 * total, so this panel cannot disagree with the price the doctor approved.
 */

interface CostBreakdownProps {
  snapshot: unknown
  total: number
  className?: string
}

function formatTenge(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`
}

export function CostBreakdown({ snapshot, total, className }: CostBreakdownProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)

  const stages = readCostBreakdown(snapshot).filter((s) => s.lines.length > 0)
  if (stages.length === 0) return null

  return (
    <div className={cn('mx-auto w-full max-w-xl', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-1.5 px-2 py-1 text-2xs uppercase tracking-[0.18em] text-txt-muted transition-colors hover:text-txt-secondary"
      >
        {t('presentation.explain_price')}
        <ChevronDown
          size={12}
          className={cn('transition-transform duration-300', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4 rounded-2xl border border-bdr-subtle px-4 py-4 text-left">
              {stages.map((stage) => (
                <div key={stage.stageId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-2xs uppercase tracking-[0.18em] text-dv-gold">{stage.title}</span>
                    <span className="font-mono text-xs tabular-nums text-txt-secondary">
                      {formatTenge(stage.total)}
                    </span>
                  </div>
                  {stage.lines.map((line) => (
                    <div key={line.itemId} className="flex items-baseline justify-between gap-3 pl-1">
                      <span className="text-sm text-txt-secondary">
                        {line.serviceName}
                        {line.teeth.length > 0 && (
                          <span className="text-txt-muted">
                            {' · '}
                            {t('presentation.teeth_short', { teeth: line.teeth.join(', ') })}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-txt-muted">
                        {formatTenge(line.total)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              <div className="flex items-baseline justify-between gap-3 border-t border-bdr-subtle pt-3">
                <span className="text-2xs uppercase tracking-[0.18em] text-txt-muted">
                  {t('presentation.total')}
                </span>
                <span className="font-mono text-sm tabular-nums text-txt-primary">{formatTenge(total)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
