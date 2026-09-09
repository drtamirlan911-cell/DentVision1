import { useEffect, useRef, useCallback, useState } from 'react'
import { apiRequest } from '@/utils/api'
import { useAuthStore } from '@/store/auth.store'

export interface NotificationEvent {
  id: string
  type: 'ai_event' | 'alert' | 'agent_status' | 'timeline_update'
  data: Record<string, unknown>
  timestamp: string
  clinicId: string
  targetUserIds?: string[]
}

interface UseAINotificationsOptions {
  onEvent?: (event: NotificationEvent) => void
  onAlert?: (event: NotificationEvent) => void
  onTimelineUpdate?: (event: NotificationEvent) => void
  enabled?: boolean
}

export function useAINotifications(options?: UseAINotificationsOptions) {
  const { enabled = true, onEvent, onAlert, onTimelineUpdate } = options || {}
  const clinicId = useAuthStore((s) => s.user?.clinicId)
  const callbacks = useRef({ onEvent, onAlert, onTimelineUpdate })
  callbacks.current = { onEvent, onAlert, onTimelineUpdate }
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<NotificationEvent | null>(null)
  const API_URL: string = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')

  useEffect(() => {
    stoppedRef.current = false
    if (!enabled || !clinicId) return

    const connect = async () => {
      if (stoppedRef.current) return
      try {
        const ticketResponse = await apiRequest('/api/ai/notifications/ticket', { method: 'POST' })
        const ticket = String(ticketResponse?.ticket || '')
        if (!ticket || stoppedRef.current) return
        const url = `${API_URL}/api/ai/notifications/stream?clinicId=${encodeURIComponent(clinicId)}&ticket=${encodeURIComponent(ticket)}`
        const es = new EventSource(url)
        eventSourceRef.current = es
        es.onopen = () => setConnected(true)
        es.onmessage = (event) => {
          try {
            const data: NotificationEvent = JSON.parse(event.data)
            setLastEvent(data)
            callbacks.current.onEvent?.(data)
            if (data.type === 'alert') callbacks.current.onAlert?.(data)
            if (data.type === 'timeline_update') callbacks.current.onTimelineUpdate?.(data)
          } catch { /* keepalive / malformed event */ }
        }
        es.onerror = () => {
          es.close()
          if (eventSourceRef.current === es) eventSourceRef.current = null
          setConnected(false)
          if (!stoppedRef.current) {
            if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = window.setTimeout(() => void connect(), 3000)
          }
        }
      } catch {
        setConnected(false)
        if (!stoppedRef.current) reconnectTimerRef.current = window.setTimeout(() => void connect(), 5000)
      }
    }

    void connect()
    return () => {
      stoppedRef.current = true
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [clinicId, enabled, API_URL])

  const disconnect = useCallback(() => {
    stoppedRef.current = true
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setConnected(false)
  }, [])

  return { connected, lastEvent, disconnect }
}
