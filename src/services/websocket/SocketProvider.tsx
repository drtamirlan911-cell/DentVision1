import { useEffect, createContext, useContext, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketClient } from './socket'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import { SOCKET_EVENTS } from './events'
import { queryKeys } from '@/queries/keys'
import { showBrowserNotification } from '@/utils/uiPrefs'
import type { ReactNode } from 'react'

const SocketContext = createContext<typeof socketClient>(socketClient)

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const prevUnread = useRef<number | null>(null)

  useEffect(() => {
    if (token && user && import.meta.env.VITE_WS_URL) {
      socketClient.reset()
      socketClient.connect()
    } else {
      socketClient.disconnect()
    }
    return () => socketClient.disconnect()
  }, [token, user])

  useEffect(() => {
    const unsubs = [
      socketClient.on(SOCKET_EVENTS.NOTIFICATION_NEW, (payload?: any) => {
        try { useNotificationStore.getState().loadNotifications() } catch { /* noop */ }
        const title = payload?.title || payload?.message || 'Новое уведомление DentVision'
        const body = payload?.message && payload?.title ? String(payload.message) : undefined
        showBrowserNotification(String(title), body ? { body: String(body) } : undefined)
      }),
      socketClient.on(SOCKET_EVENTS.AI_ALERT, () => {
        try { queryClient.invalidateQueries({ queryKey: [...queryKeys.notifications, 'proactive'] }) } catch { /* noop */ }
        showBrowserNotification('DentVision AI', { body: 'Новый AI-алерт' })
      }),
      socketClient.on(SOCKET_EVENTS.PATIENT_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.patients }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.PATIENT_DELETED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.patients }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_CREATED, () => {
        try {
          queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
          queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
        } catch { /* noop */ }
        showBrowserNotification('Новая запись', { body: 'В расписании появилась запись' })
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.appointments }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_DELETED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.appointments }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.VISIT_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.visits('') }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.MEDICAL_CARD_UPDATED, () => {
        try {
          queryClient.invalidateQueries({ queryKey: queryKeys.visits('') })
          queryClient.invalidateQueries({ queryKey: queryKeys.patients })
        } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.DOCUMENT_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.documents }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.DOCUMENT_DELETED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.documents }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.INVOICE_PAID, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.receipts }) } catch { /* noop */ }
        showBrowserNotification('Оплата получена', { body: 'Счёт оплачен' })
      }),
      socketClient.on(SOCKET_EVENTS.INVENTORY_LOW, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.inventory }) } catch { /* noop */ }
        showBrowserNotification('Склад', { body: 'Низкий остаток материалов' })
      }),
      socketClient.on(SOCKET_EVENTS.LAB_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.labOrders }) } catch { /* noop */ }
      }),
    ]

    // Soft realtime fallback when WS URL is unset (Render free / local): refresh CRM caches on focus + every 45s
    const softRefresh = () => {
      try {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
        queryClient.invalidateQueries({ queryKey: queryKeys.patients })
        queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
        queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      } catch { /* noop */ }
    }
    const onFocus = () => softRefresh()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(softRefresh, 45_000)

    return () => {
      unsubs.forEach((u) => u())
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [queryClient])

  // Fallback: when in-app unread count grows (e.g. polling), notify if tab is hidden
  useEffect(() => {
    return useNotificationStore.subscribe((state) => {
      const prev = prevUnread.current
      prevUnread.current = state.unread
      if (prev == null) return
      if (state.unread > prev) {
        const newest = state.notifications.find((n) => !n.read)
        showBrowserNotification(newest?.message || 'Новое уведомление DentVision')
      }
    })
  }, [])

  return (
    <SocketContext.Provider value={socketClient}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
