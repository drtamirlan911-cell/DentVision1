import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePatientStore } from '@/store/patient.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useAIStore } from '@/store/ai.store'
import { buildClinicalCaseContext } from '@/lib/clinicalCaseContext'

const PATIENT_SUGGESTIONS = ['История лечения', 'План лечения', 'Зубная карта', 'Записать на приём']

/**
 * Keeps the selected clinical patient and treatment-case envelope synchronized
 * with the global AI context and prioritizes patient-aware AI commands.
 */
export function ClinicalAIContextBridge() {
  const location = useLocation()
  const patient = usePatientStore((s) => s.patientData)
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const setContextFocus = useWorkspaceStore((s) => s.setContextFocus)
  const clearContext = useWorkspaceStore((s) => s.clearContext)
  const setSuggestionsFromStrings = useAIStore((s) => s.setSuggestionsFromStrings)

  useEffect(() => {
    if (!selectedPatient || !patient) {
      clearContext()
      return
    }

    const clinicalCase = buildClinicalCaseContext({
      patientId: patient.id,
      patientName: patient.name,
      treatmentStage: patient.treatmentStage,
      debt: patient.debt,
      nextVisit: patient.nextVisit,
      nextVisitTime: patient.nextVisitTime,
      pathname: location.pathname,
      search: location.search,
    })

    setContextFocus('patient', patient.id, {
      patientId: patient.id,
      patientName: patient.name,
      phone: patient.phone,
      email: patient.email,
      birthDate: patient.birthDate,
      nextVisit: patient.nextVisit,
      nextVisitTime: patient.nextVisitTime,
      treatmentStage: patient.treatmentStage,
      debt: patient.debt,
      allergies: patient.allergies,
      insurance: patient.insurance,
      notes: patient.notes,
      address: patient.address,
      clinicalCase,
      source: 'patient-store',
    })

    setSuggestionsFromStrings(PATIENT_SUGGESTIONS)
  }, [selectedPatient, patient, location.pathname, location.search, setContextFocus, clearContext, setSuggestionsFromStrings])

  return null
}
