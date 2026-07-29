import { create } from 'zustand'
import * as api from '@/utils/api'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  action?: { type: string; payload: any }
}

interface NotificationState {
  notifications: Notification[]
  unread: number
  loading: boolean
  loadNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

function mapNotification(n: any): Notification {
  const title = n.title || n.message || ''
  const message = n.title && n.message && n.message !== n.title ? n.message : (n.body || '')
  return {
    id: n.id,
    type: n.type || n.category || 'system',
    title,
    message,
    read: n.read ?? false,
    createdAt: n.createdAt || new Date().toISOString(),
    action: n.actionUrl
      ? { type: 'navigate', payload: n.actionUrl }
      : undefined,
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unread: 0,
  loading: false,

  loadNotifications: async () => {
    if (!api.getAccessToken()) {
      set({ loading: false })
      return
    }
    set({ loading: true })
    try {
      const [notifications, unread] = await Promise.all([
        api.getNotifications({ limit: 50 }),
        api.getUnreadCount(),
      ])
      set({
        notifications: (notifications || []).map(mapNotification),
        unread,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  markAsRead: async (id) => {
    try {
      await api.markNotificationRead(id)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unread: Math.max(0, state.unread - 1),
      }))
    } catch {
      // silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      await api.markAllNotificationsRead()
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unread: 0,
      }))
    } catch {
      // silently fail
    }
  },
}))
