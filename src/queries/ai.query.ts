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

/**
 * The approval queue. Polled rather than pushed: rows appear both from a live
 * request the user just made and from a durable agent that proposed something
 * overnight, and only the first of those is tied to anything happening in this
 * tab.
 */
export function useAiApprovals(status?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiApprovals(status),
    queryFn: () => api.listAiApprovals(status),
    refetchInterval: 60_000,
    enabled,
  })
}

/**
 * Count for the sidebar badge. Shares the `pending` query key with the
 * Approval Center, so opening the page costs no extra request and deciding a
 * row updates the badge without its own invalidation.
 */
export function usePendingApprovalCount(enabled: boolean) {
  const { data } = useAiApprovals('pending', enabled)
  return data?.length ?? 0
}

function useApprovalDecision(fn: (id: string, note?: string) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => fn(id, note),
    // Deciding one row changes the pending count every other surface reads, so
    // invalidate the whole family rather than the one filtered list in view.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['aiApprovals'] }),
  })
}

export function useApproveAiApproval() {
  return useApprovalDecision(api.approveAiApproval)
}

export function useRejectAiApproval() {
  return useApprovalDecision(api.rejectAiApproval)
}
