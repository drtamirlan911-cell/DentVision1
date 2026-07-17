import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'
import type { Appointment } from '@/types'

export function useAppointments(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.appointments,
    queryFn: () => apiClient.getAppointments(clinicId),
    enabled: !!clinicId,
  })
}

export function useSchedule(clinicId: string, date?: string) {
  return useQuery({
    queryKey: queryKeys.schedule(clinicId, date),
    queryFn: () => apiClient.getAppointments(clinicId),
    enabled: !!clinicId,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Appointment>) => apiClient.upsertAppointment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
    },
  })
}
