import { useQuery, useMutation } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useAIQuery() {
  return useMutation({
    mutationFn: ({
      message,
      history,
    }: {
      message: string
      history?: Array<{ role: string; content: string }>
    }) => api.aiChat(message, history),
  })
}

export function useProactiveAlerts() {
  return useQuery({
    queryKey: [...queryKeys.notifications, 'proactive'],
    queryFn: () => api.aiProactive(),
  })
}
