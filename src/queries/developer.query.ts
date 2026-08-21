import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useDeveloperApps() {
  return useQuery({
    queryKey: queryKeys.developerApps,
    queryFn: () => api.listDeveloperApps(),
  })
}

export function useDeveloperApp(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.developerApp(id || ''),
    queryFn: () => api.getDeveloperApp(id as string),
    enabled: !!id,
  })
}

export function useCreateDeveloperApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; environment: 'sandbox' | 'production'; scopes?: string[] }) =>
      api.createDeveloperApp(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.developerApps }),
  })
}

export function useCreateDeveloperApiKey(appId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.createDeveloperApiKey(appId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.developerApps })
      if (appId) qc.invalidateQueries({ queryKey: queryKeys.developerApp(appId) })
    },
  })
}

export function useCreateDeveloperWebhook(appId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { url: string; events: string[] }) =>
      api.createDeveloperWebhook({ appId: appId as string, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.developerApps })
      if (appId) qc.invalidateQueries({ queryKey: queryKeys.developerApp(appId) })
    },
  })
}

export function useWebhookDeliveries(webhookId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.webhookDeliveries(webhookId || ''),
    queryFn: () => api.listWebhookDeliveries(webhookId as string),
    enabled: !!webhookId,
  })
}
