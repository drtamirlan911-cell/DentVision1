/**
 * Canonical client-side context contract.
 *
 * Product invariant:
 * Identity -> Active Workspace -> Organization -> Branch -> Role
 * -> Permission -> Data Scope -> AI Context -> Workflow
 *
 * This is an adapter around the existing IAM workspace payload, not a second
 * authorization system. Server IAM remains authoritative.
 */

export type WorkspaceScopeType =
  | 'CLINIC'
  | 'DIAGNOSTIC_CENTER'
  | 'LABORATORY'
  | 'SUPPLIER'
  | 'LECTURER'
  | 'ACADEMY'
  | 'PARTNER'
  | string

export interface WorkspaceContextContract {
  workspaceId: string
  scopeType: WorkspaceScopeType
  organizationId: string | null
  branchId: string | null
  roleKey: string
  roleLabel: string
  permissions: string[]
  dataScope: {
    organizationId: string | null
    branchId: string | null
    ownDataOnly: boolean
  }
  participant: string | null
  queue: {
    key: string
    itemCount?: number | null
  }
  entity: {
    type: string
    id: string | null
  }
  workflow: {
    key: string
    step: string | null
  }
}

export interface WorkspaceContextSource {
  id: string
  scopeType: string
  scopeId?: string | null
  organizationId?: string | null
  branchId?: string | null
  roleKey?: string | null
  role?: string | null
  roleLabel?: string | null
  permissions?: string[]
  ownDataOnly?: boolean
  personType?: string | null
}

let activeWorkspaceContext: WorkspaceContextContract | null = null

export function setActiveWorkspaceContext(context: WorkspaceContextContract | null): void {
  activeWorkspaceContext = context
}

export function getActiveWorkspaceContext(): WorkspaceContextContract | null {
  return activeWorkspaceContext
}

const normalize = (value?: string | null) => {
  const v = String(value || '').trim()
  return v || null
}

export function workspaceContextFrom(source: WorkspaceContextSource, fallbackPermissions: string[] = []): WorkspaceContextContract {
  const organizationId = normalize(source.organizationId)
  const branchId = normalize(source.branchId)
  const roleKey = normalize(source.roleKey || source.role) || 'user'
  const permissions = Array.from(new Set([...(source.permissions || []), ...fallbackPermissions])).sort()

  return {
    workspaceId: source.id,
    scopeType: source.scopeType,
    organizationId,
    branchId,
    roleKey,
    roleLabel: normalize(source.roleLabel) || roleKey,
    permissions,
    dataScope: {
      organizationId,
      branchId,
      ownDataOnly: Boolean(source.ownDataOnly),
    },
    participant: normalize(source.personType),
    queue: {
      key: 'workspace',
      itemCount: null,
    },
    entity: {
      type: 'workspace',
      id: source.id,
    },
    workflow: {
      key: 'workspace',
      step: null,
    },
  }
}

export function workflowContext(
  context: WorkspaceContextContract,
  workflowKey: string,
  step?: string | null,
  queueKey?: string | null,
  entity?: { type: string; id: string | null },
): WorkspaceContextContract {
  return {
    ...context,
    queue: { ...context.queue, key: normalize(queueKey) || context.queue.key },
    entity: entity || context.entity,
    workflow: { key: workflowKey || 'workspace', step: normalize(step) },
  }
}

export function contextRequestHeaders(context: WorkspaceContextContract): Record<string, string> {
  const headers: Record<string, string> = {
    'X-DentVision-Workspace-Id': context.workspaceId,
    'X-DentVision-Role': context.roleKey,
  }
  if (context.organizationId) headers['X-DentVision-Organization-Id'] = context.organizationId
  if (context.branchId) headers['X-DentVision-Branch-Id'] = context.branchId
  if (context.workflow.key !== 'workspace') headers['X-DentVision-Workflow'] = context.workflow.key
  return headers
}
