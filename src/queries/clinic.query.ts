import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'
import type { Clinic } from '@/types'

export function useClinics() {
  return useQuery({
    queryKey: queryKeys.clinics,
    queryFn: () => apiClient.getClinics(),
  })
}

export function useClinic(id: string) {
  return useQuery({
    queryKey: queryKeys.clinic(id),
    queryFn: () => apiClient.getClinic(id),
    enabled: !!id,
  })
}

export function useCreateClinic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Clinic>) => apiClient.createClinic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clinics })
    },
  })
}
