import React from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Card } from '../ui/ds/Card'
import { Badge, type BadgeVariant } from '../ui/ds/Badge'
import { Button } from '../ui/ds/Button'
import { useAiInsights, useDismissAiInsight } from '@/queries/ai.query'
import * as api from '@/utils/api'
import type { AiInsight } from '@/utils/api'

const SEVERITY_BADGE: Record<AiInsight['severity'], BadgeVariant> = {
  info: 'info',
  attention: 'warning',
  urgent: 'error',
}

const SEVERITY_LABEL: Record<AiInsight['severity'], string> = {
  info: 'Инфо',
  attention: 'Внимание',
  urgent: 'Срочно',
}

/**
 * Deterministic contextual hints for one patient — never a chatbot, never
 * forced onto the screen. Renders nothing at all when there is nothing to
 * say (no empty-state card, no idle sparkle).
 */
export function AiInsightCard({ patientId }: { patientId: string | null }) {
  const navigate = useNavigate()
  const { data: insights, isLoading } = useAiInsights('patient', patientId)
  const dismiss = useDismissAiInsight('patient', patientId)

  if (isLoading || !insights || insights.length === 0) return null

  const runAction = async (action: AiInsight['actions'][number]) => {
    const result = await api.aiAction(action.tool, action.params)
    const path = result?.data?.path
    if (typeof path === 'string' && path) navigate(path)
  }

  return (
    <div className="space-y-2">
      {insights.map((insight) => (
        <Card key={insight.id} padding="sm" className="flex items-start gap-3">
          <Badge variant={SEVERITY_BADGE[insight.severity]} dot className="mt-0.5 shrink-0">
            {SEVERITY_LABEL[insight.severity]}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-txt-primary">{insight.title}</p>
            {insight.actions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {insight.actions.map((action, i) => (
                  <Button key={i} size="xs" variant="outline" onClick={() => void runAction(action)}>
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Скрыть подсказку"
            className="shrink-0 rounded-md p-1 text-txt-muted hover:bg-white/5 hover:text-txt-secondary"
            onClick={() => dismiss.mutate(insight.id)}
          >
            <X size={14} />
          </button>
        </Card>
      ))}
    </div>
  )
}

export default AiInsightCard
