import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

/** Platform-level dashboards live under this pseudo scopeId — Dashboard.scopeId
 * has no FK constraint, and a superadmin caller has no clinicId of its own to
 * fall back on the way a clinic user's dashboards do. */
export const PLATFORM_SCOPE_ID = 'platform'

export function useDataMetrics() {
  return useQuery({
    queryKey: queryKeys.dataMetrics,
    queryFn: () => api.listDataMetrics(),
  })
}

export function useDataMetricValue(key: string | undefined) {
  return useQuery({
    queryKey: ['dataMetricValue', key],
    queryFn: () => api.getDataMetricValue(key as string),
    enabled: !!key,
    staleTime: 30_000,
  })
}

export function useRegisterDataMetric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { key: string; domain?: string; title: string; definition: { type: api.MetricComputationType } }) =>
      api.registerDataMetric(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dataMetrics }),
  })
}

export function useDataDashboards() {
  return useQuery({
    queryKey: queryKeys.dataDashboards,
    queryFn: () => api.listDataDashboards(PLATFORM_SCOPE_ID),
  })
}

export function useCreateDataDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; layout: { tiles: api.DashboardTile[] } }) =>
      api.createDataDashboard({ ...data, scopeId: PLATFORM_SCOPE_ID }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dataDashboards }),
  })
}
