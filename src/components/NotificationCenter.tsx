import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  ShoppingCart,
  GraduationCap,
  Stethoscope,
  Settings as SettingsIcon,
  Check,
  X,
} from 'lucide-react'
import { useNotifications } from '@/context/NotificationsContext'
import { cn, timeAgo } from '@/lib/utils'
import type { AppNotification, NotificationType } from '@/types'

const TYPE_META: Record<NotificationType, { label: string; icon: React.ReactNode; color: string }> = {
  shop: { label: 'Магазин', icon: <ShoppingCart size={16} />, color: '#3498DB' },
  school: { label: 'Академия', icon: <GraduationCap size={16} />, color: '#27AE60' },
  clinic: { label: 'Клиника', icon: <Stethoscope size={16} />, color: '#C9A96E' },
  system: { label: 'Система', icon: <SettingsIcon size={16} />, color: '#95A5A6' },
}

export default function NotificationCenter() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const list = notifications.filter((n) => (tab === 'unread' ? !n.read : true))

  const handleOpen = (n: AppNotification) => {
    if (!n.read) markRead(n.id)
    setOpen(false)
    if (n.actionUrl) navigate(n.actionUrl)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-txt-muted transition-colors hover:bg-white/5 hover:text-txt-primary"
        aria-label="Уведомления"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-bdr-subtle bg-surface-1 shadow-2xl shadow-black/40"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-bdr-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-dv-gold" />
                <h3 className="text-sm font-semibold text-txt-primary">Уведомления</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-dv-gold/20 px-2 py-0.5 text-2xs font-bold text-dv-gold">
                    {unreadCount} новых
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-txt-muted hover:text-txt-primary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-3 pt-3">
              {(['all', 'unread'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    tab === t ? 'bg-surface-2 text-dv-gold' : 'text-txt-muted hover:text-txt-secondary'
                  )}
                >
                  {t === 'all' ? 'Все' : 'Непрочитанные'}
                </button>
              ))}
              <div className="ml-auto">
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-2xs text-txt-muted hover:text-txt-primary"
                >
                  <Check size={13} /> Прочитать всё
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
              {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell size={28} className="text-txt-ghost" />
                  <p className="text-sm text-txt-muted">
                    {tab === 'unread' ? 'Нет непрочитанных' : 'Уведомлений пока нет'}
                  </p>
                </div>
              ) : (
                list.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.system
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpen(n)}
                      className={cn(
                        'group mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-2',
                        !n.read && 'bg-surface-2/50'
                      )}
                    >
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xs font-medium" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-dv-gold" />}
                        </div>
                        <p className="truncate text-sm font-medium text-txt-primary">{n.title}</p>
                        {n.message && (
                          <p className="line-clamp-2 text-xs text-txt-muted">{n.message}</p>
                        )}
                        <p className="mt-1 text-2xs text-txt-ghost">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
