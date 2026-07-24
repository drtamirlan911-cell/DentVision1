import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useNotifications(opts?: { unread?: boolean; type?: string; limit?: number }) {
  return useQuery({
    queryKey: [...queryKeys.notifications, opts],
    queryFn: () => api.getNotifications(opts),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...queryKeys.notifications, 'unread-count'],
    queryFn: () => api.getUnreadCount(),
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    },
  })
}
