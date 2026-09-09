import { useEffect, useRef } from 'react'
import { apiRequest } from '@/utils/api'
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
 * AISession/AIMessage remain the server source of truth. The client keeps a
 * durable session id per workspace and switches the legacy canonical AI key
 * whenever the active workspace changes. This makes existing aiChat callers
 * automatically address the correct conversation without duplicating the API.
 *
 * Security invariant: if the workspace transcript cannot be resolved, the
 * client clears the visible transcript instead of falling back to another
 * workspace's conversation.
 */
export function AIConversationSync() {
  const { isAuthenticated, user } = useAuth()
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
    const clinicId = (user as any)?.clinicId as string | null
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
          sessionId = String(
            created?.sessionId || created?.data?.sessionId || created?.threadId || created?.data?.threadId || '',
          ) || null
          if (sessionId) localStorage.setItem(storageKey, sessionId)
        } catch {
          sessionId = null
        }
      }

      if (sessionId) {
        // aiChat() reads this stable key when no explicit sessionId is supplied.
        // The clinic id comes from authenticated user state, never from workspace metadata.
        try {
          localStorage.setItem(clinicSessionKey(user.id, clinicId), sessionId)
        } catch { /* ignore */ }
      }

      // Do not display an existing transcript until we have resolved this exact
      // workspace session. This prevents a temporary API failure from leaking
      // the previous workspace's conversation into the new workspace.
      let messages: StoredMessage[] = []
      if (sessionId) {
        try {
          const history = await apiRequest('/api/ai/history')
          const sessions = Array.isArray(history) ? history : history?.data || []
          const selected = Array.isArray(sessions)
            ? sessions.find((s: any) => String(s?.id || '') === sessionId)
            : null
          messages = normaliseMessages(selected?.messages)
        } catch {
          messages = []
        }
      }

      setMessages(messages as any)
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

  return null
}