import React from 'react'
import { useLocation } from 'react-router-dom'
import { usePatientStore } from '@/store/patient.store'
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext'
import EcosystemCaseFlow from './EcosystemCaseFlow'

const SUPPORTED_PATHS = [
  '/crm/patients',
  '/crm/dental-chart',
  '/crm/treatment-plans',
  '/crm/lab',
  '/crm/cashier',
  '/crm/schedule',
  '/crm/appointments',
  '/crm/visits',
  '/crm/medical-card',
  '/diagnostics',
  '/shop',
  '/ai',
]

/**
 * Non-invasive clinical context surface for ecosystem workspaces.
 * It only appears when the current route has an authorized patient/case context
 * (or a patient selected in the existing patient store) and never replaces the
 * underlying domain page.
 */
export default function EcosystemClinicalContext() {
  const location = useLocation()
  const selectedPatient = usePatientStore((state) => state.selectedPatient)
  const urlContext = useEcosystemUrlContext()

  const supported = SUPPORTED_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
  if (!supported) return null

  const patientId = urlContext.patientId || selectedPatient?.id
  const caseId = urlContext.caseId
  const branchId = urlContext.branchId
  const organizationId = urlContext.organizationId

  if (!patientId && !caseId) return null

  return (
    <div className="dv-page-section">
      <EcosystemCaseFlow
        patientId={patientId}
        caseId={caseId}
        branchId={branchId}
        organizationId={organizationId}
      />
    </div>
  )
}
