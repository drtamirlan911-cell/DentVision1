import { create } from 'zustand'
import { Clinic } from '@/types'
import * as api from '@/utils/api'

interface ClinicState {
  activeClinic: Clinic | null
  clinics: Clinic[]
  loading: boolean
  setClinic: (id: string) => void
  loadClinics: () => Promise<void>
}

export const useClinicStore = create<ClinicState>((set) => ({
  activeClinic: null,
  clinics: [],
  loading: false,

  setClinic: (id) => {
    set((state) => {
      const clinic = state.clinics.find((c) => c.id === id) || null
      return { activeClinic: clinic }
    })
  },

  loadClinics: async () => {
    set({ loading: true })
    try {
      const clinics = await api.getClinics()
      set({ clinics, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
