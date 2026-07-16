import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, Bot, Zap, Brain, ChevronRight, Check, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { aiChat, aiAction, aiProactive } from '@/utils/api'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Button } from '@/components/ui/ds/Button'
import { TypingText, RingSpinner, CursorBlink } from '@/components/ui/motion'
import { AIInputArea } from './AIInputArea'
import { ChatMessage } from './ChatMessage'
import { SuggestionChips } from './SuggestionChips'

interface AIWorkspaceIndexProps {
  onNavigate?: (path: string) => void
}

export function AIWorkspaceIndex({ onNavigate }: AIWorkspaceIndexProps) {
  const { user, clinic } = useAuth()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([])
  const [inputStatus, setInputStatus] = useState<'idle' | 'thinking' | 'executing' | 'result' | 'error'>('idle')
  const [inputProgress, setInputProgress] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing])

  useEffect(() => {
    if (initialized) return
    setInitialized(true)
    initializeWorkspace()
  }, [initialized, user, clinic])

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
      setSuggestions(chatRes?.suggestions || getDefaultSuggestions(user, clinic))
      setProactiveAlerts(proactiveData?.alerts || [])

      historyRef.current = [{ role: 'assistant', content: reply }]
    } catch {
      const fallback = buildGreeting(user, clinic)
      setMessages([{ id: 'greeting', role: 'assistant', content: fallback, timestamp: new Date() }])
      setSuggestions(getDefaultSuggestions(user, clinic))
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
    const base = ['Показать расписание', 'Найти пациента', 'Неподтверждённые записи']
    const role = u?.role
    const map: Record<string, string[]> = {
      owner: [...base, 'Аналитика за сегодня', 'Неоплаченные счета'],
      doctor: [...base, 'Мои пациенты на сегодня', 'Открыть медкарту'],
      admin: [...base, 'Новая запись', 'Создать счёт'],
      assistant: [...base, 'Новая запись', 'Подтвердить запись'],
      reception: [...base, 'Новая запись', 'Подтвердить запись'],
      laboratory: ['Активные заказы', 'Готовые работы', 'Изменить статус'],
      cashier: ['Приходы сегодня', 'Неоплаченные счета', 'Касса'],
      accountant: ['Отчёт за день', 'Расходы', 'Финансовая сводка'],
      manager: ['Загрузка врачей', 'Аналитика', 'Пациенты'],
      intern: ['Моё обучение', 'Курсы', 'Расписание'],
      superadmin: ['Платформа', 'Аналитика', 'Все клиники'],
    }
    return map[role] || base
  }

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return

    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date() }])
    setInput('')
    setIsProcessing(true)
    setInputStatus('thinking')
    setSuggestions([])
    historyRef.current.push({ role: 'user', content: text })

    try {
      const res = await aiChat(text, historyRef.current.slice(-20))

      if (res.conversationContext?.entities) {
        // Update context if needed
      }

      const aiMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
        skill: res.skill,
        source: res.source as ChatMsg['source'],
        actions: res.actions?.map(a => ({
          action: a.action || a.type,
          label: a.label,
          confidence: a.confidence || 1,
          params: a.params || {},
        })),
        data: res.data,
        recommendations: res.recommendations,
      }

      setMessages(prev => [...prev, aiMsg])
      setSuggestions(res.suggestions || [])
      historyRef.current.push({ role: 'assistant', content: res.reply })

      if (res.proactive?.length) {
        setProactiveAlerts(prev => {
          const existing = new Set(prev.map(p => p.text))
          const newAlerts = res.proactive.filter((p: any) => !existing.has(p.text))
          return [...prev, ...newAlerts].sort((a, b) => b.priority - a.priority).slice(0, 8)
        })
      }

      // Handle auto-execution of high-confidence actions
      if (res.actions?.length) {
        const action = res.actions[0]
        if (action.confidence > 0.85 && !action.requiresConfirmation) {
          setInputStatus('executing')
          setInputProgress(0)
          try {
            const result = await aiAction(action.type || action.action, { ...action.params })
            setInputProgress(100)
            setInputStatus('result')
            setTimeout(() => setInputStatus('idle'), 2000)
            if (result?.message) {
              setMessages(prev => [...prev, {
                id: `action-${Date.now()}`,
                role: 'assistant',
                content: result.message,
                timestamp: new Date(),
              }])
            }
            if (onNavigate && NAV_ACTIONS[action.type || action.action]) {
              onNavigate(NAV_ACTIONS[action.type || action.action])
            }
          } catch (e: any) {
            setInputStatus('error')
            setTimeout(() => setInputStatus('idle'), 3000)
            setMessages(prev => [...prev, {
              id: `action-err-${Date.now()}`,
              role: 'assistant',
              content: `Ошибка: ${e?.message || 'неизвестная ошибка'}`,
              timestamp: new Date(),
            }])
          }
        } else if (action.confidence > 0.6) {
          // Show confirmation for lower confidence
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
        timestamp: new Date(),
      }])
    } finally {
      setIsProcessing(false)
      setInputStatus('idle')
      setInputProgress(0)
    }
  }, [isProcessing, onNavigate])

  return (
    <div className="flex flex-col h-full">
      {/* AI Status Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-bdr-subtle bg-surface-1/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dv-gold/10">
            <Bot size={18} className="text-dv-gold" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-txt-primary">DentVision Intelligence</h1>
            <p className="text-xs text-txt-muted">Цифровой ассистент</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {proactiveAlerts.length > 0 && (
            <Button variant="ghost" size="sm" className="relative">
              <span className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all">
                <Sparkles size={14} />
                <span className="text-xs font-medium hidden sm:inline">{proactiveAlerts.length}</span>
              </span>
            </Button>
          )}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/10 border border-dv-gold/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] font-medium text-dv-gold">AI активен</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>
        {isProcessing && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions + Input */}
      <div className="flex-shrink-0 border-t border-bdr-subtle bg-surface-1/50 backdrop-blur-sm">
        {suggestions.length > 0 && !isProcessing && (
          <div className="px-4 md:px-6 pt-3 pb-2">
            <SuggestionChips suggestions={suggestions} onSelect={handleSend} disabled={isProcessing} />
          </div>
        )}
        <AIInputArea
          onSend={handleSend}
          disabled={isProcessing}
          status={inputStatus}
          progress={inputProgress}
          suggestions={suggestions}
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

function AnimatePresence({ children, mode }: { children: React.ReactNode; mode?: 'wait' | 'sync' | 'popLayout' }) {
  return <>{children}</>
}

function Sparkles({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export { AIWorkspaceIndex }
export type { AIWorkspaceIndexProps }

interface ChatMsg {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  skill?: string
  source?: 'crm' | 'shop' | 'school' | 'knowledge' | 'external' | 'market'
  actions?: Array<{ action: string; label: string; confidence: number; params?: Record<string, unknown> }>
  data?: Record<string, unknown>
  recommendations?: Array<Record<string, unknown>>
}