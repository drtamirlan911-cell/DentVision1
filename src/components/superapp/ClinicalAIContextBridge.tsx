import { useEffect } from 'react'
import { usePatientStore } from '@/store/patient.store'
import { useWorkspaceStore } from '@/store/workspace.store'

/** Keeps the selected clinical patient synchronized with the global AI context. */
export function ClinicalAIContextBridge() {
  const patient = usePatientStore((s) => s.patientData)
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const setContextFocus = useWorkspaceStore((s) => s.setContextFocus)

  useEffect(() => {
    if (!selectedPatient || !patient) return

    setContextFocus('patient', selectedPatient, {
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        allergies: patient.allergies,
        nextVisit: patient.nextVisit,
        nextVisitTime: patient.nextVisitTime,
        treatmentStage: patient.treatmentStage,
        debt: patient.debt,
      },
    })
  }, [selectedPatient, patient, setContextFocus])

  return null
}
