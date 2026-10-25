import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Compatibility entry for the historical /register-diagnostics route.
 *
 * The canonical onboarding engine is /onboarding. This route only translates
 * legacy query values so existing bookmarks and integrations land in the same
 * organization/context creation flow without maintaining a second UI or
 * persistence contract.
 */
export default function DiagnosticsRegister() {
  const [params] = useSearchParams()
  const rawType = params.get('type')
  const kind = rawType === 'center'
    ? 'diagnostic_center'
    : rawType === 'laboratory'
      ? 'medical_lab'
      : 'dental_lab'

  return <Navigate to={`/onboarding?mode=create&kind=${kind}`} replace />
}
