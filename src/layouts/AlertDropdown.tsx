import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification.store';
import { useAuth } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';
import { useTranslation } from 'react-i18next';

const priorityIcon: Record<string, React.ReactNode> = {
  high: <AlertCircle size={14} className="text-red-400 shrink-0" />,
  medium: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
  low: <Info size={14} className="text-blue-400 shrink-0" />,
};

const ACTION_PATHS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenCashier: '/crm/cashier',
  OpenInventory: '/crm/inventory',
  OpenBilling: '/crm/billing',
  OpenSchool: '/school',
  OpenProfile: '/profile',
  OpenLab: '/crm/lab',
  OpenShop: '/shop',
  OpenDemo: '/crm/schedule?demo=1',
  OpenPatients: '/crm/patients',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenJobs: '/jobs',
  OpenStaff: '/crm/staff',
};

type BellAlert = {
  id?: string;
  type: string;
  message?: string;
  text?: string;
  priority: 'high' | 'medium' | 'low' | number;
  action?: { type: string; path?: string; payload?: any };
  source?: 'proactive' | 'notification';
  read?: boolean;
};

interface AlertDropdownProps {
  alerts: Array<{
    type: string;
    message?: string;
    text?: string;
    priority: 'high' | 'medium' | 'low' | number;
    action?: { type: string; path?: string };
  }>;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export function badgeCountFor(input: { unreadNotifications: number }): number {
  return Math.max(0, input.unreadNotifications);
}

export function timeAgo(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const unit = abs < 60 ? 'second' : abs < 3600 ? 'minute' : abs < 86400 ? 'hour' : 'day';
  const divisor = unit === 'second' ? 1 : unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400;
  const valueInUnit = Math.round(diffSeconds / divisor);
  try {
    return new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(valueInUnit, unit as Intl.RelativeTimeFormatUnit);
  } catch {
    return new Date(timestamp).toLocaleString('ru-RU');
  }
}

function normalizePriority(p: BellAlert['priority']): 'high' | 'medium' | 'low' {
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  const n = Number(p) || 0;
  if (n >= 8) return 'high';
  if (n >= 4) return 'medium';
  return 'low';
}

function resolveAlertPath(alert: BellAlert): string | undefined {
  if (alert.action?.path) return alert.action.path;
  const type = alert.action?.type;
  if (!type) return undefined;
  if (type === 'navigate' || type === 'NAVIGATE') {
    const payload = alert.action?.payload;
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && typeof payload.path === 'string') return payload.path;
  }
  return ACTION_PATHS[type];
}

export const AlertDropdown: React.FC<AlertDropdownProps> = ({ alerts, isOpen, setIsOpen }) => {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadNotifs = useNotificationStore((s) => s.unread);
  const markRead = useNotificationStore((s) => s.markAsRead);
  const markAll = useNotificationStore((s) => s.markAllAsRead);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const [selectedNotification, setSelectedNotification] = useState<{
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    actionUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    void loadNotifications();
  }, [loadNotifications, isAuthenticated, isGuest]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (!selectedNotification) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNotification(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNotification]);

  useEffect(() => {
    if (!isOpen) return;
    const el = contentRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const notifItems = useMemo<BellAlert[]>(
    () =>
      (notifications || [])
        .map((n) => ({
          id: n.id,
          type: n.type || 'system',
          message: n.title || n.message,
          priority: (n.read ? 'low' : 'medium') as BellAlert['priority'],
          action: n.actionUrl ? { type: 'navigate', path: n.actionUrl } : undefined,
          source: 'notification' as const,
          read: n.read,
        }))
        .sort((a, b) => Number(a.read) - Number(b.read))
        .slice(0, 30),
    [notifications],
  );

  const hintItems = useMemo<BellAlert[]>(
    () => (alerts || []).map((a, i) => ({ ...a, id: `pa-${i}`, source: 'proactive' as const })).slice(0, 10),
    [alerts],
  );

  const badgeCount = badgeCountFor({ unreadNotifications: unreadNotifs });

  const renderRow = (alert: BellAlert, i: number) => {
    const pr = normalizePriority(alert.priority);
    const text = alert.message || alert.text || '';
    const path = resolveAlertPath(alert);
    return (
      <button key={alert.id || `${alert.type}-${i}`} type="button" onClick={() => {
        if (alert.source === 'notification' && alert.id) {
          const notification = notifications.find((item) => item.id === alert.id);
          if (!notification) return;
          if (!notification.read) void markRead(notification.id);
          setSelectedNotification(notification);
          setIsOpen(false);
          return;
        }
        if (path) navigate(path);
        setIsOpen(false);
      }} className={cn('w-full text-left flex items-start gap-2.5 px-3 py-3 border-b border-bdr-subtle last:border-b-0 hover:bg-surface-2 transition-colors', alert.source === 'notification' && !alert.read && 'bg-dv-gold/[0.06]')}>
        {priorityIcon[pr]}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-txt-primary leading-snug break-words">{text}</p>
          <span className="text-2xs text-txt-ghost uppercase mt-0.5 block">{alert.source === 'notification' ? t('platform.notification_source') : alert.type}{path ? t('platform.notification_open') : ''}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={cn('relative flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors', isOpen ? 'text-dv-gold bg-dv-gold/10' : 'text-dv-gold hover:bg-dv-gold/10')} aria-label={t('platform.notifications')} aria-expanded={isOpen}>
        <Bell size={17} className={badgeCount > 0 ? 'alert-pulse' : undefined} />
        {badgeCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-dv-gold text-[9px] font-bold text-dv-gold-on flex items-center justify-center">{badgeCount > 9 ? '9+' : badgeCount}</span>}
      </button>
      <AnimatePresence>
        {selectedNotification && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={selectedNotification.title}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedNotification(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-bdr-subtle bg-surface-1 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-bdr-subtle px-5 py-4">
                <div className="min-w-0">
                  <p className="text-2xs font-medium uppercase tracking-wider text-dv-gold">
                    {t('platform.notification_source')}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-txt-primary break-words">
                    {selectedNotification.title}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label={t('common.close')}
                  onClick={() => setSelectedNotification(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 px-5 py-5">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-txt-secondary">
                  {selectedNotification.message || t('platform.notification_empty_short')}
                </p>
                <p className="text-2xs text-txt-ghost">{timeAgo(selectedNotification.createdAt)}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-bdr-subtle px-5 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="min-h-9 rounded-lg px-3 py-2 text-xs text-txt-secondary hover:bg-surface-2"
                >
                  {t('common.close')}
                </button>
                {selectedNotification.actionUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const path = selectedNotification.actionUrl;
                      setSelectedNotification(null);
                      if (path) navigate(path);
                    }}
                    className="min-h-9 rounded-lg bg-dv-gold px-3 py-2 text-xs font-medium text-black"
                  >
                    Открыть связанный раздел
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/40 sm:bg-transparent" onClick={() => setIsOpen(false)} />
            <motion.div ref={contentRef} initial={{ opacity: 0, scale: 0.97, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }} className={cn('fixed z-[95] rounded-xl border border-bdr-subtle bg-surface-1 shadow-xl overflow-hidden', 'left-3 right-3 top-[calc(var(--dv-topbar-height)+var(--dv-safe-top)+0.35rem)]', 'sm:left-auto sm:right-3 sm:w-80 sm:max-w-[calc(100vw-1.5rem)]')} role="dialog" aria-modal="true" aria-label={t('platform.notifications')}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-bdr-subtle">
                <span className="text-xs font-semibold text-txt-primary">{t('platform.notifications')}</span>
                <div className="flex items-center gap-1">
                  {unreadNotifs > 0 && <button type="button" onClick={() => void markAll()} className="px-2 py-1 rounded text-[10px] text-txt-muted hover:text-txt-primary transition-colors">{t('platform.notification_read_all')}</button>}
                  <button type="button" onClick={() => setIsOpen(false)} className="p-1 rounded text-txt-muted hover:text-txt-primary transition-colors" aria-label={t('common.close')}><X size={14} /></button>
                </div>
              </div>
              <div className="max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain">
                {notifItems.length === 0 && hintItems.length === 0 ? (
                  <div className="px-4 py-8 text-center"><Bell size={22} className="mx-auto text-txt-ghost mb-2" /><p className="text-xs text-txt-muted m-0">{t('platform.notification_empty_short')}</p></div>
                ) : (
                  <>
                    {notifItems.length === 0 && <p className="px-3 py-4 text-xs text-txt-muted m-0">{t('platform.notification_empty_short')}</p>}
                    {notifItems.map(renderRow)}
                    {hintItems.length > 0 && <><p className="px-3 pt-3 pb-1.5 text-2xs uppercase tracking-wider text-txt-ghost m-0">{t('platform.notification_hints')}</p>{hintItems.map(renderRow)}</>}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
