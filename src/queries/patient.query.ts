import { useQuery } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function usePatients(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: () => api.getPatients(clinicId),
    enabled: !!clinicId,
  })
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: () => api.getPatient(id),
    enabled: !!id,
  })
}

export function useMedicalCard(patientId: string) {
  return useQuery({
    queryKey: queryKeys.medicalCard(patientId),
    queryFn: () => api.getMedicalCard(patientId),
    enabled: !!patientId,
  })
}

export function useVisits(clinicId: string, patientId: string) {
  return useQuery({
    queryKey: queryKeys.visits(patientId),
    queryFn: () => api.getVisits(clinicId, patientId),
    enabled: !!patientId,
  })
}
