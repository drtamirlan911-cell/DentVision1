import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Bot, X, MessageSquare, Volume2, VolumeX, Archive } from 'lucide-react'
import { isVoiceRepliesEnabled, setVoiceRepliesEnabled, speak, stopSpeaking, voiceOutputSupported } from '@/utils/voice'
import { useAuth } from '@/store/auth.store'
import {
  aiChat,
  aiChatStream,
  aiProactive,
  aiDigitalTwin,
  aiBriefing,
  getActiveAiThread,
  getAiThread,
  getAiSessionId,
  clearAiSessionId,
  type AiThreadSummary,
} from '@/utils/api'
import { AIInputArea } from './AIInputArea'
import { ChatMessage } from './ChatMessage'
import { SuggestionChips } from './SuggestionChips'
import { ChatArchivePanel } from './ChatArchivePanel'
import { AIStatus } from '@/components/ai/AIStatus'
import { useAIWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor, AIAction } from '@/utils/aiExecutor'
import { ProactiveAlertsDisplay } from '@/components/ai/ProactiveAlertsDisplay'
import { ContextPanel } from '@/components/intelligence/ContextPanel'
import { ActionConfirm } from '@/components/intelligence/ActionConfirm'
import { useNavigate, useLocation } from 'react-router-dom'
import { trackProductEvent } from '@/utils/analytics'
import { detectUserTimeZone, timeGreetingInTz } from '@/lib/clinic-timezone'

import type { Message, Action } from '@/store/workspace.store'

interface AIWorkspaceIndexProps {
  onNavigate?: (path: string) => void
}

export function AIWorkspaceIndex({ onNavigate }: AIWorkspaceIndexProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clinic, isAuthenticated } = useAuth()
  // Anonymous / guest: no signed-in user. Don't wait for guest-store hydrate
  // (that race previously showed a clinic "коллега" greeting to guests).
  const isGuest = !user || !isAuthenticated
  const initializedForUser = useRef<string | null>(null)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstMessageTracked = useRef(false)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [showArchivePanel, setShowArchivePanel] = useState(false)
  const [viewingArchive, setViewingArchive] = useState<{
    sessionId: string
    label: string
    dayKey: string
  } | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)
  const [voiceReplies, setVoiceReplies] = useState(() => isVoiceRepliesEnabled())
  const [voiceResumeToken, setVoiceResumeToken] = useState(0)
  const ttsSupported = voiceOutputSupported()
  const isArchiveView = !!viewingArchive

  const toggleVoiceReplies = useCallback(() => {
    const next = !voiceReplies
    setVoiceReplies(next)
    setVoiceRepliesEnabled(next)
    if (!next) stopSpeaking()
  }, [voiceReplies])

  const messages = useAIWorkspaceStore((s) => s.ai.messages)
  const status = useAIWorkspaceStore((s) => s.ai.status)
  const suggestions = useAIWorkspaceStore((s) => s.ai.suggestions)
  const proactiveAlerts = useAIWorkspaceStore((s) => s.ai.proactiveAlerts)
  const progress = useAIWorkspaceStore((s) => s.ai.progress)
  const contextFocus = useAIWorkspaceStore((s) => s.context)

  const setAIStatus = useAIWorkspaceStore((s) => s.setAIStatus)
  const addMessage = useAIWorkspaceStore((s) => s.addMessage)
  const setMessages = useAIWorkspaceStore((s) => s.setMessages)
  const setSuggestionsFromStrings = useAIWorkspaceStore((s) => s.setSuggestionsFromStrings)
  const addProactiveAlert = useAIWorkspaceStore((s) => s.addProactiveAlert)
  const setProactiveAlerts = useAIWorkspaceStore((s) => s.setProactiveAlerts)
  const setCurrentIntent = useAIWorkspaceStore((s) => s.setCurrentIntent)
  const setCurrentAction = useAIWorkspaceStore((s) => s.setCurrentAction)
  const setContextFocus = useAIWorkspaceStore((s) => s.setContextFocus)
  const setProgress = useAIWorkspaceStore((s) => s.setProgress)
  const setErrorMessage = useAIWorkspaceStore((s) => s.setErrorMessage)
  const acknowledgeAlert = useAIWorkspaceStore((s) => s.acknowledgeAlert)
  const resolveAlert = useAIWorkspaceStore((s) => s.resolveAlert)
  const resetAI = useAIWorkspaceStore((s) => s.resetAI)

  const { executeAction } = useAIExecutor()

  const unacknowledgedCount = proactiveAlerts.filter(a => !a.acknowledged).length
  const isProcessing = status !== 'idle' && status !== 'result' && status !== 'confirmation'

  const pushDailyJarvisBriefing = useCallback(async () => {
    if (isGuest || !user?.id) return
    try {
      const brief = await aiBriefing()
      if (!brief?.reply) return
      const msg = {
        id: `jarvis-${Date.now()}`,
        role: 'assistant' as const,
        content: brief.reply,
        timestamp: new Date(),
        skill: brief.skill || 'practice',
      }
      addMessage(msg)
      historyRef.current = [...historyRef.current, { role: 'assistant', content: brief.reply }]
      if (brief.suggestions?.length) {
        setSuggestionsFromStrings(brief.suggestions.slice(0, 3))
      }
      try {
        sessionStorage.setItem('dv_jarvis_briefed_day', new Date().toISOString().slice(0, 10))
      } catch { /* ignore */ }
      trackProductEvent('ai_jarvis_daily_briefing', { role: user?.role || 'unknown' })
    } catch {
      /* non-blocking */
    }
  }, [isGuest, user?.id, user?.role, addMessage, setSuggestionsFromStrings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Bind chat to the signed-in user — reset + reload when identity changes.
  useEffect(() => {
    const userKey = user?.id ? `user:${user.id}` : 'guest'
    if (initializedForUser.current === userKey) return
    initializedForUser.current = userKey
    firstMessageTracked.current = false
    historyRef.current = []
    resetAI()
    // Ensure a stable per-user session id exists before first query.
    getAiSessionId(user?.id)

    ;(async () => {
      try {
        if (user?.id && !isGuest) {
          const active = await getActiveAiThread()
          if (active?.sessionId || active?.threadId) {
            const sid = active.sessionId || active.threadId
            setActiveSessionId(sid)
            try {
              localStorage.setItem(`dv_ai_session_${user.id}`, sid)
            } catch { /* ignore */ }
          }
          // Midnight rolled → clear local cache so we don't resurrect yesterday
          if (active?.rolled) {
            try { localStorage.removeItem(`dv_ai_thread_${user.id}`) } catch { /* ignore */ }
            clearAiSessionId(user.id)
            if (active?.sessionId) {
              try { localStorage.setItem(`dv_ai_session_${user.id}`, active.sessionId) } catch { /* ignore */ }
            }
          }
          if (active?.messages?.length) {
            const restored = active.messages.map((m: any, i: number) => ({
              id: m.id || `srv-${i}`,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp || Date.now()),
              skill: m.skill,
            }))
            setMessages(restored)
            historyRef.current = restored.map((m: any) => ({ role: m.role, content: m.content }))
            persistThread(user.id, restored)
            trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: true, source: 'server' })
            setSuggestionsFromStrings(getDefaultSuggestions(user, 'workspace', isGuest).slice(0, 3))
            // New calendar day → Jarvis posts a fresh role briefing on top of history.
            if (shouldRefreshDailyBriefing(restored) || active?.rolled) {
              void pushDailyJarvisBriefing()
            }
            return
          }
          if (active?.rolled) {
            // Fresh day with empty chat — greet + briefing
            await initializeWorkspace()
            void pushDailyJarvisBriefing()
            trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: false, rolled: true })
            return
          }
        }
      } catch { /* fall through to local */ }

      const restored = restoreThread(user?.id)
      if (restored?.length) {
        // Guests must never reopen stale CRM briefings/chips from a previous session.
        const looksLikeClinicCrm = isGuest && restored.some((m) =>
          m.role === 'assistant' &&
          (/расписан|выручк|долг|запис(и|ей)|briefing|важн(о|ые) сегодня|CRM|Системы на связи|На радаре|планы лечения|коллега/i.test(m.content) ||
            /Показать расписание|Проверить долги|Показать выручку/.test(m.content)),
        )
        if (looksLikeClinicCrm) {
          try { localStorage.removeItem('dv_ai_thread_guest') } catch { /* ignore */ }
        } else {
          const localMsgs = restored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
          setMessages(localMsgs)
          historyRef.current = restored.map((m) => ({ role: m.role, content: m.content }))
          trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: true, source: 'local' })
          setSuggestionsFromStrings(getDefaultSuggestions(user, 'workspace', isGuest).slice(0, 3))
          if (!isGuest && user?.id && shouldRefreshDailyBriefing(localMsgs)) {
            void pushDailyJarvisBriefing()
          }
          return
        }
      }
      await initializeWorkspace()
      trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: false })
    })()
  }, [user?.id, isGuest])

  useEffect(() => {
    // Only persist for the user who currently owns the in-memory thread.
    // Never overwrite today's cache while browsing an archive.
    if (isArchiveView) return
    if (messages.length > 0 && initializedForUser.current === (user?.id || 'guest')) {
      persistThread(user?.id, messages)
    }
  }, [messages, user?.id, isArchiveView])

  // Soft roll at local midnight — archive yesterday in UI without refresh.
  useEffect(() => {
    if (isGuest || !user?.id) return
    const tz = detectUserTimeZone()
    const schedule = () => {
      const now = new Date()
      // Next local midnight ≈ tomorrow 00:00:05
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 5, 0)
      return Math.max(5_000, tomorrow.getTime() - now.getTime())
    }
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      timer = setTimeout(async () => {
        try {
          clearAiSessionId(user.id)
          try { localStorage.removeItem(`dv_ai_thread_${user.id}`) } catch { /* ignore */ }
          initializedForUser.current = null
          setViewingArchive(null)
          // Force re-init path
          const key = `user:${user.id}`
          initializedForUser.current = key
          resetAI()
          historyRef.current = []
          const active = await getActiveAiThread()
          if (active?.sessionId) {
            setActiveSessionId(active.sessionId)
            try { localStorage.setItem(`dv_ai_session_${user.id}`, active.sessionId) } catch { /* ignore */ }
          }
          setMessages([])
          await initializeWorkspace()
          void pushDailyJarvisBriefing()
          trackProductEvent('ai_chat_midnight_roll', { tz })
        } catch { /* ignore */ }
        arm()
      }, schedule())
    }
    arm()
    return () => clearTimeout(timer)
  }, [isGuest, user?.id])

  const openTodayChat = useCallback(async () => {
    if (!user?.id || isGuest) {
      setViewingArchive(null)
      return
    }
    setViewingArchive(null)
    try {
      const active = await getActiveAiThread()
      const sid = active?.sessionId || active?.threadId
      if (sid) {
        setActiveSessionId(sid)
        try { localStorage.setItem(`dv_ai_session_${user.id}`, sid) } catch { /* ignore */ }
      }
      if (active?.messages?.length) {
        const restored = active.messages.map((m: any, i: number) => ({
          id: m.id || `srv-${i}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp || Date.now()),
          skill: m.skill,
        }))
        setMessages(restored)
        historyRef.current = restored.map((m: any) => ({ role: m.role, content: m.content }))
      } else {
        historyRef.current = []
        await initializeWorkspace()
      }
    } catch { /* ignore */ }
  }, [user?.id, isGuest, setMessages])

  const openArchiveChat = useCallback(async (thread: AiThreadSummary) => {
    if (!user?.id) return
    try {
      const detail = await getAiThread(thread.sessionId)
      if (!detail) return
      setViewingArchive({
        sessionId: detail.sessionId,
        label: detail.label || thread.label,
        dayKey: detail.dayKey || thread.dayKey,
      })
      const restored = (detail.messages || []).map((m: any, i: number) => ({
        id: m.id || `arc-${i}`,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp || Date.now()),
      }))
      setMessages(restored)
      historyRef.current = restored.map((m: any) => ({ role: m.role, content: m.content }))
      trackProductEvent('ai_archive_open', { dayKey: thread.dayKey })
    } catch { /* ignore */ }
  }, [user?.id, setMessages])

  useEffect(() => {
    const q = (location.state as any)?.aiQuery
    if (q && typeof q === 'string') {
      handleSend(q)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

  useEffect(() => {
    if (status === 'idle' || status === 'result' || status === 'confirmation') {
      setSuggestionsFromStrings(getDefaultSuggestions(user, contextFocus.focusType, isGuest).slice(0, 3))
    }
  }, [contextFocus.focusType, user, isGuest])

  const initializeWorkspace = async () => {
    const started = Date.now()
    try {
      // Guests / anonymous: product guide only — never clinic Jarvis briefing.
      if (isGuest || !user?.id) {
        const reply = buildGuestGreeting()
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
          skill: 'practice',
        }])
        historyRef.current = [{ role: 'assistant', content: reply }]
        trackProductEvent('ai_greeting_rendered', {
          role: 'guest',
          latency_ms: Date.now() - started,
          data_complete: true,
        })
        setSuggestionsFromStrings(getDefaultSuggestions(null, 'workspace', true).slice(0, 3))
        // Prefetch platform twin + guest tips into context (non-blocking).
        void Promise.all([
          aiDigitalTwin().catch(() => null),
          aiProactive().catch(() => ({ alerts: [] })),
        ]).then(([twinRes, proactiveData]) => {
          const twin = twinRes?.twin || twinRes
          if (twin) setContextFocus('workspace', null, { digitalTwin: twin })
          if (proactiveData?.alerts?.length) {
            setProactiveAlerts(proactiveData.alerts.map((a: any) => ({
              id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: a.type || 'info',
              category: a.category || 'general',
              text: a.text || a.message || '',
              priority: a.priority || 0,
              action: a.action,
            })))
          }
        })
        return
      }

      // Jarvis entry: live role briefing first; chat/LLM only as fallback.
      const [briefRes, proactiveData, twinData] = await Promise.all([
        aiBriefing().catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
        aiDigitalTwin().catch(() => ({ twin: null })),
      ])

      let chatRes = briefRes
      if (!chatRes?.reply) {
        chatRes = await aiChat('Сводка при входе', [], { userId: user?.id }).catch(() => null)
      }

      let reply = chatRes?.reply || buildGreeting(user, clinic, proactiveData?.alerts || [])

      if (proactiveData?.alerts?.length && !chatRes?.reply) {
        const alertLines = proactiveData.alerts.slice(0, 3).map((a: any) => `• ${a.text}`).join('\n')
        reply = `${buildGreeting(user, clinic, [])}\n\nНа радаре:\n${alertLines}`
      }

      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        skill: chatRes?.skill || 'practice',
      }])
      try {
        sessionStorage.setItem('dv_jarvis_briefed_day', new Date().toISOString().slice(0, 10))
      } catch { /* ignore */ }
      trackProductEvent('ai_greeting_rendered', {
        role: user?.role || 'guest',
        latency_ms: Date.now() - started,
        data_complete: !!(proactiveData?.alerts?.length || chatRes?.reply),
        jarvis: true,
      })
      setSuggestionsFromStrings(
        (chatRes?.suggestions || getDefaultSuggestions(user, 'workspace', false)).slice(0, 3)
      )
      if (proactiveData?.alerts?.length) {
        setProactiveAlerts(proactiveData.alerts.map((a: any) => ({
          id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: a.type || 'info',
          category: a.category || 'general',
          text: a.text || a.message || '',
          priority: a.priority || 0,
          action: a.action,
        })))
      }
      if (twinData?.twin) {
        setContextFocus('workspace', null, { digitalTwin: twinData.twin })
      }
      historyRef.current = [{ role: 'assistant', content: reply }]
    } catch {
      const fallback = isGuest ? buildGuestGreeting() : buildGreeting(user, clinic, [])
      setMessages([{ id: 'greeting', role: 'assistant', content: fallback, timestamp: new Date() }])
      historyRef.current = [{ role: 'assistant', content: fallback }]
      setSuggestionsFromStrings(getDefaultSuggestions(user, 'workspace', isGuest).slice(0, 3))
      trackProductEvent('ai_greeting_rendered', {
        role: user?.role || 'guest',
        latency_ms: Date.now() - started,
        data_complete: false,
      })
    }
  }

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing || isArchiveView) return

    stopSpeaking()

    if (!firstMessageTracked.current) {
      firstMessageTracked.current = true
      trackProductEvent('first_user_message_sent')
    }

    addMessage({ id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date() })
    setAIStatus('thinking')
    setSuggestionsFromStrings([])
    setCurrentIntent(null)
    setCurrentAction(null)
    setPendingConfirm(null)
    historyRef.current.push({ role: 'user', content: text })

    const assistantId = `a-${Date.now()}`
    let assistantCreated = false

    const upsertAssistant = (patch: Record<string, unknown>) => {
      useAIWorkspaceStore.setState((state) => {
        const exists = state.ai.messages.some((m) => m.id === assistantId)
        if (!exists) {
          assistantCreated = true
          return {
            ai: {
              ...state.ai,
              messages: [
                ...state.ai.messages,
                {
                  id: assistantId,
                  role: 'assistant' as const,
                  content: '',
                  timestamp: new Date(),
                  ...patch,
                },
              ],
            },
          }
        }
        return {
          ai: {
            ...state.ai,
            messages: state.ai.messages.map((m) =>
              m.id === assistantId ? { ...m, ...patch } : m
            ),
          },
        }
      })
    }

    try {
      const res = await aiChatStream(text, historyRef.current.slice(-20), (partial, done) => {
        // Create the assistant bubble only when the first non-empty token arrives —
        // otherwise the UI shows an empty grey bubble + thumbs/copy while thinking.
        if (!partial?.trim() && !done) return
        upsertAssistant({
          content: partial,
        })
        if (!done) setAIStatus('thinking')
      }, { userId: user?.id })

      if (res.conversationContext?.entities) {
        setCurrentIntent({
          id: `int-${Date.now()}`,
          type: res.skill || 'general',
          skill: res.skill || 'general',
          entities: res.conversationContext.entities as Record<string, unknown>,
          confidence: 1,
        })
        const entityKeys = Object.keys(res.conversationContext.entities as Record<string, unknown>)
        if (entityKeys.includes('patientId') || entityKeys.includes('patientName')) {
          setContextFocus('patient', (res.conversationContext.entities as any).patientId || null, res.conversationContext.entities as Record<string, unknown>)
        } else if (entityKeys.includes('productId') || entityKeys.includes('productName')) {
          setContextFocus('product', (res.conversationContext.entities as any).productId || null, res.conversationContext.entities as Record<string, unknown>)
        }
      }

      const finalContent = String(res.reply || '').trim()
      const hasExtras = !!(res.data || res.actions?.length || res.recommendations?.length)
      if (finalContent || hasExtras) {
        upsertAssistant({
          content: finalContent,
          skill: res.skill,
          source: res.source,
          actions: res.actions?.map((a: any) => ({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: a.type || a.action,
            label: a.label,
            confidence: a.confidence || 1,
            params: a.params || {},
            requiresConfirmation: a.requiresConfirmation,
          })),
          data: res.data,
          recommendations: res.recommendations,
        })
      } else if (assistantCreated) {
        // Drop placeholder if the model returned nothing usable
        useAIWorkspaceStore.setState((state) => ({
          ai: {
            ...state.ai,
            messages: state.ai.messages.filter((m) => m.id !== assistantId),
          },
        }))
      }

      const nextSuggestions = (res.suggestions || []).slice(0, 4)
      const crmChip = /расписан|долг|выручк|касс|что важно/i
      setSuggestionsFromStrings(
        isGuest
          ? (nextSuggestions.filter((s: string) => !crmChip.test(s)).length
              ? nextSuggestions.filter((s: string) => !crmChip.test(s))
              : getDefaultSuggestions(null, 'workspace', true)).slice(0, 3)
          : nextSuggestions,
      )
      historyRef.current.push({ role: 'assistant', content: res.reply || '' })

      if (voiceReplies && res.reply) {
        speak(res.reply, {
          onEnd: () => {
            // Hands-free loop: after the assistant finishes speaking, open the mic again.
            if (isVoiceRepliesEnabled()) setVoiceResumeToken((n) => n + 1)
          },
        })
      }

      if (res.proactive?.length) {
        for (const p of res.proactive) {
          addProactiveAlert({
            id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: p.type || 'info',
            category: p.category || 'general',
            text: p.text,
            priority: p.priority || 0,
            action: p.action,
          })
        }
      }

      if (res.actions?.length) {
        const action = res.actions[0]
        const aiAction: Action = {
          id: `act-${Date.now()}`,
          type: (action as any).type || (action as any).action,
          label: action.label,
          confidence: action.confidence || 1,
          params: action.params || {},
          requiresConfirmation: (action as any).requiresConfirmation ?? true,
        }
        setCurrentAction(aiAction)

        const needsConfirm = aiAction.requiresConfirmation || (action.confidence ?? 1) <= 0.85
        if (!needsConfirm && (action.confidence ?? 0) > 0.85) {
          setAIStatus('executing')
          setProgress(0)
          try {
            const result = await executeAction(
              { ...aiAction, requiresConfirmation: false } as AIAction,
              {
                onNavigate: (path) => { navigate(path); onNavigate?.(path) },
                addMessage: (msg: any) => addMessage({
                  id: `act-${Date.now()}`,
                  role: msg.role || 'assistant',
                  content: msg.content,
                  timestamp: msg.timestamp || new Date(),
                  data: msg.data,
                }),
              }
            )
            setProgress(100)
            setAIStatus('result')
            setTimeout(() => setAIStatus('idle'), 1500)
            if (result?.type === 'navigate' && result.path) navigate(result.path)
            else if (NAV_ACTIONS[aiAction.type]) {
              navigate(NAV_ACTIONS[aiAction.type])
              onNavigate?.(NAV_ACTIONS[aiAction.type])
            }
          } catch (e: any) {
            setAIStatus('error')
            setErrorMessage(e?.message || 'Неизвестная ошибка')
            setTimeout(() => setAIStatus('idle'), 3000)
            addMessage({
              id: `action-err-${Date.now()}`,
              role: 'assistant',
              content: `Ошибка: ${e?.message || 'неизвестная ошибка'}`,
              timestamp: new Date(),
            })
          }
        } else {
          setPendingConfirm(aiAction)
          setAIStatus('confirmation')
        }
      } else {
        setAIStatus('idle')
      }
    } catch {
      upsertAssistant({
        content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
      })
      setAIStatus('idle')
    } finally {
      setProgress(0)
    }
  }, [isProcessing, onNavigate, addMessage, setAIStatus, setSuggestionsFromStrings, setCurrentIntent, setCurrentAction, setContextFocus, addProactiveAlert, setProgress, setErrorMessage, executeAction, navigate, voiceReplies, isGuest])

  const handleActionConfirm = useCallback(async (confirmed: boolean) => {
    const action = pendingConfirm
    setPendingConfirm(null)
    if (!action) {
      setAIStatus('idle')
      return
    }
    if (!confirmed) {
      trackProductEvent('ai_action_cancelled', { action: action.type })
      setCurrentAction(null)
      setAIStatus('idle')
      addMessage({
        id: `cancel-${Date.now()}`,
        role: 'assistant',
        content: 'Действие отменено. Чем ещё помочь?',
        timestamp: new Date(),
      })
      return
    }

    trackProductEvent('ai_action_confirmed', { action: action.type })
    setAIStatus('executing')
    setProgress(0)
    try {
const result = await executeAction(
      { ...action, requiresConfirmation: false } as AIAction,
      {
        onNavigate: (path) => { navigate(path); onNavigate?.(path) },
        addMessage: (msg: any) => addMessage({
          id: `act-${Date.now()}`,
          role: msg.role || 'assistant',
          content: msg.content,
          timestamp: msg.timestamp || new Date(),
          data: msg.data,
        }),
      }
    )
      setProgress(100)
      setAIStatus('result')
      setTimeout(() => setAIStatus('idle'), 1500)
      setCurrentAction(null)
      if (result?.type === 'navigate' && result.path) {
        navigate(result.path)
      } else if (NAV_ACTIONS[action.type]) {
        navigate(NAV_ACTIONS[action.type])
      }
    } catch (e: any) {
      setAIStatus('error')
      setErrorMessage(e?.message || 'Ошибка выполнения')
      setTimeout(() => setAIStatus('idle'), 3000)
    }
  }, [pendingConfirm, executeAction, navigate, onNavigate, setAIStatus, setProgress, setErrorMessage, setCurrentAction, addMessage])

  const showEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-surface-0">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.04] bg-surface-0/50 backdrop-blur-xl flex-shrink-0 sticky top-0 z-10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/25 to-dv-gold/5 border border-dv-gold/20 shadow-[0_0_24px_rgba(201,169,110,0.12)]">
            <Bot size={18} className="text-dv-gold" />
          </div>
          <div>
            <h1 className="font-serif text-[15px] font-semibold text-txt-primary tracking-tight">DentVision Intelligence</h1>
            <p className="text-[11px] text-txt-muted">
              {isArchiveView
                ? `Архив · ${viewingArchive?.label}`
                : status === 'idle' ? 'AI Operating System · стоматология' :
               status === 'thinking' ? 'AI анализирует...' :
               status === 'executing' ? 'Выполняю...' :
               status === 'confirmation' ? 'Ожидаю подтверждение' :
               status === 'result' ? 'Готово' : 'Ошибка'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unacknowledgedCount > 0 && !isArchiveView && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowContextPanel(true)}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-amber-400 bg-amber-400/8 border border-amber-400/15 hover:bg-amber-400/15 transition-all"
            >
              <Sparkles size={14} />
              <span className="text-xs font-semibold hidden sm:inline">{unacknowledgedCount}</span>
            </motion.button>
          )}

          {!isGuest && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowArchivePanel(true)}
              title="Архив чатов"
              aria-label="Архив чатов"
              className={
                isArchiveView || showArchivePanel
                  ? 'flex h-8 w-8 items-center justify-center rounded-lg text-dv-gold bg-dv-gold/10 border border-dv-gold/20 hover:bg-dv-gold/15 transition-colors'
                  : 'flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors'
              }
            >
              <Archive size={15} strokeWidth={1.75} />
            </motion.button>
          )}

          {ttsSupported && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={toggleVoiceReplies}
              title={voiceReplies ? 'Выключить голосовые ответы' : 'Включить голосовые ответы'}
              aria-label={voiceReplies ? 'Выключить голосовые ответы' : 'Включить голосовые ответы'}
              aria-pressed={voiceReplies}
              className={
                voiceReplies
                  ? 'flex h-8 w-8 items-center justify-center rounded-lg text-dv-gold bg-dv-gold/10 border border-dv-gold/20 hover:bg-dv-gold/15 transition-colors'
                  : 'flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors'
              }
            >
              {voiceReplies ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowContextPanel(!showContextPanel)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
          >
            <MessageSquare size={16} />
          </motion.button>

          <AIStatus />
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-5">
          {isArchiveView && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-txt-primary">Архив · {viewingArchive?.label}</p>
                <p className="text-[11px] text-txt-muted">Только просмотр · хранится до 7 дней</p>
              </div>
              <button
                type="button"
                onClick={() => { void openTodayChat() }}
                className="shrink-0 rounded-xl border border-dv-gold/20 bg-dv-gold/10 px-3 py-1.5 text-[11px] font-medium text-dv-gold hover:bg-dv-gold/15 transition-colors"
              >
                К сегодня
              </button>
            </motion.div>
          )}

          {showEmpty && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              className="relative flex flex-col items-center justify-center py-20 text-center overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-0"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(201,169,110,0.14), transparent 70%)',
                }}
              />
              <motion.div
                animate={{ scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-dv-gold/25 via-dv-gold/10 to-transparent border border-dv-gold/20 mb-6 shadow-[0_0_48px_rgba(201,169,110,0.18)]"
              >
                <Bot size={30} className="text-dv-gold" />
              </motion.div>
              <h2 className="relative font-serif text-2xl md:text-[1.75rem] font-semibold tracking-tight text-txt-primary mb-2">
                DentVision Intelligence
              </h2>
              <p className="relative text-sm text-txt-muted max-w-sm leading-relaxed">
                AI-операционка клиники. Спросите о расписании, выручке или долгах — или выберите действие ниже.
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                msg={msg as any}
                onAction={(q) => { void handleSend(q) }}
                onExecuteAction={(a) => {
                  const type = a.type || a.action || ''
                  const path = NAV_ACTIONS[type]
                  if (path) {
                    navigate(path)
                    onNavigate?.(path)
                    return
                  }
                  void handleSend(a.label)
                }}
              />
            ))}
          </AnimatePresence>

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/15 to-dv-gold/5 border border-dv-gold/10">
                <Bot size={17} className="text-dv-gold" />
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl rounded-bl-xl px-5 py-3.5">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-dv-gold/50"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {unacknowledgedCount > 0 && (
        <ProactiveAlertsDisplay
          alerts={proactiveAlerts as any}
          onAcknowledge={acknowledgeAlert}
          onResolve={resolveAlert}
        />
      )}

      <div className="flex-shrink-0 border-t border-white/[0.04] bg-surface-0/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto">
          {suggestions.length > 0 && !isProcessing && !isArchiveView && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 md:px-6 pt-4 pb-1"
            >
              <SuggestionChips
                suggestions={suggestions.map(s => s.label)}
                onSelect={handleSend}
                disabled={isProcessing || isArchiveView}
              />
            </motion.div>
          )}
          {!isArchiveView ? (
            <AIInputArea
              onSend={handleSend}
              disabled={isProcessing}
              status={status === 'confirmation' ? 'result' : status}
              progress={progress}
              suggestions={suggestions.map(s => s.label)}
              placeholder={isGuest
                ? 'Спросите о DentVision, демо, Academy или маркетплейсе…'
                : 'Спросите: что важно сегодня, покажи выручку, проверь долги…'}
              voiceResumeToken={voiceReplies ? voiceResumeToken : 0}
            />
          ) : (
            <div className="px-4 md:px-6 pb-5">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-center text-[12px] text-txt-muted">
                Архивный день · ввод недоступен
              </div>
            </div>
          )}
        </div>
      </div>

      <ChatArchivePanel
        open={showArchivePanel}
        onClose={() => setShowArchivePanel(false)}
        activeSessionId={activeSessionId}
        viewingSessionId={viewingArchive?.sessionId || activeSessionId}
        onSelectToday={() => { void openTodayChat() }}
        onSelectArchive={(thread) => { void openArchiveChat(thread) }}
      />

      <AnimatePresence>
        {pendingConfirm && (
          <ActionConfirm
            action={{
              action: pendingConfirm.type,
              label: pendingConfirm.label,
              confidence: pendingConfirm.confidence,
              params: pendingConfirm.params,
            }}
            message="AI подготовил действие. Подтвердите выполнение безопасностью DNA."
            onConfirm={handleActionConfirm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContextPanel && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-80 md:w-96 bg-surface-1 border-l border-bdr-subtle flex flex-col"
          >
            <div className="flex h-12 items-center justify-between px-4 border-b border-bdr-subtle">
              <h3 className="text-sm font-semibold text-txt-primary">Контекст</h3>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowContextPanel(false)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} className="text-txt-muted" />
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ContextPanel
                onClose={() => setShowContextPanel(false)}
                clinic={clinic}
                user={user}
                role={user?.role}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContextPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setShowContextPanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function persistThread(userId: string | undefined, messages: Message[]) {
  try {
    const key = `dv_ai_thread_${userId || 'guest'}`
    const slim = messages.slice(-40).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      skill: m.skill,
      source: m.source,
    }))
    localStorage.setItem(key, JSON.stringify(slim))
  } catch { /* ignore */ }
}

function restoreThread(userId: string | undefined): Message[] | null {
  try {
    const key = `dv_ai_thread_${userId || 'guest'}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : null
  } catch {
    return null
  }
}

function buildGuestGreeting() {
  const greeting = timeGreetingInTz(new Date(), detectUserTimeZone())
  return [
    `${greeting}. Я DentVision Intelligence — гид по платформе.`,
    '',
    'Сейчас вы в гостевом режиме: могу провести по CRM, маркету и Academy.',
    'Данные клиники (расписание, касса, карты) появятся после входа.',
    '',
    '• **CRM** — расписание, пациенты, касса',
    '• **Маркет** — закупки у поставщиков',
    '• **Academy** — курсы и вебинары',
    '',
    'С чего начнём — или откройте демо-клинику.',
  ].join('\n')
}

function buildGreeting(u: any, c: any, alerts: any[]) {
  const greeting = timeGreetingInTz(new Date(), detectUserTimeZone())
  const name = u?.name?.split(' ')[0] || u?.firstName || u?.login || 'коллега'
  const role = (u?.role || '').toLowerCase()
  const clinicName = c?.name || ''

  const roleLine =
    role === 'owner' || role === 'руководитель' || role === 'director'
      ? 'На радаре: выручка, долги, загрузка и склад. Могу собрать сводку дня.'
      : role === 'admin' || role === 'администратор' || role === 'reception'
        ? 'На радаре: подтверждения записей, ближайшие приёмы и касса.'
        : role === 'buyer'
          ? 'На радаре: остатки склада и закупки.'
          : 'На радаре: ваше расписание, карта и планы лечения.'
  const lines = [
    `${greeting}, ${name}. Системы на связи.`,
    clinicName ? `Клиника: **${clinicName}**.` : '',
    roleLine,
    alerts?.length ? '' : 'С чего начнём?',
  ].filter(Boolean)

  return lines.join('\n')
}

function dayKey(d: Date | string = new Date()) {
  const x = typeof d === 'string' ? new Date(d) : d
  return x.toISOString().slice(0, 10)
}

function shouldRefreshDailyBriefing(messages: Array<{ role: string; timestamp?: Date | string }>) {
  try {
    const marked = sessionStorage.getItem('dv_jarvis_briefed_day')
    if (marked === dayKey()) return false
  } catch { /* ignore */ }
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  if (!lastAssistant?.timestamp) return true
  return dayKey(lastAssistant.timestamp) !== dayKey()
}

function getDefaultSuggestions(u: any, focusType: string, guest = false) {
  if (guest || !u) {
    return ['Чем полезен DentVision?', 'Открыть демо-клинику', 'Что в Academy OS?']
  }
  const role = (u?.role || '').toLowerCase()
  if (focusType === 'patient') {
    return ['История лечения', 'План лечения', 'Зубная карта']
  }
  if (role === 'doctor' || role === 'assistant') {
    return ['Показать расписание', 'Открыть зубную карту', 'Создать план лечения']
  }
  if (role === 'owner' || role === 'руководитель' || role === 'director' || role === 'manager') {
    return ['Что важно сегодня?', 'Показать выручку', 'Проверить долги', 'Показать расписание']
  }
  if (role === 'admin' || role === 'администратор' || role === 'reception') {
    return ['Показать расписание', 'Записать пациента', 'Открыть кассу']
  }
  if (role === 'buyer') {
    return ['Что на складе', 'Открыть маркетплейс', 'Показать заказы']
  }
  return ['Что важно сегодня?', 'Показать расписание', 'Проверить долги']
}

const NAV_ACTIONS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OPEN_SCHEDULE: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OPEN_PATIENTS: '/crm/patients',
  OpenCashier: '/crm/finance',
  OpenFinance: '/crm/finance',
  OPEN_FINANCE: '/crm/finance',
  OpenLab: '/crm/lab',
  OPEN_LABORATORY: '/crm/lab',
  OpenShop: '/shop',
  OPEN_SHOP: '/shop',
  OpenSchool: '/school',
  OPEN_SCHOOL: '/school',
  OpenAnalytics: '/analytics',
  OPEN_ANALYTICS: '/analytics',
  OpenDocuments: '/crm/documents',
  OPEN_DOCUMENTS: '/crm/documents',
  OpenReminders: '/crm/reminders',
  OpenSettings: '/settings',
  OpenProfile: '/profile',
  OpenMedicalCard: '/crm/medical-card',
  OPEN_MEDICAL_CARD: '/crm/medical-card',
  OpenVisits: '/crm/visits',
  OpenInventory: '/crm/inventory',
  OPEN_INVENTORY: '/crm/inventory',
  OpenStaff: '/crm/staff',
  OpenPatient: '/crm/patients',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenJobs: '/jobs',
  OpenCommunity: '/community',
  OpenCRM: '/crm',
  OPEN_CRM: '/crm',
  OpenDemo: '/demo',
  OpenPricing: '/pricing',
}

export type { AIWorkspaceIndexProps }
