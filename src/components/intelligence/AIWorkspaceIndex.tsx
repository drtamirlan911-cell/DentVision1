import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Bot, X, MessageSquare, Volume2, VolumeX } from 'lucide-react'
import { isVoiceRepliesEnabled, setVoiceRepliesEnabled, speak, stopSpeaking, voiceOutputSupported } from '@/utils/voice'
import { useAuth } from '@/store/auth.store'
import { aiChat, aiChatStream, aiProactive, aiDigitalTwin, aiBriefing, getActiveAiThread, getAiSessionId, aiFeedback, aiSessionStorageKey, aiThreadStorageKey } from '@/utils/api'
import { AIInputArea } from './AIInputArea'
import { ChatMessage } from './ChatMessage'
import { SuggestionChips } from './SuggestionChips'
import { AIStatus } from '@/components/ai/AIStatus'
import { useAIWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor, AIAction } from '@/utils/aiExecutor'
import { ProactiveAlertsDisplay } from '@/components/ai/ProactiveAlertsDisplay'
import { ContextPanel } from '@/components/intelligence/ContextPanel'
import { ActionConfirm } from '@/components/intelligence/ActionConfirm'
import { useNavigate, useLocation } from 'react-router-dom'
import { trackProductEvent } from '@/utils/analytics'
import { detectUserTimeZone, timeGreetingInTz } from '@/lib/clinic-timezone'
import { alertDismissKey, filterDismissedAlerts } from '@/utils/dismissedAlerts'
import { buildLiveClinicGreeting, isStaticRadarGreeting } from '@/lib/liveGreeting'
import { answerJobsSearchQuery } from '@/lib/jobsAiQuery'
import { AI_NAV_ACTIONS, getSmartSuggestions } from '@/lib/aiPlatformMap'
import { useGuestStore } from '@/store/guest.store'

import type { Message, Action } from '@/store/workspace.store'

function mapProactiveAlerts(raw: any[]): Array<{
  id: string
  type: string
  category: string
  text: string
  priority: number
  action?: { type: string; path?: string; params?: Record<string, unknown> }
}> {
  const mapped = (Array.isArray(raw) ? raw : []).map((a: any, i: number) => {
    const text = a.text || a.message || ''
    const rawAction = a.action
    const action = rawAction
      ? {
          ...rawAction,
          params: {
            ...(rawAction.params || {}),
            ...(rawAction.path ? { path: rawAction.path } : {}),
          },
        }
      : undefined
    const stable = alertDismissKey({ action, text, message: text, id: a.id })
    return {
      id: a.id || `${stable}-${i}`,
      type: a.type || 'info',
      category: a.category || 'general',
      text,
      priority: typeof a.priority === 'number' ? a.priority : Number(a.priority) || 0,
      action,
    }
  }).filter((a) => a.text)
  return filterDismissedAlerts(mapped)
}

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
  const aiRequestsLeft = useGuestStore((s) => s.aiRequestsLeft)
  const setAiRequestsLeft = useGuestStore((s) => s.setAiRequestsLeft)
  const clinicId = clinic?.id || null
  const initializedForUser = useRef<string | null>(null)
  const initGeneration = useRef(0)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstMessageTracked = useRef(false)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)
  const [voiceReplies, setVoiceReplies] = useState(() => isVoiceRepliesEnabled())
  const [voiceResumeToken, setVoiceResumeToken] = useState(0)
  const [activePersonaLabel, setActivePersonaLabel] = useState<string | null>(null)
  const ttsSupported = voiceOutputSupported()

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
      let brief = await aiBriefing().catch(() => null)
      if (!brief?.reply) {
        const live = await buildLiveClinicGreeting({ user, clinic }).catch(() => null)
        if (live?.reply) {
          brief = {
            reply: live.reply,
            suggestions: live.suggestions,
            skill: 'practice',
            actions: [],
            proactive: [],
            conversationContext: { turnCount: 0, entities: {} },
          }
        }
      }
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
      trackProductEvent('ai_jarvis_daily_briefing', { role: user?.role || 'unknown', live_fallback: !!(brief as any) })
    } catch {
      /* non-blocking */
    }
  }, [isGuest, user, clinic, addMessage, setSuggestionsFromStrings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Bind chat to signed-in user + active clinic — reset when either changes.
  useEffect(() => {
    const userKey = user?.id
      ? `user:${user.id}:clinic:${clinicId || 'none'}`
      : 'guest'
    if (initializedForUser.current === userKey) return
    initializedForUser.current = userKey
    const gen = ++initGeneration.current
    const stillCurrent = () => initGeneration.current === gen && initializedForUser.current === userKey
    firstMessageTracked.current = false
    historyRef.current = []
    resetAI()
    // Ensure a stable per-user+clinic session id exists before first query.
    getAiSessionId(user?.id, clinicId)

    ;(async () => {
      try {
        if (user?.id && !isGuest) {
          const active = await getActiveAiThread()
          if (!stillCurrent()) return
          if (active?.sessionId || active?.threadId) {
            try {
              localStorage.setItem(
                aiSessionStorageKey(user.id, clinicId),
                active.sessionId || active.threadId,
              )
            } catch { /* ignore */ }
          }
          if (active?.messages?.length) {
            const restored = active.messages.map((m: any, i: number) => ({
              id: m.id || `srv-${i}`,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp || Date.now()),
              skill: m.skill,
            }))
            // Never keep a guest concierge thread under a signed-in clinic session.
            if (looksLikeGuestThread(restored)) {
              /* fall through to fresh clinic workspace */
            } else {
              if (!stillCurrent()) return
              setMessages(restored)
              historyRef.current = restored.map((m: any) => ({ role: m.role, content: m.content }))
              persistThread(user.id, clinicId, restored)
              trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: true, source: 'server' })
              setSuggestionsFromStrings(getSmartSuggestions({ user, guest: isGuest, pathname: location.pathname, focusType: 'workspace' }).slice(0, 4))
              if (shouldRefreshDailyBriefing(restored) || restored.some((m) => m.role === 'assistant' && isStaticRadarGreeting(m.content))) {
                void pushDailyJarvisBriefing()
              }
              return
            }
          }
        }
      } catch { /* fall through to local */ }

      if (!stillCurrent()) return

      const restored = restoreThread(user?.id, clinicId)
      if (restored?.length) {
        // Guests must never reopen stale CRM briefings/chips from a previous session.
        const looksLikeClinicCrm = isGuest && restored.some((m) =>
          m.role === 'assistant' &&
          (/расписан|выручк|долг|запис(и|ей)|briefing|важн(о|ые) сегодня|CRM|Системы на связи|На радаре|планы лечения|коллега/i.test(m.content) ||
            /Показать расписание|Проверить долги|Показать выручку/.test(m.content)),
        )
        const guestLeakIntoAuth = !isGuest && looksLikeGuestThread(restored)
        if (looksLikeClinicCrm || guestLeakIntoAuth) {
          try { localStorage.removeItem(aiThreadStorageKey(user?.id, clinicId)) } catch { /* ignore */ }
          try { localStorage.removeItem(aiThreadStorageKey(undefined, null)) } catch { /* ignore */ }
          try { localStorage.removeItem('dv_ai_thread_guest') } catch { /* ignore */ }
        } else {
          const localMsgs = restored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
          if (!stillCurrent()) return
          setMessages(localMsgs)
          historyRef.current = restored.map((m) => ({ role: m.role, content: m.content }))
          trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: true, source: 'local' })
          setSuggestionsFromStrings(getSmartSuggestions({ user, guest: isGuest, pathname: location.pathname, focusType: 'workspace' }).slice(0, 4))
          if (!isGuest && user?.id && (
            shouldRefreshDailyBriefing(localMsgs)
            || localMsgs.some((m) => m.role === 'assistant' && isStaticRadarGreeting(m.content))
          )) {
            void pushDailyJarvisBriefing()
          }
          return
        }
      }
      if (!stillCurrent()) return
      await initializeWorkspace()
      if (!stillCurrent()) return
      trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: false })
    })()
  }, [user?.id, clinicId, isGuest])

  useEffect(() => {
    // Only persist for the user+clinic who currently owns the in-memory thread.
    const key = user?.id ? `user:${user.id}:clinic:${clinicId || 'none'}` : 'guest'
    if (messages.length > 0 && initializedForUser.current === key) {
      persistThread(user?.id, clinicId, messages)
    }
  }, [messages, user?.id, clinicId])

  useEffect(() => {
    const q = (location.state as any)?.aiQuery
    if (q && typeof q === 'string') {
      handleSend(q)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

  useEffect(() => {
    if (status === 'idle' || status === 'result' || status === 'confirmation') {
      setSuggestionsFromStrings(getSmartSuggestions({
        user,
        guest: isGuest,
        pathname: location.pathname,
        focusType: contextFocus.focusType,
      }).slice(0, 4))
    }
  }, [contextFocus.focusType, user, isGuest, location.pathname])

  const initializeWorkspace = async () => {
    const started = Date.now()
    const expectedKey = initializedForUser.current
    const gen = initGeneration.current
    const stillCurrent = () =>
      initGeneration.current === gen && initializedForUser.current === expectedKey
    try {
      // Guests / anonymous: product guide only — never clinic Jarvis briefing.
      if (isGuest || !user?.id) {
        const reply = buildGuestGreeting()
        if (!stillCurrent()) return
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
        setSuggestionsFromStrings(getSmartSuggestions({ guest: true, pathname: location.pathname }).slice(0, 4))
        // Prefetch platform twin + guest tips into context (non-blocking).
        void Promise.all([
          aiDigitalTwin().catch(() => null),
          aiProactive().catch(() => ({ alerts: [] })),
        ]).then(([twinRes, proactiveData]) => {
          if (!stillCurrent()) return
          const twin = twinRes?.twin || twinRes
          if (twin) setContextFocus('workspace', null, { digitalTwin: twin })
          if (proactiveData?.alerts?.length) {
            setProactiveAlerts(mapProactiveAlerts(proactiveData.alerts))
          }
        })
        return
      }

      // Jarvis entry: live role briefing first; CRM client snapshot as fallback (never static fluff).
      const [briefRes, proactiveData, twinData] = await Promise.all([
        aiBriefing().catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
        aiDigitalTwin().catch(() => ({ twin: null })),
      ])
      if (!stillCurrent()) return

      let chatRes = briefRes
      if (!chatRes?.reply) {
        chatRes = await aiChat('Сводка при входе', [], { userId: user?.id }).catch(() => null)
      }
      if (!stillCurrent()) return

      let reply = chatRes?.reply || ''
      let suggestions = (chatRes?.suggestions || []) as string[]
      let usedLiveFallback = false

      if (!reply || isStaticRadarGreeting(reply)) {
        const live = await buildLiveClinicGreeting({
          user,
          clinic,
          proactiveAlerts: proactiveData?.alerts || [],
        }).catch(() => null)
        if (live?.reply) {
          reply = live.reply
          suggestions = live.suggestions
          usedLiveFallback = true
        }
      }

      if (!reply) {
        reply = buildGreeting(user, clinic, proactiveData?.alerts || [])
        if (proactiveData?.alerts?.length) {
          const alertLines = proactiveData.alerts.slice(0, 3).map((a: any) => `• ${a.text || a.message}`).filter(Boolean).join('\n')
          if (alertLines) reply = `${reply}\n\nСейчас важно:\n${alertLines}`
        }
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
        data_complete: !!(usedLiveFallback || proactiveData?.alerts?.length || chatRes?.reply),
        jarvis: true,
        live_fallback: usedLiveFallback,
      })
      setSuggestionsFromStrings(
        (suggestions.length ? suggestions : getSmartSuggestions({ user, pathname: location.pathname, focusType: 'workspace' })).slice(0, 4)
      )
      if (proactiveData?.alerts?.length) {
        setProactiveAlerts(mapProactiveAlerts(proactiveData.alerts))
      }
      if (twinData?.twin) {
        setContextFocus('workspace', null, { digitalTwin: twinData.twin })
      }
      historyRef.current = [{ role: 'assistant', content: reply }]
    } catch {
      if (!stillCurrent()) return
      let fallback = isGuest ? buildGuestGreeting() : ''
      let catchSuggestions = getSmartSuggestions({ user, guest: isGuest, pathname: location.pathname }).slice(0, 4)
      if (!fallback && !isGuest) {
        const live = await buildLiveClinicGreeting({ user, clinic }).catch(() => null)
        if (live?.reply) {
          fallback = live.reply
          catchSuggestions = live.suggestions.slice(0, 3)
        } else {
          fallback = buildGreeting(user, clinic, [])
        }
      }
      if (!fallback) fallback = buildGuestGreeting()
      setMessages([{ id: 'greeting', role: 'assistant', content: fallback, timestamp: new Date() }])
      historyRef.current = [{ role: 'assistant', content: fallback }]
      setSuggestionsFromStrings(catchSuggestions)
      trackProductEvent('ai_greeting_rendered', {
        role: user?.role || 'guest',
        latency_ms: Date.now() - started,
        data_complete: false,
      })
    }
  }

const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return

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
      // Platform jobs search — works without paid AI (starter has features.ai=false).
      const jobsRes = await answerJobsSearchQuery(text).catch(() => null)
      const res = jobsRes || await aiChatStream(text, historyRef.current.slice(-20), (partial, done) => {
        // Create the assistant bubble only when the first non-empty token arrives —
        // otherwise the UI shows an empty grey bubble + thumbs/copy while thinking.
        if (!partial?.trim() && !done) return
        upsertAssistant({
          content: partial,
        })
        if (!done) setAIStatus('thinking')
      }, {
        userId: user?.id,
        clinicId,
        pathname: location.pathname,
        focusType: contextFocus.focusType,
        focusId: contextFocus.focusId,
      })

      if (jobsRes?.reply) {
        upsertAssistant({
          content: jobsRes.reply,
          skill: jobsRes.skill,
          source: jobsRes.source,
          actions: jobsRes.actions?.map((a: any) => ({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: a.type || a.action,
            label: a.label,
            confidence: a.confidence || 1,
            params: a.params || {},
            requiresConfirmation: false,
          })),
          data: jobsRes.data,
        })
        setSuggestionsFromStrings((jobsRes.suggestions || []).slice(0, 3))
        historyRef.current.push({ role: 'assistant', content: jobsRes.reply })
        setAIStatus('idle')
        setProgress(100)
        // Auto-offer navigation chip; user can click OpenJobs
        return
      }

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
          messageId: res.messageId,
          learnedHint: res.learnedHint,
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

      if (res.sessionId && user?.id) {
        try { localStorage.setItem(aiSessionStorageKey(user.id, clinicId), res.sessionId) } catch { /* ignore */ }
      }

      if (res.activePersonaLabel) {
        setActivePersonaLabel(res.activePersonaLabel)
      }

      const nextSuggestions = (res.suggestions || []).slice(0, 4)
      const crmChip = /расписан|долг|выручк|касс|что важно/i
      setSuggestionsFromStrings(
        isGuest
          ? (nextSuggestions.filter((s: string) => !crmChip.test(s)).length
              ? nextSuggestions.filter((s: string) => !crmChip.test(s))
              : getSmartSuggestions({ guest: true, pathname: location.pathname })).slice(0, 4)
          : nextSuggestions,
      )
      if (isGuest && typeof (res as any).aiRequestsLeft === 'number') {
        setAiRequestsLeft((res as any).aiRequestsLeft)
      }
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
            else if (AI_NAV_ACTIONS[aiAction.type]) {
              navigate(AI_NAV_ACTIONS[aiAction.type])
              onNavigate?.(AI_NAV_ACTIONS[aiAction.type])
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
    } catch (e: any) {
      const msg = String(e?.message || '')
      const isPlan =
        /тариф|подписк|AI|лимит|PLAN_|402|feature/i.test(msg) ||
        e?.status === 402 ||
        e?.code === 'PLAN_FEATURE' ||
        e?.code === 'PLAN_AI_QUOTA'
      upsertAssistant({
        content: isPlan
          ? (msg || 'AI недоступен на текущем тарифе. Обновите план в «Тариф и оплата» — или спросите про вакансии/маркет без AI.')
          : (msg && msg !== 'Failed to fetch'
            ? msg
            : 'Извините, произошла ошибка. Попробуйте ещё раз.'),
      })
      setAIStatus('idle')
    } finally {
      setProgress(0)
    }
  }, [isProcessing, onNavigate, addMessage, setAIStatus, setSuggestionsFromStrings, setCurrentIntent, setCurrentAction, setContextFocus, addProactiveAlert, setProgress, setErrorMessage, executeAction, navigate, voiceReplies, isGuest, setAiRequestsLeft, location.pathname, contextFocus.focusType, contextFocus.focusId, user?.id, clinicId])

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
      } else if (AI_NAV_ACTIONS[action.type]) {
        navigate(AI_NAV_ACTIONS[action.type])
      }
    } catch (e: any) {
      setAIStatus('error')
      setErrorMessage(e?.message || 'Ошибка выполнения')
      setTimeout(() => setAIStatus('idle'), 3000)
    }
  }, [pendingConfirm, executeAction, navigate, onNavigate, setAIStatus, setProgress, setErrorMessage, setCurrentAction, addMessage])

  const showEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 border-b border-white/[0.04] bg-surface-0/50 backdrop-blur-xl flex-shrink-0 sticky top-0 z-10"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/25 to-dv-gold/5 border border-dv-gold/20 shadow-[0_0_24px_rgba(201,169,110,0.12)] shrink-0">
            <Bot size={18} className="text-dv-gold" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-[14px] sm:text-[15px] font-semibold text-txt-primary tracking-tight truncate">DentVision Intelligence</h1>
            <p className="dv-ai-header-meta text-[11px] text-txt-muted truncate">
              {status === 'idle' ? (
                activePersonaLabel
                  ? <>Сейчас: <span className="text-dv-gold/90">{activePersonaLabel}</span></>
                  : 'AI Operating System · стоматология'
              ) :
               status === 'thinking' ? 'AI анализирует...' :
               status === 'executing' ? 'Выполняю...' :
               status === 'confirmation' ? 'Ожидаю подтверждение' :
               status === 'result' ? 'Готово' : 'Ошибка'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activePersonaLabel && !isGuest && (
            <span
              className="hidden sm:inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold text-dv-gold bg-dv-gold/10 border border-dv-gold/20"
              title="Активная операционная персона Jarvis (§16)"
            >
              {activePersonaLabel}
            </span>
          )}
          {isGuest && (
            <span
              className={
                aiRequestsLeft <= 3
                  ? 'hidden sm:inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20'
                  : 'hidden sm:inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold text-txt-muted bg-white/[0.04] border border-white/[0.06]'
              }
              title="Осталось бесплатных AI-запросов в гостевом режиме"
            >
              AI {aiRequestsLeft}
            </span>
          )}
          {unacknowledgedCount > 0 && (
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
          {showEmpty && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              className="relative flex flex-col items-center justify-center py-10 sm:py-16 md:py-20 text-center overflow-hidden dv-ai-empty"
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
                className="dv-ai-empty-icon relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-dv-gold/25 via-dv-gold/10 to-transparent border border-dv-gold/20 mb-6 shadow-[0_0_48px_rgba(201,169,110,0.18)]"
              >
                <Bot size={30} className="text-dv-gold" />
              </motion.div>
              <h2 className="relative font-serif text-xl sm:text-2xl md:text-[1.75rem] font-semibold tracking-tight text-txt-primary mb-2">
                DentVision Intelligence
              </h2>
              <p className="relative text-sm text-txt-muted max-w-sm leading-relaxed px-2">
                {isGuest
                  ? 'Jarvis покажет платформу: демо-клинику, маркетплейс, Academy и сеть. Спросите «что умеешь» или выберите действие ниже.'
                  : 'AI-операционка клиники. Спросите о расписании, выручке или долгах — или выберите действие ниже.'}
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                msg={msg as any}
                onAction={(q) => { void handleSend(q) }}
                onFeedback={(rating, m) => {
                  if (isGuest) return
                  const idx = messages.findIndex((x) => x.id === m.id)
                  const prevUser = [...messages].slice(0, idx).reverse().find((x) => x.role === 'user')
                  void aiFeedback({
                    rating,
                    messageId: m.messageId,
                    sessionId: getAiSessionId(user?.id, clinicId),
                    assistantText: m.content,
                    userText: prevUser?.content,
                    intent: m.skill,
                  }).then((res) => {
                    useAIWorkspaceStore.setState((state) => ({
                      ai: {
                        ...state.ai,
                        messages: state.ai.messages.map((row) =>
                          row.id === m.id
                            ? { ...row, feedback: rating, messageId: res?.messageId || row.messageId }
                            : row,
                        ),
                      },
                    }))
                  }).catch(() => undefined)
                }}
                onExecuteAction={(a) => {
                  const type = a.type || a.action || ''
                  const pathFromParams =
                    (a.params && typeof a.params === 'object' && 'path' in a.params
                      ? String((a.params as { path?: string }).path || '')
                      : '') || ''
                  const path = AI_NAV_ACTIONS[type] || (type === 'NAVIGATE' ? pathFromParams : '')
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
          alerts={(proactiveAlerts as any).filter((a: any) => !a.acknowledged && !a.resolved)}
          onAcknowledge={acknowledgeAlert}
          onResolve={resolveAlert}
          maxVisible={3}
        />
      )}

      <div className="flex-shrink-0 border-t border-white/[0.04] bg-surface-0/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto">
          {suggestions.length > 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 md:px-6 pt-4 pb-1"
            >
              <SuggestionChips
                suggestions={suggestions.map(s => s.label)}
                onSelect={(label) => {
                  const lower = String(label || '').toLowerCase()
                  if (/демо/.test(lower)) {
                    navigate('/crm/schedule?demo=1')
                    onNavigate?.('/crm/schedule?demo=1')
                    return
                  }
                  if (/academy|школ/.test(lower)) {
                    navigate('/school')
                    onNavigate?.('/school')
                    return
                  }
                  if (/маркет|магазин|закуп/.test(lower)) {
                    navigate('/shop')
                    onNavigate?.('/shop')
                    return
                  }
                  void handleSend(label)
                }}
                disabled={isProcessing}
              />
            </motion.div>
          )}
          <AIInputArea
            onSend={handleSend}
            disabled={isProcessing}
            status={status === 'confirmation' ? 'result' : status}
            progress={progress}
            suggestions={suggestions.map(s => s.label)}
            placeholder={isGuest
              ? 'Спросите о DentVision, демо, Academy или маркетплейсе…'
              : 'Спросите: что важно сегодня, покажи выручку, проверь долги…'}            voiceResumeToken={voiceReplies ? voiceResumeToken : 0}
          />
        </div>
      </div>

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
            className="fixed right-0 top-0 z-50 h-full w-[min(20rem,100vw)] md:w-96 bg-surface-1 border-l border-bdr-subtle flex flex-col"
            style={{ paddingTop: 'var(--dv-safe-top)', paddingBottom: 'var(--dv-safe-bottom)' }}
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

function looksLikeGuestThread(messages: Array<{ role?: string; content?: string }>): boolean {
  return messages.some((m) =>
    m.role === 'assistant' &&
    /гостев(ом|ой)\s+режим|гид по платформе|Данные клиники \(расписание/i.test(String(m.content || '')),
  )
}

function persistThread(userId: string | undefined, clinicId: string | null | undefined, messages: Message[]) {
  try {
    const key = aiThreadStorageKey(userId, clinicId)
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

function restoreThread(userId: string | undefined, clinicId: string | null | undefined): Message[] | null {
  try {
    const key = aiThreadStorageKey(userId, clinicId)
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

export type { AIWorkspaceIndexProps }
