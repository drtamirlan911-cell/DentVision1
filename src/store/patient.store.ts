import { create } from 'zustand'
import * as api from '@/utils/api'

interface PatientState {
  selectedPatient: string | null
  patientData: any | null
  openPatient: (id: string) => Promise<void>
  closePatient: () => void
}

export const usePatientStore = create<PatientState>((set) => ({
  selectedPatient: null,
  patientData: null,

  openPatient: async (id) => {
    set({ selectedPatient: id, patientData: null })
    try {
      const data = await api.getMedicalCard(id)
      set({ patientData: data })
    } catch {
      set({ patientData: null })
    }
  },

  closePatient: () => set({ selectedPatient: null, patientData: null }),
}))
