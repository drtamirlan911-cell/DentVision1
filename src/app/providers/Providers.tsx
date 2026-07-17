import { useEffect } from 'react'
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

export function Providers({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <GuestInitializer>
            {children}
          </GuestInitializer>
        </SocketProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
