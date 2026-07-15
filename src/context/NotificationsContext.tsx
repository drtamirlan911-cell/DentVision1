import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import * as api from '@/utils/api';
import type { AppNotification } from '@/types';

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const POLL_INTERVAL = 30_000;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [list, count] = await Promise.all([
        api.getNotifications({ limit: 30 }),
        api.getUnreadCount(),
      ]);
      setNotifications(Array.isArray(list) ? list : []);
      setUnreadCount(count || 0);
    } catch {
      // ignore network errors during background polling
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.markNotificationRead(id);
    } catch {}
  }, []);

  const markAll = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {}
  }, []);

  const refresh = useCallback(() => load(), [load]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    load();
    timerRef.current = setInterval(() => { load(); }, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, load]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, load, markRead, markAll, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications(): NotificationsContextType {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
