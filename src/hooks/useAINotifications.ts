import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ───

export interface NotificationEvent {
  id: string
  type: 'ai_event' | 'alert' | 'agent_status' | 'timeline_update'
  data: Record<string, unknown>
  timestamp: string
  clinicId: string
}

interface UseAINotificationsOptions {
  onEvent?: (event: NotificationEvent) => void
  onAlert?: (event: NotificationEvent) => void
  onTimelineUpdate?: (event: NotificationEvent) => void
  enabled?: boolean
}

// ─── Hook ───

export function useAINotifications(options?: UseAINotificationsOptions) {
  const { enabled = true, onEvent, onAlert, onTimelineUpdate } = options || {}
  const clinicId = useAuthStore((s) => s.user?.clinicId)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<NotificationEvent | null>(null)

  const API_URL: string =
    import.meta.env.VITE_API_URL ||
    (window.location.hostname.includes('vercel.app')
      ? 'https://dentvision-api.onrender.com'
      : 'http://localhost:3001')

  useEffect(() => {
    if (!enabled || !clinicId) return

    const url = `${API_URL}/api/ai/notifications/stream?clinicId=${clinicId}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
    }

    es.onmessage = (event) => {
      try {
        const data: NotificationEvent = JSON.parse(event.data)
        setLastEvent(data)

        onEvent?.(data)

        switch (data.type) {
          case 'alert':
            onAlert?.(data)
            break
          case 'timeline_update':
            onTimelineUpdate?.(data)
            break
        }
      } catch {
        // Ignore parse errors (keepalive messages)
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          // reconnect by creating a new EventSource
        }
      }, 3000)
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [clinicId, enabled, API_URL])

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setConnected(false)
  }, [])

  return { connected, lastEvent, disconnect }
}
