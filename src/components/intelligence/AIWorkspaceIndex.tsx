import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Bot, CheckCircle, X, AlertTriangle, Loader2, Mic, ArrowUp, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth.store'
import { aiChat, aiProactive, aiDigitalTwin } from '@/utils/api'
import { AIInputArea } from './AIInputArea'
import { ChatMessage } from './ChatMessage'
import { SuggestionChips } from './SuggestionChips'
import { AIStatus } from '@/components/ai/AIStatus'
import { useAIWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor, AIAction } from '@/utils/aiExecutor'
import { ProactiveAlertsDisplay } from '@/components/ai/ProactiveAlertsDisplay'
import { ContextPanel } from '@/components/intelligence/ContextPanel'
import { useNavigate } from 'react-router-dom'

import type { Message, Action } from '@/store/workspace.store'

interface AIWorkspaceIndexProps {
  onNavigate?: (path: string) => void
}

export function AIWorkspaceIndex({ onNavigate }: AIWorkspaceIndexProps) {
  const navigate = useNavigate()
  const { user, clinic } = useAuth()
  const initialized = useRef(false)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showContextPanel, setShowContextPanel] = useState(false)

  const messages = useAIWorkspaceStore((s) => s.ai.messages)
  const status = useAIWorkspaceStore((s) => s.ai.status)
  const suggestions = useAIWorkspaceStore((s) => s.ai.suggestions)
  const proactiveAlerts = useAIWorkspaceStore((s) => s.ai.proactiveAlerts)
  const progress = useAIWorkspaceStore((s) => s.ai.progress)
  const currentAction = useAIWorkspaceStore((s) => s.ai.currentAction)

  const setAIStatus = useAIWorkspaceStore((s) => s.setAIStatus)
  const addMessage = useAIWorkspaceStore((s) => s.addMessage)
  const setMessages = useAIWorkspaceStore((s) => s.setMessages)
  const setSuggestionsFromStrings = useAIWorkspaceStore((s) => s.setSuggestionsFromStrings)
  const addProactiveAlert = useAIWorkspaceStore((s) => s.addProactiveAlert)
  const setProactiveAlerts = useAIWorkspaceStore((s) => s.setProactiveAlerts)
  const setCurrentIntent = useAIWorkspaceStore((s) => s.setCurrentIntent)
  const setCurrentAction = useAIWorkspaceStore((s) => s.setCurrentAction)
  const contextFocus = useAIWorkspaceStore((s) => s.ai.contextFocus)
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
      initializeWorkspace()
    }
  }, [user, clinic])

  useEffect(() => {
    if (status === 'idle' || status === 'result' || status === 'confirmation') {
      setSuggestionsFromStrings(getDefaultSuggestions(user, clinic))
    }
  }, [contextFocus, user])

  const initializeWorkspace = async () => {
    try {
      const [chatRes, proactiveData, twinData] = await Promise.all([
        aiChat('Приветствие', []).catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
        aiDigitalTwin().catch(() => ({ twin: null })),
      ])

      let reply = chatRes?.reply || buildGreeting(user, clinic)

      if (proactiveData?.alerts?.length && !chatRes?.reply) {
        const alertLines = proactiveData.alerts.slice(0, 4).map((a: any) => `• ${a.text}`).join('\n')
        reply = buildGreeting(user, clinic) + '\n\nАктуальное:\n' + alertLines
      }

      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        skill: chatRes?.skill || 'practice',
      }])
      setSuggestionsFromStrings(chatRes?.suggestions || getDefaultSuggestions(user, clinic))
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
      const fallback = buildGreeting(user, clinic)
      setMessages([{ id: 'greeting', role: 'assistant', content: fallback, timestamp: new Date() }])
      setSuggestionsFromStrings(getDefaultSuggestions(user, clinic))
    }
  }

  const buildGreeting = (u: any, c: any) => {
    const h = new Date().getHours()
    const greeting = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
    const name = u?.name?.split(' ')[0] || u?.login || 'Пользователь'
    const spec = u?.spec || 'доктор'
    const clinicName = c?.name || ''
    const lines = [
      `${greeting}, ${spec} ${name}.`,
      clinicName ? `Клиника: ${clinicName}.` : '',
      '',
      'DentVision Intelligence к вашим услугам.',
      'Чем могу помочь?',
    ].filter(Boolean)
    return lines.join('\n')
  }

  const getDefaultSuggestions = (u: any, c: any) => {
    const role = (u?.role || '').toLowerCase()
    if (contextFocus?.type === 'patient') {
      return [
        'История лечения',
        'План лечения',
        'Показать КТ',
        'Фото пациента',
        'Создать счет',
        'Назначить прием',
        'Лаборатория',
        'Отправить напоминание',
      ]
    }
    if (role === 'doctor') {
      return ['Показать расписание', 'Открыть карточку пациента', 'Заполнить прием', 'Создать план лечения', 'Открыть рентген', 'Назначить повторный прием']
    }
    if (role === 'lab' || role === 'laboratory') {
      return ['Показать новые работы', 'Изменить статус', 'Загрузить фотографии', 'Отметить готовность', 'Лабораторные работы']
    }
    if (role === 'manager' || role === 'руководитель') {
      return ['Показать прибыль', 'Заполненность кресел', 'Средний чек', 'Задолженности', 'Доходы врачей', 'Открыть аналитику']
    }
    if (role === 'admin' || role === 'администратор') {
      return ['Записать пациента', 'Показать расписание', 'Создать счет', 'Принять оплату', 'Управлять расписанием', 'Показать задолженности']
    }
    return ['Записать пациента', 'Найти пациента', 'Показать КТ', 'Составить план лечения', 'Купить материал', 'Найти курс']
  }

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return

    addMessage({ id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date() })
    setAIStatus('thinking')
    setSuggestionsFromStrings([])
    setCurrentIntent(null)
    setCurrentAction(null)
    historyRef.current.push({ role: 'user', content: text })

    try {
      const res = await aiChat(text, historyRef.current.slice(-20))

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

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
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

      addMessage(aiMsg)
      setSuggestionsFromStrings(res.suggestions || [])
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
          type: action.type || action.action,
          label: action.label,
          confidence: action.confidence || 1,
          params: action.params || {},
          requiresConfirmation: action.requiresConfirmation,
        }
        setCurrentAction(aiAction)

        if (action.confidence > 0.85 && !action.requiresConfirmation) {
          setAIStatus('executing')
          setProgress(0)
          try {
            const result = await aiAction(action.type || action.action, { ...action.params })
            setProgress(100)
            setAIStatus('result')
            setTimeout(() => setAIStatus('idle'), 2000)
            if (result?.message) {
              addMessage({
                id: `action-${Date.now()}`,
                role: 'assistant',
                content: result.message,
                timestamp: new Date(),
              })
            }
            if (onNavigate && NAV_ACTIONS[action.type || action.action]) {
              onNavigate(NAV_ACTIONS[action.type || action.action])
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
        } else if (action.confidence > 0.6) {
          setAIStatus('confirmation')
        }
      }
    } catch {
      addMessage({
        id: `err-${Date.now()}`, role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
        timestamp: new Date(),
      })
    } finally {
      if (status !== 'confirmation') {
        setAIStatus('idle')
      }
      setProgress(0)
    }
  }, [isProcessing, onNavigate, addMessage, setAIStatus, setSuggestionsFromStrings, setCurrentIntent, setCurrentAction, setContextFocus, addProactiveAlert, setProgress, setErrorMessage, setCurrentAction])

  const handleActionConfirm = useCallback(async (action: AIAction) => {
    const confirmed = window.confirm(`Выполнить: ${action.label}?`)
    if (!confirmed) return

    setAIStatus('executing')
    setProgress(0)
    try {
      const result = await executeAction(action, {
        onNavigate: (path) => { navigate(path); onNavigate?.(path) },
        addMessage,
      })
      setProgress(100)
      setAIStatus('result')
      setTimeout(() => setAIStatus('idle'), 2000)
      setCurrentAction(null)
      if (result?.type === 'navigate' && result.path) {
        navigate(result.path)
      }
    } catch (e: any) {
      setAIStatus('error')
      setErrorMessage(e?.message || 'Ошибка выполнения')
      setTimeout(() => setAIStatus('idle'), 3000)
    }
  }, [executeAction, navigate, onNavigate, setAIStatus, setProgress, setErrorMessage, setCurrentAction, addMessage])

  const showEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
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
              {status === 'idle' ? 'Цифровой ассистент' :
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

      {/* Chat Area */}
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
              <ChatMessage key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>

          {isProcessing && status !== 'confirmation' && (
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

      {/* Proactive Alerts - Inline when active */}
      {unacknowledgedCount > 0 && (
        <ProactiveAlertsDisplay
          alerts={proactiveAlerts}
          onAcknowledge={acknowledgeAlert}
          onResolve={resolveAlert}
        />
      )}

      {/* Bottom: Suggestions + Input */}
      <div className="flex-shrink-0 border-t border-white/[0.04] bg-surface-0/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto">
          {suggestions.length > 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
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
            placeholder="Чем помочь?"
          />
        </div>
      </div>

      {/* Context Panel - Right Side */}
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
              <ContextPanel />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Backdrop for context panel */}
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

const NAV_ACTIONS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OpenCashier: '/crm/cashier',
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
}

export type { AIWorkspaceIndexProps }