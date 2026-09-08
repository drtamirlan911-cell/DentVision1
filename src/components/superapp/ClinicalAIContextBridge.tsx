import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePatientStore } from '@/store/patient.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { buildClinicalCaseContext } from '@/lib/clinicalCaseContext'

/**
 * Keeps the selected clinical patient and the current treatment-case envelope
 * synchronized with the global AI context.
 * patient.store remains the source of truth for patient data; route parameters
 * only identify an already-existing plan/stage/visit.
 */
export function ClinicalAIContextBridge() {
  const location = useLocation()
  const patient = usePatientStore((s) => s.patientData)
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const setContextFocus = useWorkspaceStore((s) => s.setContextFocus)
  const clearContext = useWorkspaceStore((s) => s.clearContext)

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
  }, [selectedPatient, patient, location.pathname, location.search, setContextFocus, clearContext])

  return null
}
