import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Bot, X, MessageSquare } from 'lucide-react'
import { useAuth } from '@/store/auth.store'
import { aiChat, aiChatStream, aiProactive, aiDigitalTwin } from '@/utils/api'
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

import type { Message, Action } from '@/store/workspace.store'

interface AIWorkspaceIndexProps {
  onNavigate?: (path: string) => void
}

export function AIWorkspaceIndex({ onNavigate }: AIWorkspaceIndexProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clinic } = useAuth()
  const initialized = useRef(false)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstMessageTracked = useRef(false)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)

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

  const { executeAction } = useAIExecutor()

  const unacknowledgedCount = proactiveAlerts.filter(a => !a.acknowledged).length
  const isProcessing = status !== 'idle' && status !== 'result' && status !== 'confirmation'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      const restored = restoreThread(user?.id)
      if (restored?.length) {
        setMessages(restored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })))
        historyRef.current = restored.map((m) => ({ role: m.role, content: m.content }))
        trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: true })
        setSuggestionsFromStrings(getDefaultSuggestions(user, 'workspace').slice(0, 3))
      } else {
        initializeWorkspace()
        trackProductEvent('chat_ready', { role: user?.role || 'guest', restored: false })
      }
    }
  }, [user, clinic])

  useEffect(() => {
    if (messages.length > 0) persistThread(user?.id, messages)
  }, [messages, user?.id])

  useEffect(() => {
    const q = (location.state as any)?.aiQuery
    if (q && typeof q === 'string') {
      handleSend(q)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

  useEffect(() => {
    if (status === 'idle' || status === 'result' || status === 'confirmation') {
      setSuggestionsFromStrings(getDefaultSuggestions(user, contextFocus.focusType).slice(0, 3))
    }
  }, [contextFocus.focusType, user])

  const initializeWorkspace = async () => {
    const started = Date.now()
    try {
      const [chatRes, proactiveData, twinData] = await Promise.all([
        aiChat('Приветствие', []).catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
        aiDigitalTwin().catch(() => ({ twin: null })),
      ])

      let reply = chatRes?.reply || buildGreeting(user, clinic, proactiveData?.alerts || [])

      if (proactiveData?.alerts?.length && !chatRes?.reply) {
        const alertLines = proactiveData.alerts.slice(0, 3).map((a: any) => `• ${a.text}`).join('\n')
        reply = `${buildGreeting(user, clinic, [])}\n\nАктуальное:\n${alertLines}`
      }

      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        skill: chatRes?.skill || 'practice',
      }])
      trackProductEvent('ai_greeting_rendered', {
        role: user?.role || 'guest',
        latency_ms: Date.now() - started,
        data_complete: !!(proactiveData?.alerts?.length || chatRes?.reply),
      })
      setSuggestionsFromStrings(
        (chatRes?.suggestions || getDefaultSuggestions(user, 'workspace')).slice(0, 3)
      )
      if (proactiveData?.alerts?.length) {
        setProactiveAlerts(proactiveData.alerts.map((a: any) => ({
          id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: a.type || 'info',
          category: a.category || 'general',
          text: a.text,
          priority: a.priority || 0,
          action: a.action,
        })))
      }
      if (twinData?.twin) {
        setContextFocus('workspace', null, { digitalTwin: twinData.twin })
      }
      historyRef.current = [{ role: 'assistant', content: reply }]
    } catch {
      const fallback = buildGreeting(user, clinic, [])
      setMessages([{ id: 'greeting', role: 'assistant', content: fallback, timestamp: new Date() }])
      setSuggestionsFromStrings(getDefaultSuggestions(user, 'workspace').slice(0, 3))
      trackProductEvent('ai_greeting_rendered', {
        role: user?.role || 'guest',
        latency_ms: Date.now() - started,
        data_complete: false,
      })
    }
  }

const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return

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
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    })

    try {
      const res = await aiChatStream(text, historyRef.current.slice(-20), (partial, done) => {
        useAIWorkspaceStore.setState((state) => ({
          ai: {
            ...state.ai,
            messages: state.ai.messages.map((m) =>
              m.id === assistantId ? { ...m, content: partial } : m
            ),
            status: done ? state.ai.status : 'thinking',
          },
        }))
      })

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

      useAIWorkspaceStore.setState((state) => ({
        ai: {
          ...state.ai,
          messages: state.ai.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: res.reply || m.content,
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
                }
              : m
          ),
        },
      }))

      setSuggestionsFromStrings((res.suggestions || []).slice(0, 4))
      historyRef.current.push({ role: 'assistant', content: res.reply })

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
      useAIWorkspaceStore.setState((state) => ({
        ai: {
          ...state.ai,
          messages: state.ai.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Извините, произошла ошибка. Попробуйте ещё раз.' }
              : m
          ),
        },
      }))
      setAIStatus('idle')
    } finally {
      setProgress(0)
    }
  }, [isProcessing, onNavigate, addMessage, setAIStatus, setSuggestionsFromStrings, setCurrentIntent, setCurrentAction, setContextFocus, addProactiveAlert, setProgress, setErrorMessage, executeAction, navigate])

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
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/15 to-dv-gold/5 border border-dv-gold/10">
            <Bot size={18} className="text-dv-gold" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-txt-primary tracking-tight">DentVision Intelligence</h1>
            <p className="text-[11px] text-txt-muted">
              {status === 'idle' ? 'AI Operating System · стоматология' :
               status === 'thinking' ? 'AI анализирует...' :
               status === 'executing' ? 'Выполняю...' :
               status === 'confirmation' ? 'Ожидаю подтверждение' :
               status === 'result' ? 'Готово' : 'Ошибка'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-dv-gold/15 to-dv-gold/5 border border-dv-gold/10 mb-5 shadow-xl shadow-dv-gold/5"
              >
                <Bot size={28} className="text-dv-gold" />
              </motion.div>
              <h2 className="text-xl font-bold text-txt-primary mb-1">DentVision Intelligence</h2>
              <p className="text-sm text-txt-muted max-w-xs">Ваш AI-ассистент для стоматологии. Задайте вопрос или выберите действие.</p>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg as any} />
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
          {suggestions.length > 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 md:px-6 pt-4 pb-1"
            >
              <SuggestionChips
                suggestions={suggestions.map(s => s.label)}
                onSelect={handleSend}
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
            placeholder="Чем помочь? Например: открой расписание, найди пациента…"
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

function buildGreeting(u: any, c: any, alerts: any[]) {
  const h = new Date().getHours()
  const greeting = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  const name = u?.name?.split(' ')[0] || u?.login || 'коллега'
  const role = (u?.role || '').toLowerCase()
  const clinicName = c?.name || ''

  const roleLine =
    role === 'owner' || role === 'руководитель'
      ? 'Могу показать выручку, долги, загрузку и закупки.'
      : role === 'admin' || role === 'администратор'
        ? 'Могу подтвердить записи, открыть кассу и документы.'
        : role === 'buyer'
          ? 'Могу собрать закупку по складу и предложениям поставщиков.'
          : 'Могу открыть расписание, зубную карту, план лечения или курс.'

  const lines = [
    `${greeting}, ${name}.`,
    clinicName ? `Клиника: ${clinicName}.` : '',
    roleLine,
    alerts?.length ? '' : 'Чем помочь?',
  ].filter(Boolean)

  return lines.join('\n')
}

function getDefaultSuggestions(u: any, focusType: string) {
  const role = (u?.role || '').toLowerCase()
  if (focusType === 'patient') {
    return ['История лечения', 'План лечения', 'Зубная карта']
  }
  if (role === 'doctor') {
    return ['Показать расписание', 'Открыть зубную карту', 'Создать план лечения']
  }
  if (role === 'owner' || role === 'руководитель' || role === 'manager') {
    return ['Показать финансы', 'Что на складе', 'Открыть аналитику']
  }
  if (role === 'admin' || role === 'администратор') {
    return ['Записать пациента', 'Показать расписание', 'Открыть кассу']
  }
  if (role === 'buyer') {
    return ['Что купить на склад', 'Открыть маркетплейс', 'Показать заказы']
  }
  return ['Показать расписание', 'Найти пациента', 'Купить материал']
}

const NAV_ACTIONS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OpenCashier: '/crm/finance',
  OpenFinance: '/crm/finance',
  OpenLab: '/crm/lab',
  OpenShop: '/shop',
  OpenSchool: '/school',
  OpenAnalytics: '/analytics',
  OpenDocuments: '/crm/documents',
  OpenSettings: '/settings',
  OpenProfile: '/profile',
  OpenMedicalCard: '/crm/medical-card',
  OpenVisits: '/crm/visits',
  OpenInventory: '/crm/inventory',
  OpenStaff: '/crm/staff',
  OpenPatient: '/crm/patients',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenJobs: '/jobs',
  OpenCommunity: '/community',
}

export type { AIWorkspaceIndexProps }
