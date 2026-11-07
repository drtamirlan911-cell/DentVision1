import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SocketProvider } from '@/services/websocket'
import { BrowserRouter, useLocation } from 'react-router-dom'
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
  const pathname = useLocation().pathname
  const isAuthenticated = useAuthStore((s) => !!s.user)
  const isGuest = useGuestStore((s) => s.isGuest)
  const initGuest = useGuestStore((s) => s.initGuest)
  const isGuestRoute = useGuestStore((s) => s.isGuestRoute)
  const requiresAuth = useGuestStore((s) => s.requiresAuth)
  const isAuthEntryRoute = /^\/(?:login|register|forgot-password|reset-password|patient-portal)(?:\/|$)/i.test(pathname)
  const needsGuestSession = pathname === '/' || pathname === '/ai' || isGuestRoute(pathname)

  useEffect(() => {
    // Auth entry and protected deep links must not start an anonymous session:
    // the request races login/session restore and is abandoned on navigation.
    if (!isAuthenticated && !isGuest && needsGuestSession && !isAuthEntryRoute && !requiresAuth(pathname)) {
      void initGuest()
    }
  }, [isAuthenticated, isGuest, needsGuestSession, isAuthEntryRoute, requiresAuth, pathname, initGuest])

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" />
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
