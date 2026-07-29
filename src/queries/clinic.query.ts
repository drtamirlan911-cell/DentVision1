import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'
import type { Clinic } from '@/types'

export function useClinics() {
  return useQuery({
    queryKey: queryKeys.clinics,
    queryFn: () => api.getClinics(),
  })
}

export function useClinic(id: string) {
  return useQuery({
    queryKey: queryKeys.clinic(id),
    queryFn: () => api.getClinic(id),
    enabled: !!id,
  })
}

export function useCreateClinic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Clinic>) => api.createClinic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clinics })
    },
  })
}
