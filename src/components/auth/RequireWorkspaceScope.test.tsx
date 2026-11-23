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

  it('allows the matching Academy owner workspace', () => {
    expect(workspaceScopeAllowed(makeUser('ACADEMY'), 'OWNER', 'ACADEMY')).toBe(true)
  })

  it('rejects a clinic from the Academy workspace', () => {
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'OWNER', 'ACADEMY')).toBe(false)
  })

  it('allows the canonical Academy owner context', () => {
    expect(workspaceScopeAllowed(makeUser('ACADEMY'), 'OWNER', 'ACADEMY')).toBe(true)
  })

  it('does not allow a clinic owner to enter the Academy owner workspace', () => {
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'OWNER', 'ACADEMY')).toBe(false)
    expect(workspaceScopeAllowed(makeUser('LECTURER'), 'OWNER', 'ACADEMY')).toBe(false)
  })

  it('allows superadmin to inspect Academy workspace routes', () => {
    expect(workspaceScopeAllowed(makeUser('CLINIC'), 'SUPERADMIN', 'ACADEMY')).toBe(true)
  })
})
