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
import { useNotificationStore } from '@/store/notification.store'
import { cn, timeAgo } from '@/lib/utils'
import type { AppNotification, NotificationType } from '@/types'
import { useTranslation } from 'react-i18next'

const TYPE_META: Record<NotificationType, { label: string; icon: React.ReactNode; color: string }> = {
  shop: { label: 'Магазин', icon: <ShoppingCart size={16} />, color: '#3498DB' },
  school: { label: 'Академия', icon: <GraduationCap size={16} />, color: '#27AE60' },
  clinic: { label: 'Клиника', icon: <Stethoscope size={16} />, color: '#C9A96E' },
  system: { label: 'Система', icon: <SettingsIcon size={16} />, color: '#95A5A6' },
}

function useTypeMeta(): Record<NotificationType, { label: string; icon: React.ReactNode; color: string }> {
  const { t } = useTranslation()
  return {
    shop: { label: t('platform.notification_shop'), icon: <ShoppingCart size={16} />, color: '#3498DB' },
    school: { label: t('platform.notification_academy'), icon: <GraduationCap size={16} />, color: '#27AE60' },
    clinic: { label: t('platform.notification_clinic'), icon: <Stethoscope size={16} />, color: '#C9A96E' },
    system: { label: t('platform.notification_system'), icon: <SettingsIcon size={16} />, color: '#95A5A6' },
  }
}

export default function NotificationCenter() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unread)
  const markRead = useNotificationStore((s) => s.markAsRead)
  const markAll = useNotificationStore((s) => s.markAllAsRead)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [selected, setSelected] = useState<AppNotification | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const list = notifications.filter((n) => (tab === 'unread' ? !n.read : true))

  const typeMeta = useTypeMeta()

  const handleOpen = (n: AppNotification) => {
    if (!n.read) markRead(n.id)
    setSelected(n)
  }

  const closeDetail = () => setSelected(null)

  const followAction = () => {
    if (!selected?.actionUrl) return
    closeDetail()
    setOpen(false)
    navigate(selected.actionUrl)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-txt-muted transition-colors hover:bg-white/5 hover:text-txt-primary"
        aria-label={t('platform.notifications')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
            role="dialog" aria-modal="true" aria-label={selected.title}
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeDetail() }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-lg rounded-2xl border border-bdr-subtle bg-surface-1 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-bdr-subtle px-5 py-4">
                <div className="min-w-0">
                  <p className="text-2xs font-medium text-dv-gold">{typeMeta[selected.type as NotificationType]?.label || t('platform.notification_system')}</p>
                  <h3 className="mt-1 text-base font-semibold text-txt-primary">{selected.title}</h3>
                </div>
                <button type="button" aria-label="Close notification details" onClick={closeDetail} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-txt-muted hover:bg-surface-2 hover:text-txt-primary"><X size={18} /></button>
              </div>
              <div className="space-y-3 px-5 py-5">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-txt-secondary">{selected.message || 'Нет дополнительного описания.'}</p>
                <p className="text-2xs text-txt-ghost">{timeAgo(selected.createdAt)}</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-bdr-subtle px-5 py-3">
                <button type="button" onClick={closeDetail} className="min-h-9 rounded-lg px-3 py-2 text-xs text-txt-secondary hover:bg-surface-2">Закрыть</button>
                {selected.actionUrl && <button type="button" onClick={followAction} className="min-h-9 rounded-lg bg-dv-gold px-3 py-2 text-xs font-medium text-black">Открыть связанный раздел</button>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <h3 className="text-sm font-semibold text-txt-primary">{t('platform.notifications')}</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-dv-gold/20 px-2 py-0.5 text-2xs font-bold text-dv-gold">
                    {unreadCount} {t('platform.notification_new')}
                  </span>
                )}
              </div>
              <button
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-3 pt-3">
              {(['all', 'unread'] as const).map((tabValue) => (
                <button
                  key={tabValue}
                  onClick={() => setTab(tabValue)}
                  className={cn(
                    'min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    tab === tabValue ? 'bg-surface-2 text-dv-gold' : 'text-txt-muted hover:text-txt-secondary'
                  )}
                >
                  {tabValue === 'all' ? t('platform.notification_all') : t('platform.notification_unread')}
                </button>
              ))}
              <div className="ml-auto">
                <button
                  onClick={markAll}
                  className="flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-2xs text-txt-muted hover:text-txt-primary"
                >
                  <Check size={13} /> {t('platform.notification_read_all')}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
              {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell size={28} className="text-txt-ghost" />
                  <p className="text-sm text-txt-muted">
                    {tab === 'unread' ? t('platform.notification_empty_unread') : t('platform.notification_empty')}
                  </p>
                </div>
              ) : (
                list.map((n) => {
                    const meta = typeMeta[n.type as NotificationType] || typeMeta.system
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpen(n as AppNotification)}
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
