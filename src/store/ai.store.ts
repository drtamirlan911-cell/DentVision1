import { create } from 'zustand'
import * as api from '@/utils/api'
import { normalizeAlertTone } from '@/utils/alertTone'

export type AIStatus = 'idle' | 'thinking' | 'executing' | 'result' | 'confirmation' | 'error'
export type ContextFocus = 'workspace' | 'patient' | 'appointment' | 'product' | 'course' | 'analytics' | 'invoice' | 'lab'

export interface Intent {
  id: string
  type: string
  skill: string
  entities: Record<string, unknown>
  confidence: number
}

export interface Action {
  id: string
  type: string
  label: string
  confidence: number
  params?: Record<string, unknown>
  requiresConfirmation?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  skill?: string
  source?: string
  actions?: Action[]
  data?: Record<string, unknown>
  recommendations?: Array<Record<string, unknown>>
  messageId?: string
  feedback?: 'up' | 'down'
  learnedHint?: string
}

export interface SuggestionChip {
  id: string
  label: string
  action?: string
}

export interface ProactiveAlert {
  id: string
  type: string
  category: string
  text: string
  priority: number
  action?: { type: string }
  acknowledged?: boolean
  resolved?: boolean
}

interface AIState {
  status: AIStatus
  currentIntent: string | null
  currentAction: string | null
  conversationContext: { role: 'user' | 'assistant' | 'system'; content: string; intent?: string; action?: { type: string; payload: any } }[]
  messages: Message[]
  suggestions: SuggestionChip[]
  proactiveAlerts: ProactiveAlert[]
  progress: number
  sessionId: string | null
  errorMessage: string | null

  executePrompt: (text: string) => Promise<void>
  sendConfirmation: (confirmed: boolean, data?: any) => Promise<void>
  loadProactiveAlerts: () => Promise<void>
  clearConversation: () => void
  setSuggestions: (suggestions: SuggestionChip[]) => void
  setSuggestionsFromStrings: (labels: string[]) => void
  addMessage: (msg: Message) => void
  setMessages: (msgs: Message[]) => void
  addProactiveAlert: (alert: ProactiveAlert) => void
  setProactiveAlerts: (alerts: ProactiveAlert[]) => void
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  setProgress: (progress: number) => void
  setErrorMessage: (msg: string | null) => void
  setAIStatus: (status: AIStatus) => void
  setCurrentIntent: (intent: string | null) => void
  setCurrentAction: (action: string | null) => void
  resetAI: () => void
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
  messages: [],
  suggestions: [],
  proactiveAlerts: [],
  progress: 0,
  sessionId: null,
  errorMessage: null,

  setAIStatus: (status) => set({ status }),
  setCurrentIntent: (intent) => set({ currentIntent: intent }),
  setCurrentAction: (action) => set({ currentAction: action }),

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg],
  })),

  setMessages: (msgs) => set({ messages: msgs }),

  setSuggestions: (suggestions) => set({ suggestions }),

  setSuggestionsFromStrings: (labels) => set({
    suggestions: labels.map((label, i) => ({ id: `s-${i}`, label })),
  }),

  addProactiveAlert: (alert) => set((state) => ({
    proactiveAlerts: [...state.proactiveAlerts, alert]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8),
  })),

  setProactiveAlerts: (alerts) => set({ proactiveAlerts: alerts }),

  acknowledgeAlert: (id) => set((state) => ({
    proactiveAlerts: state.proactiveAlerts.map((a) =>
      a.id === id ? { ...a, acknowledged: true } : a
    ),
  })),

  resolveAlert: (id) => set((state) => ({
    proactiveAlerts: state.proactiveAlerts.map((a) =>
      a.id === id ? { ...a, resolved: true } : a
    ),
  })),

  setProgress: (progress) => set({ progress }),

  setErrorMessage: (msg) => set({ errorMessage: msg }),

  resetAI: () => set({
    status: 'idle',
    currentIntent: null,
    currentAction: null,
    messages: [],
    suggestions: [],
    proactiveAlerts: [],
    progress: 0,
    errorMessage: null,
  }),

  executePrompt: async (text) => {
    const { sessionId, conversationContext } = get()
    set({ status: 'thinking', errorMessage: null })

    const history = conversationContext.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    try {
      const res = await api.aiChat(text, history)

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
        skill: res.skill,
        actions: res.actions?.map((a: any) => ({
          id: a.id || crypto.randomUUID(),
          type: a.type,
          label: a.label || a.type,
          confidence: a.confidence ?? 1,
          params: a.params,
          requiresConfirmation: a.requiresConfirmation,
        })),
      }

      const alerts: ProactiveAlert[] = (res.proactive || []).map((a: any) => ({
        id: crypto.randomUUID(),
        type: a.type || a.category || 'info',
        category: a.type || a.category || 'info',
        text: a.text,
        priority: a.priority ?? 0,
        action: a.action ? { type: a.action.type } : undefined,
      }))

      const action = res.actions?.[0]
      const needsConfirm = action?.requiresConfirmation

      const suggestions: SuggestionChip[] = (res.suggestions || []).map((s: string, i: number) => ({
        id: `s-${i}`,
        label: s,
      }))

      set((state) => ({
        status: needsConfirm ? 'executing' : 'result',
        currentIntent: res.skill || null,
        currentAction: action?.label || null,
        messages: [...state.messages, userMsg, assistantMsg],
        suggestions,
        proactiveAlerts: [...state.proactiveAlerts, ...alerts].sort((a, b) => b.priority - a.priority).slice(0, 8),
        sessionId: sessionId || crypto.randomUUID(),
      }))
    } catch (err) {
      set((state) => ({
        status: 'error',
        errorMessage: (err as Error).message || 'AI request failed',
        messages: [...state.messages, userMsg],
      }))
    }
  },

  sendConfirmation: async (confirmed, data) => {
    const { messages, sessionId } = get()
    set({ status: 'thinking', errorMessage: null })

    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await api.aiChat(
        JSON.stringify({ confirmed, ...data }),
        history,
      )

      const msg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
        skill: res.skill,
        actions: res.actions?.map((a: any) => ({
          id: a.id || crypto.randomUUID(),
          type: a.type,
          label: a.label || a.type,
          confidence: a.confidence ?? 1,
          params: a.params,
          requiresConfirmation: a.requiresConfirmation,
        })),
      }

      set((state) => ({
        status: 'result',
        currentIntent: res.skill || null,
        currentAction: res.actions?.[0]?.label || null,
        messages: [...state.messages, msg],
        suggestions: (res.suggestions || []).map((s: string, i: number) => ({ id: `s-${i}`, label: s })),
        sessionId: sessionId || crypto.randomUUID(),
      }))
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
      const alerts: ProactiveAlert[] = list.map((a: any) => {
        const p = a.priority
        return {
          id: crypto.randomUUID(),
          type: normalizeAlertTone(a.type || a.category || 'info'),
          category: a.type || a.category || 'info',
          text: a.message || a.text || '',
          priority: typeof p === 'number' ? p : 0,
          action: a.action ? { type: a.action.type || a.action } : undefined,
        }
      }).filter((a: ProactiveAlert) => !!a.text)
      set((state) => ({
        proactiveAlerts: [...alerts, ...state.proactiveAlerts.filter(
          (existing) => !alerts.some((fresh) => fresh.text === existing.text)
        )],
      }))
    } catch {
      // silently fail
    }
  },

  clearConversation: () =>
    set({
      messages: [],
      currentIntent: null,
      currentAction: null,
      status: 'idle',
      errorMessage: null,
    }),
}))

export const useAiStore = useAIStore
