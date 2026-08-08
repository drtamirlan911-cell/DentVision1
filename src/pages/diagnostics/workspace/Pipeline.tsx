import { AlertCircle, CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react'

import { PHASES, type PhaseId, statusInfo, toneClasses } from '@/lib/referralStatus'
import { cn } from '@/lib/utils'

const PHASE_ICON: Record<PhaseId, React.ReactNode> = {
  awaiting: <AlertCircle size={15} />,
  accepted: <Clock size={15} />,
  inProgress: <PlayCircle size={15} />,
  done: <CheckCircle2 size={15} />,
}

/**
 * The referral lifecycle as an ordered strip.
 *
 * Six equal tiles in a row said every number mattered equally, which is the one
 * thing that is not true here — these are stages of one pipeline, and the left
 * of it is what needs a human today. Ordered stages get steps of a single hue
 * rather than unrelated colours, and each stage carries an icon and a label so
 * the colour is never doing the work alone.
 */
export function Pipeline({
  counts,
  activePhase,
  onSelect,
  className,
}: {
  counts: Record<PhaseId | 'cancelled', number>
  activePhase?: PhaseId | null
  onSelect?: (phase: PhaseId | null) => void
  className?: string
}) {
  const pipelineTotal = PHASES.reduce((sum, phase) => sum + counts[phase.id], 0)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {PHASES.map((phase) => {
          const value = counts[phase.id]
          const tone = toneClasses(phase.tone)
          const isActive = activePhase === phase.id
          const share = pipelineTotal > 0 ? (value / pipelineTotal) * 100 : 0

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onSelect?.(isActive ? null : phase.id)}
              aria-pressed={isActive}
              className={cn(
                'group rounded-xl border p-3 text-left transition-all sm:p-4',
                'min-h-11 focus:outline-none focus-visible:ring-1 focus-visible:ring-dv-gold',
                isActive
                  ? 'border-dv-gold/60 bg-surface-raised-hover'
                  : 'border-bdr-subtle bg-surface-raised hover:border-bdr/60 hover:bg-surface-raised-hover',
              )}
            >
              <span className={cn('flex items-center gap-1.5 text-sm', tone.text)}>
                {PHASE_ICON[phase.id]}
                <span className="text-txt-secondary">{phase.label}</span>
              </span>
              <span className="mt-1.5 block text-3xl font-semibold leading-none tracking-tight text-txt-primary">
                {value}
              </span>
              {/* Share of the pipeline, so the strip reads as a funnel and not
                  four unrelated counters. */}
              <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={cn('block h-full rounded-full transition-[width] duration-500', tone.dot)}
                  style={{ width: `${share}%` }}
                />
              </span>
            </button>
          )
        })}
      </div>

      {counts.cancelled > 0 && (
        // Cancelled is not a pipeline stage — it leaves the pipeline. Showing it
        // as a fifth equal tile implied it was somewhere on the way to done.
        <p className="flex items-center gap-1.5 text-sm text-txt-muted">
          <XCircle size={14} className="text-error" />
          Отменено: <span className="font-medium text-txt-secondary">{counts.cancelled}</span>
        </p>
      )}
    </div>
  )
}

/** Status pill — label always present, colour never alone. */
export function StatusPill({ status, className }: { status: string | null | undefined; className?: string }) {
  const info = statusInfo(status)
  const tone = toneClasses(info.tone)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tone.bg, tone.text, className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden />
      {info.label}
    </span>
  )
}
