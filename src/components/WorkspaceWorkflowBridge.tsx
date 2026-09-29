import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useWorkspaceStore } from '@/store/workspace.store'

function workflowForPath(pathname: string): { key: string; step: string | null; entityType: string } {
  const path = pathname.toLowerCase()
  if (path === '/ai' || path.startsWith('/ai/')) return { key: 'ai', step: null, entityType: 'ai-session' }
  if (path.startsWith('/crm/clinical-case')) return { key: 'clinical-case', step: null, entityType: 'case' }
  if (path.startsWith('/crm/patients')) return { key: 'patient', step: null, entityType: 'patient' }
  if (path.startsWith('/crm/schedule')) return { key: 'appointment', step: null, entityType: 'appointment' }
  if (path.startsWith('/crm/lab')) return { key: 'dental-laboratory', step: null, entityType: 'lab-order' }
  if (path.startsWith('/crm/inventory')) return { key: 'procurement', step: null, entityType: 'inventory' }
  if (path.startsWith('/crm/cashier')) return { key: 'finance', step: null, entityType: 'invoice' }
  if (path.startsWith('/crm/')) return { key: 'practice', step: null, entityType: 'practice' }
  if (path.startsWith('/diagnostics/center')) return { key: 'diagnostic-center', step: null, entityType: 'study' }
  if (path.startsWith('/diagnostics/lab')) return { key: 'medical-laboratory', step: null, entityType: 'lab-order' }
  if (path.startsWith('/diagnostics/')) return { key: 'diagnostics', step: null, entityType: 'study' }
  if (path.startsWith('/medical-lab')) return { key: 'medical-laboratory', step: null, entityType: 'lab-order' }
  if (path.startsWith('/dental-lab')) return { key: 'dental-laboratory', step: null, entityType: 'lab-case' }
  if (path.startsWith('/supplier')) return { key: 'supplier-operations', step: null, entityType: 'order' }
  if (path.startsWith('/shop')) return { key: 'procurement', step: null, entityType: 'product' }
  if (path.startsWith('/school')) return { key: 'learning', step: null, entityType: 'course' }
  if (path.startsWith('/jobs')) return { key: 'employment', step: null, entityType: 'job' }
  if (path.startsWith('/community')) return { key: 'network', step: null, entityType: 'community' }
  if (path.startsWith('/analytics')) return { key: 'analytics', step: null, entityType: 'analytics' }
  if (path.startsWith('/settings')) return { key: 'administration', step: null, entityType: 'organization' }
  return { key: 'workspace', step: null, entityType: 'workspace' }
}

function entityFromPath(pathname: string, search: string, fallbackType: string): { type: string; id: string | null } {
  const params = new URLSearchParams(search)
  const explicit =
    params.get('caseId') || params.get('patient') || params.get('patientId') ||
    params.get('studyId') || params.get('orderId') || params.get('courseId') ||
    params.get('productId') || params.get('id')
  if (explicit) return { type: fallbackType, id: explicit }

  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (last && !['schedule','patients','clinical-case','lab','inventory','cashier','diagnostics','center','lab-dashboard','school','workspace','supplier','shop','jobs','community','analytics','settings'].includes(last)) {
    return { type: fallbackType, id: last }
  }
  return { type: fallbackType, id: null }
}

/**
 * Converts existing routes into workflow context without introducing another
 * routing system. It is metadata only; authorization remains server-owned.
 */
export function WorkspaceWorkflowBridge() {
  const { pathname, search } = useLocation()
  const contextContract = useWorkspaceStore(s => s.contextContract)
  const setWorkflow = useWorkspaceStore(s => s.setWorkflow)
  const workflow = useMemo(() => workflowForPath(pathname), [pathname])
  const entity = useMemo(() => entityFromPath(pathname, search, workflow.entityType), [pathname, search, workflow.entityType])

  useEffect(() => {
    if (!contextContract) return
    setWorkflow(workflow.key, workflow.step, entity)
  }, [contextContract?.workspaceId, pathname, search, workflow.key, workflow.step, entity.type, entity.id, setWorkflow])

  return null
}
