import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'

export function usePatients(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: () => apiClient.getPatients(clinicId),
    enabled: !!clinicId,
  })
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: () => apiClient.getPatient(id),
    enabled: !!id,
  })
}

export function useMedicalCard(patientId: string) {
  return useQuery({
    queryKey: queryKeys.medicalCard(patientId),
    queryFn: () => apiClient.getMedicalCard(patientId),
    enabled: !!patientId,
  })
}

export function useVisits(clinicId: string, patientId: string) {
  return useQuery({
    queryKey: queryKeys.visits(patientId),
    queryFn: () => apiClient.getVisits(clinicId, patientId),
    enabled: !!patientId,
  })
}
