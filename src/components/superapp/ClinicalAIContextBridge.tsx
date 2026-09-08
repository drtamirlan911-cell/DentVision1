import { useEffect } from 'react'
import { usePatientStore } from '@/store/patient.store'
import { useWorkspaceStore } from '@/store/workspace.store'

/**
 * Keeps the selected clinical patient synchronized with the global AI context.
 * patient.store remains the source of truth for patient selection.
 */
export function ClinicalAIContextBridge() {
  const patient = usePatientStore((s) => s.patientData)
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const setContextFocus = useWorkspaceStore((s) => s.setContextFocus)
  const clearContext = useWorkspaceStore((s) => s.clearContext)

  useEffect(() => {
    if (!selectedPatient || !patient) {
      clearContext()
      return
    }

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
      source: 'patient-store',
    })
  }, [selectedPatient, patient, setContextFocus, clearContext])

  return null
}
