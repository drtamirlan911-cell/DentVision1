import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Loader2, MessageCircle, Search, Send,
} from 'lucide-react'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { useAuth } from '@/store/auth.store'
import {
  getDmInbox, getDmMessages, openDm, searchCommunityPeople, sendDmMessage,
} from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'
import { cn } from '@/lib/utils'

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'сейчас'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч`
  return `${Math.floor(h / 24)} дн`
}

interface MessagesPanelProps {
  initialPeerId?: string | null
  onConsumedPeer?: () => void
}

export function MessagesPanel({ initialPeerId, onConsumedPeer }: MessagesPanelProps) {
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [inbox, setInbox] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [peer, setPeer] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [peopleQ, setPeopleQ] = useState('')
  const [people, setPeople] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadInbox = useCallback(async () => {
    if (!isAuthenticated) {
      setInbox([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await getDmInbox()
      setInbox(Array.isArray(list) ? list : [])
    } catch {
      setInbox([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { void loadInbox() }, [loadInbox])

  const openThread = async (conversationId: string) => {
    setActiveId(conversationId)
    try {
      const data = await getDmMessages(conversationId)
      setMessages(data?.messages || [])
      setPeer(data?.peer || null)
      setInbox((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread: false } : c)))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e: any) {
      showToast(e?.message || 'Не удалось открыть чат', 'error')
    }
  }

  const startWithUser = async (userId: string) => {
    try {
      const conv = await openDm(userId)
      setComposerOpen(false)
      setPeopleQ('')
      setPeople([])
      await loadInbox()
      await openThread(conv.id)
      onConsumedPeer?.()
    } catch (e: any) {
      showToast(e?.message || 'Не удалось начать диалог', 'error')
    }
  }

  useEffect(() => {
    if (initialPeerId) void startWithUser(initialPeerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPeerId])

  useEffect(() => {
    if (!composerOpen || peopleQ.trim().length < 1) {
      setPeople([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const list = await searchCommunityPeople(peopleQ.trim())
        setPeople(Array.isArray(list) ? list : [])
      } catch {
        setPeople([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [peopleQ, composerOpen])

  const send = async () => {
    if (!activeId || !draft.trim()) return
    setSending(true)
    try {
      const msg = await sendDmMessage(activeId, draft.trim())
      setMessages((prev) => [...prev, msg])
      setDraft('')
      setInbox((prev) => {
        const next = prev.map((c) =>
          c.id === activeId
            ? { ...c, lastMessage: msg, updatedAt: msg.createdAt, unread: false }
            : c,
        )
        return next.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
    } catch (e: any) {
      showToast(e?.message || 'Не отправлено', 'error')
    } finally {
      setSending(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Войдите для сообщений"
        description="Личные сообщения — как в Telegram: только между вами и коллегой."
      />
    )
  }

  // Thread view
  if (activeId) {
    return (
      <div className="flex flex-col min-h-[60vh] max-h-[70vh] rounded-xl border border-bdr-subtle bg-surface-1 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-bdr-subtle shrink-0">
          <button
            type="button"
            onClick={() => { setActiveId(null); void loadInbox() }}
            className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5"
            aria-label="Назад"
          >
            <ArrowLeft size={16} />
          </button>
          <Avatar name={peer?.name || '?'} size="sm" src={peer?.avatar} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-txt-primary truncate">{peer?.name || 'Чат'}</p>
            <p className="text-[10px] text-txt-muted truncate">{peer?.role || 'Личные сообщения'}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-xs text-txt-muted py-8">Напишите первое сообщение</p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === user?.id
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug',
                    mine
                      ? 'bg-dv-gold text-surface-0 rounded-br-md'
                      : 'bg-white/[0.06] text-txt-primary rounded-bl-md border border-bdr-subtle',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn('text-[9px] mt-1', mine ? 'text-surface-0/70' : 'text-txt-muted')}>
                    {timeAgo(m.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 p-2.5 border-t border-bdr-subtle shrink-0">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Сообщение…"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <Button size="sm" onClick={() => void send()} disabled={!draft.trim() || sending} icon={<Send size={14} />}>
            {sending ? '…' : ''}
          </Button>
        </div>
      </div>
    )
  }

  // Inbox
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-txt-secondary">Входящие</p>
        <Button size="sm" variant="secondary" icon={<MessageCircle size={14} />} onClick={() => setComposerOpen((v) => !v)}>
          Написать
        </Button>
      </div>

      {composerOpen && (
        <div className="rounded-xl border border-bdr-subtle bg-surface-1 p-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
            <Input
              value={peopleQ}
              onChange={(e) => setPeopleQ(e.target.value)}
              placeholder="Найти коллегу по имени или email…"
              className="pl-9"
              autoFocus
            />
          </div>
          {searching && <p className="text-xs text-txt-muted flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Поиск…</p>}
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void startWithUser(p.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left"
            >
              <Avatar name={p.name} size="sm" src={p.avatar} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-txt-primary truncate">{p.name}</p>
                <p className="text-[11px] text-txt-muted truncate">{p.spec || p.role || p.email}</p>
              </div>
            </button>
          ))}
          {peopleQ.trim() && !searching && people.length === 0 && (
            <p className="text-xs text-txt-muted text-center py-2">Никого не найдено</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-txt-muted"><Loader2 className="animate-spin" size={22} /></div>
      ) : inbox.length === 0 ? (
        <EmptyState
          title="Нет сообщений"
          description="Найдите коллегу и напишите — диалог появится здесь."
        />
      ) : (
        <div className="rounded-xl border border-bdr-subtle divide-y divide-bdr-subtle overflow-hidden">
          {inbox.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void openThread(c.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] text-left"
            >
              <Avatar name={c.peer?.name || '?'} size="md" src={c.peer?.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm truncate', c.unread ? 'font-bold text-txt-primary' : 'font-medium text-txt-primary')}>
                    {c.peer?.name}
                  </p>
                  <span className="text-[10px] text-txt-muted shrink-0 ml-auto">{timeAgo(c.lastMessage?.createdAt || c.updatedAt)}</span>
                </div>
                <p className={cn('text-xs truncate mt-0.5', c.unread ? 'text-txt-secondary' : 'text-txt-muted')}>
                  {c.lastMessage?.body || 'Нет сообщений'}
                </p>
              </div>
              {c.unread && <span className="w-2 h-2 rounded-full bg-dv-gold shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
