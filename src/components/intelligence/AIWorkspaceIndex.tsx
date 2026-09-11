import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, MessageCircle, Plus, Sparkles, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'
import { AIInputArea } from './AIInputArea'
import { ChatMessage, type ChatMsg } from './ChatMessage'
import { ContextPanel } from './ContextPanel'

const STARTER_PROMPTS = [
  'Что мне нужно сделать сегодня?',
  'Покажи пациентов, которым нужен контроль',
  'Составь план лечения для пациента',
  'Помоги найти материал для реставрации',
]

export function AIWorkspaceIndex({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const navigate = useNavigate()
  const { clinic, isAuthenticated } = useAuth()
  const [showContext, setShowContext] = useState(false)
  const messages = useAIStore(s => s.messages)
  const suggestions = useAIStore(s => s.suggestions)
  const status = useAIStore(s => s.status)
  const progress = useAIStore(s => s.progress)
  const executePrompt = useAIStore(s => s.executePrompt)
  const loadConversation = useAIStore(s => s.loadConversation)
  const loadProactiveAlerts = useAIStore(s => s.loadProactiveAlerts)
  const clearConversation = useAIStore(s => s.clearConversation)
  const errorMessage = useAIStore(s => s.errorMessage)

  useEffect(() => {
    if (!isAuthenticated) return
    void loadConversation()
    void loadProactiveAlerts()
  }, [isAuthenticated, loadConversation, loadProactiveAlerts])

  const displayMessages = useMemo<ChatMsg[]>(() => messages.map(m => ({
    ...m,
    timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp),
    source: m.source as ChatMsg['source'],
  })), [messages])

  const send = (text: string) => void executePrompt(text)
  const go = (path: string) => { onNavigate?.(path); navigate(path) }
  const statusLabel = status === 'thinking' ? 'Думаю…' : status === 'executing' ? 'Выполняю…' : status === 'error' ? 'Ошибка' : 'Готов'

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles size={17} /></div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Цифровой ассистент</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn('h-1.5 w-1.5 rounded-full', status === 'error' ? 'bg-destructive' : 'bg-emerald-500')} />{statusLabel}{clinic?.name ? ` · ${clinic.name}` : ''}</div>
            </div>
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
              <div className="mb-8"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card shadow-sm"><Stethoscope size={20} className="text-primary" /></div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Чем помочь?</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Один диалог для клиники, пациентов, диагностики, материалов и рабочих задач.</p></div>
              <div className="grid gap-2 sm:grid-cols-2">{STARTER_PROMPTS.map(prompt => <button key={prompt} onClick={() => send(prompt)} className="group rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary/30 hover:bg-muted/40"><span className="block pr-5 text-foreground">{prompt}</span><span className="mt-1 block text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">Спросить AI →</span></button>)}</div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
              <div className="space-y-5">{displayMessages.map(message => <ChatMessage key={message.id} message={message} onAction={(action, params) => { const path = typeof params?.path === 'string' ? params.path : action; if (path?.startsWith('/')) go(path) }} />)}</div>
              {errorMessage && <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{errorMessage}</div>}
              {suggestions.length > 0 && status === 'idle' && <div className="mt-5 flex flex-wrap gap-2">{suggestions.slice(0, 4).map(s => <button key={s.id} onClick={() => send(s.label)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">{s.label}</button>)}</div>}
            </div>
          )}
        </section>

        <div className="shrink-0 border-t border-border/50 bg-background/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:px-6"><div className="mx-auto w-full max-w-3xl"><AIInputArea onSend={send} disabled={status === 'thinking' || status === 'executing'} status={status === 'confirmation' ? 'executing' : status} progress={progress} placeholder="Спросите ассистента…" /><div className="mt-2 text-center text-[10px] text-muted-foreground">AI может ошибаться. Проверяйте клинические решения и данные пациента.</div></div></div>
      </main>

      {showContext && <aside className="absolute inset-y-0 right-0 z-20 w-[min(380px,92vw)] border-l border-border bg-background shadow-2xl md:relative md:w-[360px] md:shadow-none"><div className="flex h-14 items-center justify-between border-b border-border/60 px-4"><div className="text-sm font-semibold">Контекст</div><button onClick={() => setShowContext(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><ChevronDown size={16} className="rotate-90" /></button></div><div className="h-[calc(100%-56px)] overflow-y-auto"><ContextPanel context={null as any} activeWorkspace="clinic" onClose={() => setShowContext(false)} /></div></aside>}
    </div>
  )
}

export default AIWorkspaceIndex
