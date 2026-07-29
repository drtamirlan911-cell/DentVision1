import React, { useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification.store';
import { useAuth } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';

const priorityIcon: Record<string, React.ReactNode> = {
  high: <AlertCircle size={14} className="text-red-400 shrink-0" />,
  medium: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
  low: <Info size={14} className="text-blue-400 shrink-0" />,
};

const ACTION_PATHS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenCashier: '/crm/finance',
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadNotifs = useNotificationStore((s) => s.unread);
  const markRead = useNotificationStore((s) => s.markAsRead);
  const markAll = useNotificationStore((s) => s.markAllAsRead);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    void loadNotifications();
  }, [loadNotifications, isAuthenticated, isGuest]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Use click (not mousedown) so the toggle click that opens does not immediately close.
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, setIsOpen]);

  const merged = useMemo(() => {
    const fromNotif: BellAlert[] = (notifications || []).map((n) => ({
      id: n.id,
      type: n.type || 'system',
      message: n.message,
      priority: n.read ? 'low' : 'medium',
      action: n.action,
      source: 'notification' as const,
      read: n.read,
    }));
    const fromProactive: BellAlert[] = (alerts || []).map((a, i) => ({
      ...a,
      id: `pa-${i}`,
      source: 'proactive' as const,
    }));
    // Unread notifications first, then proactive, then read.
    return [...fromNotif.filter((n) => !n.read), ...fromProactive, ...fromNotif.filter((n) => n.read)].slice(0, 30);
  }, [alerts, notifications]);

  const badgeCount = Math.max(
    unreadNotifs,
    alerts.length,
    merged.filter((a) => a.source === 'proactive' || !a.read).length,
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          isOpen ? 'text-amber-400 bg-amber-400/10' : 'text-amber-400 hover:bg-amber-400/10',
        )}
        aria-label="Оповещения"
        aria-expanded={isOpen}
      >
        <Bell size={16} className={badgeCount > 0 ? 'alert-pulse' : undefined} />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/40 sm:bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            {/* Always fixed — header overflow would clip absolute panels */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'fixed z-[95] rounded-xl border border-bdr-subtle bg-surface-1 shadow-xl overflow-hidden',
                'left-3 right-3 top-[calc(var(--dv-topbar-height)+var(--dv-safe-top)+0.35rem)]',
                'sm:left-auto sm:right-3 sm:w-80 sm:max-w-[calc(100vw-1.5rem)]',
              )}
              role="dialog"
              aria-label="Оповещения"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-bdr-subtle">
                <span className="text-xs font-semibold text-txt-primary">Оповещения</span>
                <div className="flex items-center gap-1">
                  {unreadNotifs > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAll()}
                      className="px-2 py-1 rounded text-[10px] text-txt-muted hover:text-txt-primary transition-colors"
                    >
                      Прочитать всё
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded text-txt-muted hover:text-txt-primary transition-colors"
                    aria-label="Закрыть"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain">
                {merged.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={22} className="mx-auto text-txt-ghost mb-2" />
                    <p className="text-xs text-txt-muted m-0">Пока нет оповещений</p>
                  </div>
                ) : (
                  merged.map((alert, i) => {
                    const pr = normalizePriority(alert.priority);
                    const text = alert.message || alert.text || '';
                    const path = resolveAlertPath(alert);
                    return (
                      <button
                        key={alert.id || `${alert.type}-${i}`}
                        type="button"
                        onClick={() => {
                          if (alert.source === 'notification' && alert.id && !alert.read) {
                            void markRead(alert.id);
                          }
                          if (path) navigate(path);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'w-full text-left flex items-start gap-2.5 px-3 py-3 border-b border-bdr-subtle last:border-b-0 hover:bg-white/[0.03] transition-colors',
                          alert.source === 'notification' && !alert.read && 'bg-amber-400/[0.04]',
                        )}
                      >
                        {priorityIcon[pr]}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-txt-primary leading-snug break-words">{text}</p>
                          <span className="text-2xs text-txt-ghost uppercase mt-0.5 block">
                            {alert.source === 'notification' ? 'уведомление' : alert.type}
                            {path ? ' · открыть' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
