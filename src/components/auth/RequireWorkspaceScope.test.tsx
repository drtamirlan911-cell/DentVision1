import { describe, expect, it } from 'vitest'
import { workspaceScopeAllowed } from './RequireWorkspaceScope'

describe('workspaceScopeAllowed', () => {
  const makeUser = (organizationType: string) => ({ id: 'u1', email: 'u@example.com', organizationType }) as Parameters<typeof workspaceScopeAllowed>[0]

  it('allows the matching diagnostic-center workspace', () => {
    expect(workspaceScopeAllowed(makeUser('DIAGNOSTIC_CENTER'), 'OWNER', 'DIAGNOSTIC_CENTER')).toBe(true)
  })

  it('allows the matching laboratory workspace', () => {
    expect(workspaceScopeAllowed(makeUser('LABORATORY'), 'LABORATORY', 'LABORATORY')).toBe(true)
  })

  it('rejects clinic context from partner workspaces', () => {
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'OWNER', 'DIAGNOSTIC_CENTER')).toBe(false)
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'OWNER', 'LABORATORY')).toBe(false)
  })

  it('allows superadmin to inspect partner workspaces', () => {
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'SUPERADMIN', 'DIAGNOSTIC_CENTER')).toBe(true)
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'SUPERADMIN', 'LABORATORY')).toBe(true)
  })
})
