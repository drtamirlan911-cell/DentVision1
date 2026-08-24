import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export function useAiInsights(entityType: string, entityId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.aiInsights(entityType, entityId || ''),
    queryFn: () => api.getAiInsights(entityType, entityId as string),
    enabled: !!entityId,
  })
}

export function useDismissAiInsight(entityType: string, entityId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.dismissAiInsight(id),
    onSuccess: () => {
      if (entityId) void queryClient.invalidateQueries({ queryKey: queryKeys.aiInsights(entityType, entityId) })
    },
  })
}
