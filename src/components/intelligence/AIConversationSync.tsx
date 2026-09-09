import { useEffect, useRef } from 'react'
import { getActiveAiThread } from '@/utils/api'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'

/** Restores the durable AI thread and keeps proactive signals fresh. */
export function AIConversationSync() {
  const { isAuthenticated } = useAuth()
  const setMessages = useAIStore((s) => s.setMessages)
  const loadProactiveAlerts = useAIStore((s) => s.loadProactiveAlerts)
  const hydrated = useRef(false)
  const loading = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || hydrated.current || loading.current) return
    loading.current = true
    void getActiveAiThread()
      .then((res: any) => {
        const raw = res?.messages || res?.data?.messages || []
        if (!Array.isArray(raw)) return
        const messages = raw
          .filter((m: any) => m?.role === 'user' || m?.role === 'assistant' || m?.role === 'system')
          .map((m: any) => ({
            id: String(m.id || `restored-${Date.now()}-${Math.random()}`),
            role: m.role,
            content: String(m.content || ''),
            timestamp: new Date(m.timestamp || Date.now()),
          }))
          .filter((m: any) => m.content.trim())
        if (messages.length) setMessages(messages)
        hydrated.current = true
      })
      .catch(() => undefined)
      .finally(() => { loading.current = false })
  }, [isAuthenticated, setMessages])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadProactiveAlerts()
    const refresh = () => void loadProactiveAlerts()
    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [isAuthenticated, loadProactiveAlerts])

  return null
}
