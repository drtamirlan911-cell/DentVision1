import { useEffect, createContext, useContext } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketClient } from './socket'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import { SOCKET_EVENTS } from './events'
import { queryKeys } from '@/queries/keys'
import type { ReactNode } from 'react'

const SocketContext = createContext<typeof socketClient>(socketClient)

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (token && import.meta.env.VITE_WS_URL) {
      socketClient.reset()
      socketClient.connect()
    } else {
      socketClient.disconnect()
    }
    return () => socketClient.disconnect()
  }, [token])

  useEffect(() => {
    const unsubs = [
      socketClient.on(SOCKET_EVENTS.NOTIFICATION_NEW, () => {
        try { useNotificationStore.getState().loadNotifications() } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.AI_ALERT, () => {
        try { queryClient.invalidateQueries({ queryKey: [...queryKeys.notifications, 'proactive'] }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.PATIENT_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.patients }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.PATIENT_DELETED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.patients }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_CREATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.appointments }) } catch { /* noop */ }
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
        try { queryClient.invalidateQueries({ queryKey: queryKeys.visits('') }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.DOCUMENT_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.documents }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.DOCUMENT_DELETED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.documents }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.INVOICE_PAID, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.receipts }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.INVENTORY_LOW, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.inventory }) } catch { /* noop */ }
      }),
      socketClient.on(SOCKET_EVENTS.LAB_UPDATED, () => {
        try { queryClient.invalidateQueries({ queryKey: queryKeys.labOrders }) } catch { /* noop */ }
      }),
    ]
    return () => { unsubs.forEach((u) => u()) }
  }, [queryClient])

  return (
    <SocketContext.Provider value={socketClient}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
