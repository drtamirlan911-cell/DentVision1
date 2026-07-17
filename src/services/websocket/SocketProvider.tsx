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
    if (token) {
      socketClient.connect()
    } else {
      socketClient.disconnect()
    }
    return () => socketClient.disconnect()
  }, [token])

  useEffect(() => {
    const unsubs = [
      socketClient.on(SOCKET_EVENTS.NOTIFICATION_NEW, () => {
        useNotificationStore.getState().loadNotifications()
      }),
      socketClient.on(SOCKET_EVENTS.AI_ALERT, () => {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.notifications, 'proactive'] })
      }),
      socketClient.on(SOCKET_EVENTS.PATIENT_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      }),
      socketClient.on(SOCKET_EVENTS.PATIENT_DELETED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_CREATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      }),
      socketClient.on(SOCKET_EVENTS.APPOINTMENT_DELETED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      }),
      socketClient.on(SOCKET_EVENTS.VISIT_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.visits('') })
      }),
      socketClient.on(SOCKET_EVENTS.MEDICAL_CARD_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.visits('') })
        queryClient.invalidateQueries({ queryKey: queryKeys.documents })
      }),
      socketClient.on(SOCKET_EVENTS.DOCUMENT_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.documents })
      }),
      socketClient.on(SOCKET_EVENTS.DOCUMENT_DELETED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.documents })
      }),
      socketClient.on(SOCKET_EVENTS.INVOICE_PAID, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      }),
      socketClient.on(SOCKET_EVENTS.INVENTORY_LOW, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
      }),
      socketClient.on(SOCKET_EVENTS.LAB_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.labOrders })
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
