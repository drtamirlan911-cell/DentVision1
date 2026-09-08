import { useEffect } from 'react'
import { usePatientStore } from '@/store/patient.store'
import { useWorkspaceStore } from '@/store/workspace.store'

/**
 * Keeps the AI workspace context synchronized with the currently selected
 * clinical patient. This is intentionally UI-only: it does not create or
 * mutate clinical records.
 */
export function ClinicalAIContextBridge() {
  const patient = usePatientStore((s) => s.patientData)
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const setContextFocus = useWorkspaceStore((s) => s.setContextFocus)

  useEffect(() => {
    if (!selectedPatient || !patient) return

    setContextFocus({
      type: 'patient',
      id: patient.id,
      label: patient.name,
      metadata: {
        phone: patient.phone,
        nextVisit: patient.nextVisit,
        nextVisitTime: patient.nextVisitTime,
        treatmentStage: patient.treatmentStage,
        debt: patient.debt,
      },
    } as any)
  }, [patient, selectedPatient, setContextFocus])

  return null
}
