import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SocketProvider } from '@/services/websocket'
import { BrowserRouter } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

interface ProvidersProps {
  children: React.ReactNode
}

function GuestInitializer({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.user)
  const isGuest = useGuestStore((s) => s.isGuest)
  const initGuest = useGuestStore((s) => s.initGuest)

  useEffect(() => {
    if (!isAuthenticated && !isGuest) {
      initGuest()
    }
  }, [isAuthenticated, isGuest, initGuest])

  return <>{children}</>
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    restoreSession().finally(() => setReady(true))
  }, [restoreSession])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A96E]/30 border-t-[#C9A96E]" />
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <AuthInitializer>
            <GuestInitializer>
              {children}
            </GuestInitializer>
          </AuthInitializer>
        </SocketProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
