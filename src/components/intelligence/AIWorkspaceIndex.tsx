import React, { useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { aiChat, aiAction, aiProactive } from '@/utils/api'
import { Button } from '@/components/ui/ds/Button'
import { AIInputArea } from './AIInputArea'
import { ChatMessage } from './ChatMessage'
import { SuggestionChips } from './SuggestionChips'
import { GreetingArea, AIStatus } from '@/components/ai'
import { useAIWorkspaceStore } from '@/stores/useAIWorkspaceStore'
import type { Message } from '@/stores/useAIWorkspaceStore'

interface AIWorkspaceIndexProps {
  onNavigate?: (path: string) => void
}

export function AIWorkspaceIndex({ onNavigate }: AIWorkspaceIndexProps) {
  const { user, clinic } = useAuth()
  const initialized = useRef(false)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])

  const messages = useAIWorkspaceStore((s) => s.ai.messages)
  const status = useAIWorkspaceStore((s) => s.ai.status)
  const suggestions = useAIWorkspaceStore((s) => s.ai.suggestions)
  const proactiveAlerts = useAIWorkspaceStore((s) => s.ai.proactiveAlerts)
  const progress = useAIWorkspaceStore((s) => s.ai.progress)

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

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    initializeWorkspace()
  }, [user, clinic])

  const initializeWorkspace = async () => {
    try {
      const [chatRes, proactiveData] = await Promise.all([
        aiChat('Приветствие', []).catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
      ])

      const reply = chatRes?.reply || buildGreeting(user, clinic)
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
    return `${greeting}, ${spec} ${name}.\n\nDentVision Intelligence к вашим услугам. Чем могу помочь?`
  }

  const getDefaultSuggestions = (u: any, c: any) => {
    return ['Записать пациента', 'Найти пациента', 'Показать КТ', 'Составить план лечения', 'Купить материал', 'Найти курс']
  }

  const isProcessing = status !== 'idle' && status !== 'result'

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
        setCurrentAction({
          id: `act-${Date.now()}`,
          type: action.type || action.action,
          label: action.label,
          confidence: action.confidence || 1,
          params: action.params || {},
          requiresConfirmation: action.requiresConfirmation,
        })

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
  }, [isProcessing, onNavigate])

  const getStatusLabel = () => {
    switch (status) {
      case 'thinking': return 'AI анализирует...'
      case 'executing': return 'AI выполняет...'
      case 'confirmation': return 'Требуется подтверждение'
      case 'error': return 'Ошибка'
      default: return ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-bdr-subtle bg-surface-1/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dv-gold/10">
            <Bot size={18} className="text-dv-gold" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-txt-primary">DentVision Intelligence</h1>
            <p className="text-xs text-txt-muted">{getStatusLabel() || 'Цифровой ассистент'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {proactiveAlerts.filter(a => !a.acknowledged).length > 0 && (
            <Button variant="ghost" size="sm" className="relative">
              <span className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all">
                <Sparkles size={14} />
                <span className="text-xs font-medium hidden sm:inline">{proactiveAlerts.filter(a => !a.acknowledged).length}</span>
              </span>
            </Button>
          )}
          <AIStatus />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        <GreetingArea />
        <AnimatePresence>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>
        {isProcessing && status !== 'confirmation' && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-bdr-subtle bg-surface-1/50 backdrop-blur-sm">
        {suggestions.length > 0 && !isProcessing && (
          <div className="px-4 md:px-6 pt-3 pb-2">
            <SuggestionChips
              suggestions={suggestions.map(s => s.label)}
              onSelect={handleSend}
              disabled={isProcessing}
            />
          </div>
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

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-start gap-2.5"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
        <Bot size={16} className="text-dv-gold" />
      </div>
      <div className="bg-surface-2 border border-bdr-subtle rounded-2xl px-4 py-2.5 max-w-[85%]">
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-dv-gold/60"
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export type { AIWorkspaceIndexProps }
