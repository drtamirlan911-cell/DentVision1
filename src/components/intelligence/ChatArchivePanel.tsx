import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ChevronRight, Clock3, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAiThreads, type AiThreadSummary } from '@/utils/api'

type Props = {
  open: boolean
  onClose: () => void
  activeSessionId?: string | null
  viewingSessionId?: string | null
  onSelectToday: () => void
  onSelectArchive: (thread: AiThreadSummary) => void
}

function expiresHint(days?: number) {
  if (days == null) return null
  if (days <= 0) return 'удалится сегодня'
  if (days === 1) return 'ещё 1 день'
  if (days >= 2 && days <= 4) return `ещё ${days} дня`
  return `ещё ${days} дней`
}

export function ChatArchivePanel({
  open,
  onClose,
  activeSessionId,
  viewingSessionId,
  onSelectToday,
  onSelectArchive,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<AiThreadSummary | null>(null)
  const [archives, setArchives] = useState<AiThreadSummary[]>([])
  const [retentionDays, setRetentionDays] = useState(7)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await getAiThreads()
        if (cancelled) return
        setActive(data.active)
        setArchives(data.archives || [])
        setRetentionDays(data.retentionDays || 7)
      } catch {
        if (!cancelled) {
          setActive(null)
          setArchives([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Закрыть архив"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[min(100vw,22rem)] flex-col border-l border-white/[0.06] bg-[#0B1220]/95 backdrop-blur-2xl shadow-[-24px_0_60px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/[0.04]">
              <div>
                <div className="flex items-center gap-2 text-dv-gold/90">
                  <Archive size={15} strokeWidth={1.75} />
                  <span className="text-[11px] uppercase tracking-[0.14em] font-medium">Архив</span>
                </div>
                <h2 className="mt-1.5 font-serif text-xl text-txt-primary tracking-tight">Дни чата</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-txt-muted">
                  Каждый день в полночь начинается новый диалог. Старые хранятся {retentionDays} дней.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/[0.05] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {loading ? (
                <div className="px-2 py-8 text-center text-[12px] text-txt-muted">Загрузка…</div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => { onSelectToday(); onClose() }}
                    className={cn(
                      'group w-full rounded-2xl px-3.5 py-3 text-left transition-all',
                      (!viewingSessionId || viewingSessionId === active?.sessionId || viewingSessionId === activeSessionId)
                        ? 'bg-dv-gold/[0.1] border border-dv-gold/20'
                        : 'hover:bg-white/[0.03] border border-transparent',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-medium text-txt-primary">Сегодня</p>
                        <p className="mt-0.5 text-[11px] text-txt-muted">
                          {active?.messageCount
                            ? `${active.messageCount} сообщ.`
                            : 'Новый диалог'}
                        </p>
                      </div>
                      <span className="rounded-full bg-dv-gold/15 px-2 py-0.5 text-[10px] font-medium text-dv-gold">
                        сейчас
                      </span>
                    </div>
                  </button>

                  {archives.length > 0 && (
                    <div className="px-2 pt-4 pb-1">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-txt-ghost">Прошлые дни</p>
                    </div>
                  )}

                  {archives.map((thread) => {
                    const selected = viewingSessionId === thread.sessionId
                    return (
                      <button
                        key={thread.sessionId}
                        type="button"
                        onClick={() => { onSelectArchive(thread); onClose() }}
                        className={cn(
                          'group w-full rounded-2xl px-3.5 py-3 text-left transition-all border',
                          selected
                            ? 'bg-white/[0.05] border-white/[0.1]'
                            : 'border-transparent hover:bg-white/[0.03]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-txt-primary capitalize">{thread.label}</p>
                            {thread.preview ? (
                              <p className="mt-0.5 truncate text-[11px] text-txt-muted">{thread.preview}</p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-txt-ghost">Без сообщений</p>
                            )}
                            {thread.expiresInDays != null && (
                              <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-txt-ghost">
                                <Clock3 size={10} />
                                {expiresHint(thread.expiresInDays)}
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            size={14}
                            className="mt-1 shrink-0 text-txt-ghost opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </div>
                      </button>
                    )
                  })}

                  {!loading && archives.length === 0 && (
                    <div className="px-2 py-10 text-center">
                      <p className="text-[13px] text-txt-muted">Архив пока пуст</p>
                      <p className="mt-1 text-[11px] text-txt-ghost">Завтра сегодняшний чат появится здесь</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.04] px-5 py-4">
              <p className="text-[11px] leading-relaxed text-txt-ghost">
                В полночь чат уходит в архив. Через {retentionDays} дней записи удаляются безвозвратно.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export default ChatArchivePanel
