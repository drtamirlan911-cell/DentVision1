import { useMemo } from 'react'
import { Bot } from 'lucide-react'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useAITimeline, type TimelineEvent } from '@/hooks/useAITimeline'
import { EventChatBridge, type EventChatMessage } from '@/components/intelligence/EventChatBridge'
import { useAuth } from '@/store/auth.store'

const DENY_REASON_LABEL: Record<string, string> = {
  NO_TOOL: 'Инструмент не найден',
  NOT_ON_SURFACE: 'Недоступно на этой поверхности',
  NOT_ALLOWED: 'Нет прав',
  NO_PERMISSION: 'Нет разрешения',
  NO_CLINIC: 'Нет активной клиники',
  CLINIC_MISMATCH: 'Другая клиника',
  OUT_OF_PATIENT_SCOPE: 'Вне зоны доступа к пациенту',
  EXEC_ERROR: 'Ошибка выполнения',
}

/** `TimelineEvent` (one kernel-recorded tool call) → one chat-feed card. */
function toChatMessage(e: TimelineEvent): EventChatMessage {
  const resultText = (e.result as { summary?: string } | null | undefined)?.summary
  const denied = e.status === 'denied'
  const failed = e.status === 'tool_error'

  const message = denied
    ? `Отказано: ${DENY_REASON_LABEL[e.error || ''] || e.error || 'нет прав'}`
    : failed
      ? `Ошибка: ${e.error || resultText || 'инструмент завершился с ошибкой'}`
      : resultText || `${e.type} выполнен`

  return {
    id: e.id,
    type: denied ? 'alert' : 'agent_action',
    agent: e.agentId || undefined,
    action: e.type,
    message,
    success: e.status === 'ok',
    critical: denied,
    timestamp: new Date(e.timestamp),
  }
}

/**
 * Live feed of what the AI actually did — the Center panel's answer to
 * "что делал ИИ", backed by the same `AgentActivity` ledger as the
 * dedicated /agent-activity audit table, just as a compact chat-style feed
 * instead of rows in a table.
 */
export function AgentActivityTab() {
  const { clinic } = useAuth()
  const timeline = useAITimeline({ clinicId: clinic?.id, limit: 30 })

  const messages = useMemo(
    () => (timeline.data?.entries || []).map(toChatMessage).reverse(),
    [timeline.data],
  )

  if (timeline.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<Bot size={40} />}
        title="Пока нет активности"
        description="Здесь появится каждое действие ИИ-ассистента в этой клинике"
      />
    )
  }

  return <EventChatBridge messages={messages} />
}
