import { create } from 'zustand'
import * as api from '@/utils/api'

interface PatientContextData {
  id: string
  name: string
  phone?: string
  email?: string
  birthDate?: string
  nextVisit?: string
  nextVisitTime?: string
  treatmentStage?: string
  debt?: number
  avatar?: string
  notes?: string
  allergies?: string[]
  insurance?: string
  address?: string
}

interface PatientState {
  selectedPatient: string | null
  patientData: PatientContextData | null
  loading: boolean
  openPatient: (id: string) => Promise<void>
  closePatient: () => void
}

function splitAllergies(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean)
  }
  return undefined
}

export const usePatientStore = create<PatientState>((set) => ({
  selectedPatient: null,
  patientData: null,
  loading: false,

  openPatient: async (id) => {
    if (!id) return
    set({ selectedPatient: id, loading: true })
    try {
      const [patient, summary, card] = await Promise.all([
        api.getPatient(id).catch(() => null),
        api.getPatientSummary(id).catch(() => null),
        api.getMedicalCard(id).catch(() => null),
      ])

      const history = (patient as any)?.medicalHistory || card || {}
      const name =
        [patient?.lastName, patient?.firstName, (patient as any)?.middleName].filter(Boolean).join(' ')
        || (patient as any)?.name
        || 'Пациент'

      const next = summary?.nextVisit || summary?.data?.nextVisit
      const balance = summary?.balance ?? summary?.data?.balance
      const allergies = splitAllergies(
        (patient as any)?.allergies ?? history.allergies ?? (card as any)?.allergies,
      )

      set({
        selectedPatient: id,
        loading: false,
        patientData: {
          id,
          name,
          phone: patient?.phone || undefined,
          email: (patient as any)?.email || undefined,
          birthDate: (patient as any)?.dob || (patient as any)?.birthDate || undefined,
          nextVisit: next?.date ? String(next.date).slice(0, 10) : undefined,
          nextVisitTime: next?.time || undefined,
          treatmentStage: history.treatmentStage || 'treatment',
          debt: typeof balance === 'number' ? Number(balance) : undefined,
          avatar: (patient as any)?.avatar || (patient as any)?.photoUrl,
          notes: (patient as any)?.notes || history.notes,
          allergies,
          insurance: history.insurance || (card as any)?.insurance,
          address: (patient as any)?.address,
        },
      })

      // Prefer explicit debt from summary if present
      const explicitDebt = summary?.debt ?? summary?.data?.debt ?? summary?.openBalance
      if (typeof explicitDebt === 'number') {
        set((s) => s.patientData ? { patientData: { ...s.patientData, debt: explicitDebt } } : {})
      }
    } catch {
      set({ loading: false, patientData: null })
    }
  },

  closePatient: () => set({ selectedPatient: null, patientData: null, loading: false }),
}))
