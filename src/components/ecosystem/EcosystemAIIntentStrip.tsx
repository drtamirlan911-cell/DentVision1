import React, { useMemo } from 'react'
import { Brain, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEcosystemContext } from '@/hooks/useEcosystemContext'
import { promptsForParticipant } from '@/config/ecosystemPrompts'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  limit?: number
}

/** Role-aware AI entry points that preserve the existing AI workspace and context model. */
export default function EcosystemAIIntentStrip({ className, limit = 4 }: Props) {
  const navigate = useNavigate()
  const { participant } = useEcosystemContext()
  const prompts = useMemo(() => promptsForParticipant(participant).slice(0, limit), [participant, limit])

  if (!prompts.length) return null

  return (
    <section className={cn('rounded-2xl border border-bdr-subtle bg-surface-1 p-3', className)} aria-label="DentVision AI">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold">
          <Brain size={14} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-txt-primary">DentVision AI</div>
          <div className="text-[11px] text-txt-muted">Следующий шаг из вашего рабочего контекста</div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {prompts.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/ai?prompt=${encodeURIComponent(item.prompt)}`)}
            className="group inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-bdr-subtle bg-surface-2 px-3 text-[11px] font-medium text-txt-secondary transition hover:border-dv-gold/50 hover:text-txt-primary"
          >
            {item.label}
            <ArrowUpRight size={12} className="text-txt-muted transition group-hover:text-dv-gold" />
          </button>
        ))}
      </div>
    </section>
  )
}
