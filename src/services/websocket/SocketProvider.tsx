import { useEffect, createContext, useContext } from 'react'
import { socketClient } from './socket'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import { useAIStore } from '@/store/ai.store'
import { SOCKET_EVENTS } from './events'
import type { ReactNode } from 'react'

const SocketContext = createContext<typeof socketClient>(socketClient)

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (token) {
      socketClient.connect()
    } else {
      socketClient.disconnect()
    }
    return () => socketClient.disconnect()
  }, [token])

  useEffect(() => {
    const unsub1 = socketClient.on(SOCKET_EVENTS.NOTIFICATION_NEW, () => {
      useNotificationStore.getState().loadNotifications()
    })
    const unsub2 = socketClient.on(SOCKET_EVENTS.AI_ALERT, () => {
      useAIStore.getState().loadProactiveAlerts()
    })
    return () => { unsub1(); unsub2() }
  }, [])

  return (
    <SocketContext.Provider value={socketClient}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
