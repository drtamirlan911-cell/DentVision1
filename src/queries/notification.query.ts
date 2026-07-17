import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'

export function useNotifications(opts?: { unread?: boolean; type?: string; limit?: number }) {
  return useQuery({
    queryKey: [...queryKeys.notifications, opts],
    queryFn: () => apiClient.getNotifications(opts),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...queryKeys.notifications, 'unread-count'],
    queryFn: () => apiClient.getUnreadCount(),
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    },
  })
}
