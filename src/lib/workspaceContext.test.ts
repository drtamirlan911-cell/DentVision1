import { describe, expect, it } from 'vitest'
import { contextRequestHeaders, selectWorkspaceContext, workflowContext, workspaceContextFrom } from './workspaceContext'

describe('workspace context contract', () => {
  const source = {
    id: 'workspace-a',
    scopeType: 'DIAGNOSTIC_CENTER',
    organizationId: 'org-a',
    branchId: 'branch-a',
    roleKey: 'diagnostic_owner',
    roleLabel: 'Владелец диагностического центра',
    permissions: ['diagnostics.read', 'diagnostics.write'],
    ownDataOnly: false,
    personType: 'DIAGNOSTIC_OWNER',
  }

  it('normalizes organization, branch, role, permissions and data scope into one contract', () => {
    const context = workspaceContextFrom(source)
    expect(context.workspaceId).toBe('workspace-a')
    expect(context.organizationId).toBe('org-a')
    expect(context.branchId).toBe('branch-a')
    expect(context.roleKey).toBe('diagnostic_owner')
    expect(context.dataScope).toEqual({ organizationId: 'org-a', branchId: 'branch-a', ownDataOnly: false })
    expect(context.queue).toEqual({ key: 'workspace', itemCount: null })
    expect(context.entity).toEqual({ type: 'workspace', id: 'workspace-a' })
  })

  it('carries workflow and entity without changing authorization scope', () => {
    const context = workspaceContextFrom(source)
    const next = workflowContext(context, 'diagnostic-report', 'validation', { type: 'study', id: 'study-a' }, 'worklist')
    expect(next.organizationId).toBe('org-a')
    expect(next.branchId).toBe('branch-a')
    expect(next.queue.key).toBe('worklist')
    expect(next.workflow).toEqual({ key: 'diagnostic-report', step: 'validation' })
    expect(next.entity).toEqual({ type: 'study', id: 'study-a' })
  })

  it('produces only context metadata headers, never resource ids as authorization proof', () => {
    const headers = contextRequestHeaders(workspaceContextFrom(source))
    expect(headers['X-DentVision-Organization-Id']).toBe('org-a')
    expect(headers['X-DentVision-Branch-Id']).toBe('branch-a')
    expect(headers['X-DentVision-Workspace-Id']).toBe('workspace-a')
  })

  it('prefers the exact active scope over the first membership', () => {
    const contexts = [
      { scopeId: 'supplier-a', organizationId: 'org-a' },
      { scopeId: 'supplier-b', organizationId: 'org-b' },
    ]
    expect(selectWorkspaceContext(contexts, { scopeId: 'supplier-b', organizationId: 'org-b' })?.scopeId).toBe('supplier-b')
  })

  it('falls back to the canonical organization id when the legacy scope is unavailable', () => {
    const contexts = [
      { scopeId: 'lecturer-a', organizationId: 'org-a' },
      { scopeId: 'lecturer-b', organizationId: 'org-b' },
    ]
    expect(selectWorkspaceContext(contexts, { organizationId: 'org-b' })?.scopeId).toBe('lecturer-b')
  })

  it('fails closed when the active identity does not match an available membership', () => {
    const contexts = [
      { scopeId: 'supplier-a', organizationId: 'org-a' },
      { scopeId: 'supplier-b', organizationId: 'org-b' },
    ]
    expect(selectWorkspaceContext(contexts, { scopeId: 'missing', organizationId: 'missing' })).toBeNull()
  })

  it('auto-selects only a sole membership when there is no active identity', () => {
    const single = [{ scopeId: 'supplier-a', organizationId: 'org-a' }]
    const multiple = [
      { scopeId: 'supplier-a', organizationId: 'org-a' },
      { scopeId: 'supplier-b', organizationId: 'org-b' },
    ]
    expect(selectWorkspaceContext(single)?.scopeId).toBe('supplier-a')
    expect(selectWorkspaceContext(multiple)).toBeNull()
    expect(selectWorkspaceContext([])).toBeNull()
  })
})
