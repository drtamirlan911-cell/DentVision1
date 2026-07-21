import { create } from 'zustand'
import * as api from '@/utils/api'

type AIStatus = 'idle' | 'thinking' | 'executing' | 'result' | 'error'

interface Alert {
  type: string
  priority: 'high' | 'medium' | 'low'
  message: string
  action?: { type: string; payload: any }
}

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  intent?: string
  action?: { type: string; payload: any }
}

interface AIState {
  status: AIStatus
  currentIntent: string | null
  currentAction: string | null
  conversationContext: AIMessage[]
  suggestions: string[]
  proactiveAlerts: Alert[]
  sessionId: string | null
  errorMessage: string | null

  executePrompt: (text: string) => Promise<void>
  sendConfirmation: (confirmed: boolean, data?: any) => Promise<void>
  loadProactiveAlerts: () => Promise<void>
  clearConversation: () => void
  setSuggestions: (suggestions: string[]) => void
}

function mapPriority(p: number): 'high' | 'medium' | 'low' {
  if (p >= 8) return 'high'
  if (p >= 4) return 'medium'
  return 'low'
}

export const useAIStore = create<AIState>((set, get) => ({
  status: 'idle',
  currentIntent: null,
  currentAction: null,
  conversationContext: [],
  suggestions: [],
  proactiveAlerts: [],
  sessionId: null,
  errorMessage: null,

  executePrompt: async (text) => {
    const { sessionId, conversationContext } = get()
    set({ status: 'thinking', errorMessage: null })

    const history = conversationContext.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const userMsg: AIMessage = { role: 'user', content: text }
    const updatedContext = [...conversationContext, userMsg]

    try {
      const res = await api.aiChat(text, history)

      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: res.reply,
        intent: res.skill,
        action: res.actions?.[0]
          ? { type: res.actions[0].type, payload: res.actions[0].params }
          : undefined,
      }

      const alerts: Alert[] = (res.proactive || []).map((a: any) => ({
        type: a.type || a.category || 'info',
        priority: mapPriority(a.priority ?? 0),
        message: a.text,
        action: a.action ? { type: a.action.type, payload: a.action } : undefined,
      }))

      const action = res.actions?.[0]
      const needsConfirm = action?.requiresConfirmation

      set({
        status: needsConfirm ? 'executing' : 'result',
        currentIntent: res.skill || null,
        currentAction: action?.label || null,
        conversationContext: [...updatedContext, assistantMsg],
        suggestions: res.suggestions || [],
        proactiveAlerts: [...get().proactiveAlerts, ...alerts].slice(0, 20),
        sessionId: sessionId || crypto.randomUUID(),
      })
    } catch (err) {
      set({
        status: 'error',
        errorMessage: (err as Error).message || 'AI request failed',
        conversationContext: updatedContext,
      })
    }
  },

  sendConfirmation: async (confirmed, data) => {
    const { conversationContext, sessionId } = get()
    set({ status: 'thinking', errorMessage: null })

    try {
      const res = await api.aiChat(
        JSON.stringify({ confirmed, ...data }),
        conversationContext.map((m) => ({ role: m.role, content: m.content }))
      )

      const msg: AIMessage = {
        role: 'assistant',
        content: res.reply,
        intent: res.skill,
        action: res.actions?.[0]
          ? { type: res.actions[0].type, payload: res.actions[0].params }
          : undefined,
      }

      set({
        status: 'result',
        currentIntent: res.skill || null,
        currentAction: res.actions?.[0]?.label || null,
        conversationContext: [...conversationContext, msg],
        suggestions: res.suggestions || [],
        sessionId: sessionId || crypto.randomUUID(),
      })
    } catch (err) {
      set({
        status: 'error',
        errorMessage: (err as Error).message || 'Confirmation failed',
      })
    }
  },

  loadProactiveAlerts: async () => {
    try {
      const res = await api.aiProactive()
      const raw = res?.alerts || res || []
      const list = Array.isArray(raw) ? raw : []
      const alerts: Alert[] = list.map((a: any) => {
        const p = a.priority
        const priority: Alert['priority'] =
          p === 'high' || p === 'medium' || p === 'low'
            ? p
            : mapPriority(typeof p === 'number' ? p : Number(p) || 0)
        return {
          type: a.type || a.category || 'info',
          priority,
          message: a.message || a.text || '',
          action: a.action
            ? { type: a.action.type || a.action, payload: a.action }
            : undefined,
        }
      }).filter((a: Alert) => !!a.message)
      set({ proactiveAlerts: alerts })
    } catch {
      // silently fail
    }
  },

  clearConversation: () =>
    set({
      conversationContext: [],
      currentIntent: null,
      currentAction: null,
      status: 'idle',
      errorMessage: null,
    }),

  setSuggestions: (suggestions) => set({ suggestions }),
}))
