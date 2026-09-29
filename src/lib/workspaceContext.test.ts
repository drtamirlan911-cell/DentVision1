import { describe, expect, it } from 'vitest'
import { contextRequestHeaders, workflowContext, workspaceContextFrom } from './workspaceContext'

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
    expect(context.entity).toEqual({ type: 'workspace', id: 'workspace-a' })
  })

  it('carries workflow and entity without changing authorization scope', () => {
    const context = workspaceContextFrom(source)
    const next = workflowContext(context, 'diagnostic-report', 'validation', { type: 'study', id: 'study-a' })
    expect(next.organizationId).toBe('org-a')
    expect(next.branchId).toBe('branch-a')
    expect(next.workflow).toEqual({ key: 'diagnostic-report', step: 'validation' })
    expect(next.entity).toEqual({ type: 'study', id: 'study-a' })
  })

  it('produces only context metadata headers, never resource ids as authorization proof', () => {
    const headers = contextRequestHeaders(workspaceContextFrom(source))
    expect(headers['X-DentVision-Organization-Id']).toBe('org-a')
    expect(headers['X-DentVision-Branch-Id']).toBe('branch-a')
    expect(headers['X-DentVision-Workspace-Id']).toBe('workspace-a')
  })
})
