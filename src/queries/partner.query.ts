import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function usePartners() {
  return useQuery({
    queryKey: queryKeys.partners,
    queryFn: () => api.listPartners(),
  })
}

export function usePartner(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partner(id || ''),
    queryFn: () => api.getPartner(id as string),
    enabled: !!id,
  })
}

export function usePartnerTiers() {
  return useQuery({
    queryKey: queryKeys.partnerTiers,
    queryFn: () => api.listPartnerTiers(),
  })
}

export function useCreatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: api.PartnerType; refType: string; refId: string }) => api.createPartner(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.partners }),
  })
}

export function useCreatePartnerTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; commissionBps: number }) => api.createPartnerTier(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.partnerTiers }),
  })
}

export function useAssignPartnerTier(partnerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tierId: string) => api.assignPartnerTier(partnerId as string, tierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.partners })
      if (partnerId) qc.invalidateQueries({ queryKey: queryKeys.partner(partnerId) })
    },
  })
}

export function useAddPartnerKpi(partnerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { period: string; metricsJson: unknown; score: number }) => api.addPartnerKpi(partnerId as string, data),
    onSuccess: () => { if (partnerId) qc.invalidateQueries({ queryKey: queryKeys.partner(partnerId) }) },
  })
}

export function useAddPartnerSla(partnerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { metric: string; target: number; actual?: number; direction?: 'lower_better' | 'higher_better' }) =>
      api.addPartnerSla(partnerId as string, data),
    onSuccess: () => { if (partnerId) qc.invalidateQueries({ queryKey: queryKeys.partner(partnerId) }) },
  })
}

export function useAddPartnerCampaign(partnerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; budget: number; splitBps?: number; startsAt?: string; endsAt?: string }) =>
      api.addPartnerCampaign(partnerId as string, data),
    onSuccess: () => { if (partnerId) qc.invalidateQueries({ queryKey: queryKeys.partner(partnerId) }) },
  })
}
