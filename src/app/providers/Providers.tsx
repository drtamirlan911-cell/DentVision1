import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SocketProvider } from '@/services/websocket'
import { BrowserRouter } from 'react-router-dom'

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

export function Providers({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
