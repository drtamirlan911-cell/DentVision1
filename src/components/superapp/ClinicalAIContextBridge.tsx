import { useEffect } from 'react'
import { usePatientStore } from '@/store/patient.store'
import { useWorkspaceStore } from '@/store/workspace.store'

export function ClinicalAIContextBridge() {
  const patient = usePatientStore((s) => s.patientData)
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const setContextFocus = useWorkspaceStore((s) => s.setContextFocus)

  useEffect(() => {
    if (!selectedPatient || !patient) return
    setContextFocus('patient', patient.id, { patientName: patient.name })
  }, [patient, selectedPatient, setContextFocus])

  return null
}
