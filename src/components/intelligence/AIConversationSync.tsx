import { useEffect, useRef } from 'react'
import { apiRequest, getActiveAiThread, getAiSessionId } from '@/utils/api'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'
import { useWorkspaceStore } from '@/store/workspace.store'

type StoredMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

const WORKSPACE_SESSION_PREFIX = 'dv_ai_workspace_session_v1'
const CLINIC_SESSION_PREFIX = 'dv_ai_session'

function workspaceSessionKey(userId: string, workspaceId: string): string {
  return `${WORKSPACE_SESSION_PREFIX}_${userId}_${workspaceId}`
}

function clinicSessionKey(userId: string, clinicId?: string | null): string {
  return `${CLINIC_SESSION_PREFIX}_${userId}_${clinicId || 'none'}`
}

function normaliseMessages(raw: unknown): StoredMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m: any) => m?.role === 'user' || m?.role === 'assistant' || m?.role === 'system')
    .map((m: any) => ({
      id: String(m.id || `restored-${Date.now()}-${Math.random()}`),
      role: m.role,
      content: String(m.content || ''),
      timestamp: new Date(m.timestamp || m.createdAt || Date.now()),
    }))
    .filter((m) => m.content.trim())
}

/**
 * Durable AI conversation synchronisation.
 *
 * The backend already persists AISession/AIMessage. The client now adds one
 * small routing layer: every workspace gets its own durable session id, while
 * the canonical per-user/per-clinic AI key is switched to the active workspace.
 * This means every existing aiChat caller automatically talks to the correct
 * workspace without duplicating the API contract.
 */
export function AIConversationSync() {
  const { isAuthenticated } = useAuth()
  const user = useAuth((s) => s.user)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const setMessages = useAIStore((s) => s.setMessages)
  const loadProactiveAlerts = useAIStore((s) => s.loadProactiveAlerts)
  const hydratedWorkspace = useRef<string | null>(null)
  const loadingWorkspace = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !activeWorkspace?.id) return

    const workspaceId = activeWorkspace.id
    if (loadingWorkspace.current === workspaceId) return
    if (hydratedWorkspace.current === workspaceId) return

    loadingWorkspace.current = workspaceId

    const clinicId = (activeWorkspace.organizationId || (user as any)?.clinicId || null) as string | null
    const storageKey = workspaceSessionKey(user.id, workspaceId)

    const activate = async () => {
      let sessionId: string | null = null
      try {
        sessionId = localStorage.getItem(storageKey)
      } catch { /* storage may be unavailable */ }

      if (!sessionId) {
        try {
          const created = await apiRequest('/api/ai/threads/new', {
            method: 'POST',
            body: JSON.stringify({
              workspaceId,
              workspaceType: activeWorkspace.scopeType,
              workspaceName: activeWorkspace.name,
              workspaceRole: activeWorkspace.roleLabel,
            }),
          })
          sessionId = String(created?.sessionId || created?.data?.sessionId || created?.threadId || created?.data?.threadId || '') || null
          if (sessionId) localStorage.setItem(storageKey, sessionId)
        } catch {
          // Existing AI fallback remains usable if thread creation is unavailable.
        }
      }

      if (sessionId) {
        // aiChat() already reads this stable key when no explicit sessionId is
        // supplied. Switching it here keeps all legacy callers workspace-safe.
        try {
          localStorage.setItem(clinicSessionKey(user.id, clinicId), sessionId)
        } catch { /* ignore */ }
      }

      let messages: StoredMessage[] = []
      try {
        const history = await apiRequest('/api/ai/history')
        const sessions = Array.isArray(history) ? history : history?.data || []
        const selected = Array.isArray(sessions)
          ? sessions.find((s: any) => String(s?.id || '') === sessionId)
          : null
        messages = normaliseMessages(selected?.messages)
      } catch {
        // Backward-compatible fallback for older deployments.
        try {
          const active = await getActiveAiThread()
          messages = normaliseMessages(active?.messages || active?.data?.messages)
        } catch { /* keep the current store untouched */ }
      }

      if (messages.length) {
        setMessages(messages as any)
      } else {
        // New workspace: do not leak the previous workspace's transcript.
        setMessages([])
      }

      hydratedWorkspace.current = workspaceId
    }

    void activate().finally(() => {
      if (loadingWorkspace.current === workspaceId) loadingWorkspace.current = null
    })
  }, [activeWorkspace, isAuthenticated, setMessages, user])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadProactiveAlerts()

    const refresh = () => void loadProactiveAlerts()
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('dentvision:workspace-switched', refresh)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('dentvision:workspace-switched', refresh)
    }
  }, [isAuthenticated, loadProactiveAlerts])

  // Keep the imported session helper referenced for backwards-compatible
  // builds where the API module tree-shakes storage initialisation differently.
  void getAiSessionId

  return null
}