import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, MessageCircle, Plus, Sparkles, Stethoscope, CalendarDays, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'
import { aiBriefing } from '@/utils/api'
import { AIInputArea } from './AIInputArea'
import { ChatMessage, type ChatMsg } from './ChatMessage'
import { ContextPanel } from './ContextPanel'

const STARTER_PROMPTS = [
  'Что мне нужно сделать сегодня?',
  'Покажи пациентов, которым нужен контроль',
  'Составь план лечения для пациента',
  'Помоги найти материал для реставрации',
]

const BOOKING_PROMPTS = [
  'Найди стоматолога рядом со мной и покажи варианты записи',
  'Мне нужна запись к стоматологу. Помоги выбрать клинику и время',
  'Какие стоматологические услуги доступны для записи?',
]

export function AIWorkspaceIndex({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { clinic, isAuthenticated } = useAuth()
  const [showContext, setShowContext] = useState(false)
  const [briefing, setBriefing] = useState<string>('')
  const [briefingSuggestions, setBriefingSuggestions] = useState<string[]>([])
  const [briefingLoading, setBriefingLoading] = useState(false)
  const messages = useAIStore(s => s.messages)
  const suggestions = useAIStore(s => s.suggestions)
  const proactiveAlerts = useAIStore(s => s.proactiveAlerts)
  const status = useAIStore(s => s.status)
  const progress = useAIStore(s => s.progress)
  const executePrompt = useAIStore(s => s.executePrompt)
  const loadConversation = useAIStore(s => s.loadConversation)
  const loadProactiveAlerts = useAIStore(s => s.loadProactiveAlerts)
  const clearConversation = useAIStore(s => s.clearConversation)
  const acknowledgeAlert = useAIStore(s => s.acknowledgeAlert)
  const errorMessage = useAIStore(s => s.errorMessage)

  const bookingIntent = new URLSearchParams(location.search).get('intent') === 'booking'

  useEffect(() => {
    if (!isAuthenticated) return
    void loadConversation()
    void loadProactiveAlerts()
    let cancelled = false
    setBriefingLoading(true)
    void aiBriefing()
      .then(result => {
        if (cancelled) return
        setBriefing(result.reply || '')
        setBriefingSuggestions(Array.isArray(result.suggestions) ? result.suggestions.filter(Boolean).slice(0, 4) : [])
      })
      .catch(() => {
        if (cancelled) return
        setBriefing('')
        setBriefingSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setBriefingLoading(false)
      })
    return () => { cancelled = true }
  }, [isAuthenticated, loadConversation, loadProactiveAlerts])

  const displayMessages = useMemo<ChatMsg[]>(() => messages.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp), source: m.source as ChatMsg['source'] })), [messages])
  const send = (text: string) => void executePrompt(text)
  const go = (path: string) => { onNavigate?.(path); navigate(path) }
  const statusLabel = status === 'thinking' ? 'Думаю…' : status === 'executing' ? 'Выполняю…' : status === 'error' ? 'Ошибка' : 'Готов'
  const prompts = bookingIntent ? BOOKING_PROMPTS : STARTER_PROMPTS
  const visibleAlerts = proactiveAlerts.filter(a => !a.acknowledged && !a.resolved).slice(0, 3)

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles size={17} /></div>
            <div className="min-w-0"><div className="truncate text-sm font-semibold">DentVision AI</div><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn('h-1.5 w-1.5 rounded-full', status === 'error' ? 'bg-destructive' : 'bg-emerald-500')} />{statusLabel}{clinic?.name ? ` · ${clinic.name}` : ''}</div></div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowContext(v => !v)} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-xs text-muted-foreground hover:bg-muted md:flex"><MessageCircle size={15} /> Контекст</button>
            <button onClick={() => setShowContext(v => !v)} aria-label="Контекст" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"><MessageCircle size={16} /></button>
            <button onClick={clearConversation} aria-label="Новый диалог" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Plus size={17} /></button>
          </div>
        </header>

        <section className="relative min-h-0 flex-1 overflow-y-auto">
          {displayMessages.length === 0 ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 md:px-8">
              <div className="mb-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card shadow-sm"><Stethoscope size={20} className="text-primary" /></div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{bookingIntent ? 'Помогу организовать запись' : isAuthenticated ? 'Ваш рабочий день под контролем' : 'Чем помочь?'}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{bookingIntent ? 'Сначала подберём подходящую клинику или врача. Личные данные запросим только перед подтверждением записи.' : 'Один рабочий интеллект для клиники, пациентов, диагностики, материалов и ежедневных задач.'}</p>
              </div>

              {isAuthenticated && !bookingIntent && (briefing || briefingLoading) && (
                <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold"><CalendarDays size={15} className="text-primary" /> Сегодня</div>
                  {briefingLoading ? <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-muted" /> : <>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{briefing}</p>
                    {briefingSuggestions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">
                      {briefingSuggestions.map(action => <button key={action} onClick={() => send(action)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-muted">
                        {action}<ArrowRight size={12} className="text-primary" />
                      </button>)}
                    </div>}
                  </>}
                </div>
              )}

              {isAuthenticated && !bookingIntent && visibleAlerts.length > 0 && (
                <div className="mb-5 space-y-2">
                  <div className="flex items-center justify-between px-1"><span className="text-xs font-semibold text-foreground">Что требует внимания</span><span className="text-[10px] text-muted-foreground">AI обнаружил</span></div>
                  {visibleAlerts.map(alert => {
                    const path = alert.action?.type?.startsWith('/') ? alert.action.type : null
                    return (
                      <div key={alert.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><AlertCircle size={15} /></div>
                        <button onClick={() => path ? go(path) : send(alert.text)} className="min-w-0 flex-1 text-left"><span className="block text-sm leading-5 text-foreground">{alert.text}</span>{path && <span className="mt-0.5 flex items-center gap-1 text-[11px] text-primary">Открыть <ArrowRight size={11} /></span>}</button>
                        <button onClick={() => acknowledgeAlert(alert.id)} aria-label="Скрыть уведомление" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><CheckCircle2 size={15} /></button>
                      </div>
                    )
                  })}
                </div>
              )}

              {bookingIntent && !isAuthenticated && (
                <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Stethoscope size={16} /></div>
                    <div className="min-w-0 flex-1"><div className="text-sm font-semibold">Поиск врача начинается без анкеты</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Сначала выберем направление и клинику. Вход понадобится только перед подтверждением записи.</p><button onClick={() => go('/login?role=patient')} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Начать поиск <ArrowRight size={13} /></button></div>
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">{prompts.map(prompt => <button key={prompt} onClick={() => isAuthenticated || !bookingIntent ? send(prompt) : go('/login?role=patient')} className="group rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary/30 hover:bg-muted/40"><span className="block pr-5 text-foreground">{prompt}</span><span className="mt-1 block text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">{bookingIntent && !isAuthenticated ? 'Начать поиск →' : 'Передать AI →'}</span></button>)}</div>
              {!isAuthenticated && !bookingIntent && <div className="mt-5 flex items-start gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground"><AlertCircle size={14} className="mt-0.5 shrink-0" />Для персональных данных и действий в клинике потребуется вход.</div>}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
              <div className="space-y-5">{displayMessages.map(message => <ChatMessage key={message.id} message={message} onAction={(query: string) => { if (query.startsWith('/')) go(query) }} />)}</div>
              {errorMessage && <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{errorMessage}</div>}
              {suggestions.length > 0 && status === 'idle' && <div className="mt-5 flex flex-wrap gap-2">{suggestions.slice(0, 4).map(s => <button key={s.id} onClick={() => send(s.label)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">{s.label}</button>)}</div>}
            </div>
          )}
        </section>

        <div className="shrink-0 border-t border-border/50 bg-background/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:px-6"><div className="mx-auto w-full max-w-3xl"><AIInputArea onSend={send} disabled={status === 'thinking' || status === 'executing'} status={status === 'confirmation' ? 'executing' : status} progress={progress} placeholder={bookingIntent ? 'Например: хочу записаться на чистку зубов' : 'Спросите ассистента…'} /><div className="mt-2 text-center text-[10px] text-muted-foreground">AI помогает с навигацией и действиями. Клинические решения и данные пациента требуют проверки.</div></div></div>
      </main>
      {showContext && <aside className="absolute inset-y-0 right-0 z-20 w-[min(380px,92vw)] border-l border-border bg-background shadow-2xl md:relative md:w-[360px] md:shadow-none"><div className="flex h-14 items-center justify-between border-b border-border/60 px-4"><div className="text-sm font-semibold">Контекст</div><button onClick={() => setShowContext(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><ChevronDown size={16} className="rotate-90" /></button></div><div className="h-[calc(100%-56px)] overflow-y-auto"><ContextPanel onClose={() => setShowContext(false)} /></div></aside>}
    </div>
  )
}

export default AIWorkspaceIndex