import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/api', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  loadTokens: vi.fn(),
  switchClinic: vi.fn(),
  upsertUser: vi.fn(),
  forgotPassword: vi.fn(),
}))

import { useAuthStore, ORG_ROLES, PLATFORM_ROLES } from './auth.store'
import * as api from '@/utils/api'

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    clinic: null,
    clinics: [],
    activeMembership: null,
    activeClinic: null,
    loading: false,
    error: null,
  })
  vi.clearAllMocks()
})

describe('auth store - initial state', () => {
  it('has correct defaults', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.clinics).toEqual([])
  })
})

describe('auth store - login', () => {
  it('sets user on success', async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: '1', name: 'Doctor' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
      memberships: [{ clinicId: 'c1', role: 'doctor' }],
      activeMembership: { clinicId: 'c1', role: 'doctor' },
    } as any)

    const result = await useAuthStore.getState().login('doc', 'pass')
    expect(result).toBe(true)
    expect(useAuthStore.getState().user?.name).toBe('Doctor')
    expect(useAuthStore.getState().token).toBe('at')
  })

  it('sets error on failure', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('Invalid'))
    const result = await useAuthStore.getState().login('bad', 'pass')
    expect(result).toBe(false)
    expect(useAuthStore.getState().error).toBe('Invalid')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('sets loading during login', async () => {
    let resolveLogin: any
    vi.mocked(api.login).mockImplementation(() => new Promise(r => { resolveLogin = r }))
    const loginPromise = useAuthStore.getState().login('doc', 'pass')
    expect(useAuthStore.getState().loading).toBe(true)
    resolveLogin({ user: { id: '1' }, tokens: { accessToken: 'at', refreshToken: 'rt' } })
    await loginPromise
    expect(useAuthStore.getState().loading).toBe(false)
  })
})

describe('auth store - logout', () => {
  it('clears all state and tokens', () => {
    useAuthStore.setState({ user: { id: '1', name: 'Test' } as any, token: 'abc' })
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.clinic).toBeNull()
    expect(api.clearTokens).toHaveBeenCalled()
  })
})

describe('auth store - clinics', () => {
  it('stores memberships on login', async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: '1', name: 'Doc' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
      memberships: [
        { clinicId: 'c1', role: 'doctor' },
        { clinicId: 'c2', role: 'assistant' },
      ],
      activeMembership: { clinicId: 'c1', role: 'doctor' },
    } as any)
    await useAuthStore.getState().login('doc', 'pass')
    expect(useAuthStore.getState().clinics).toHaveLength(2)
  })
})

describe('auth store - register', () => {
  it('sets user on success', async () => {
    vi.mocked(api.register).mockResolvedValue({
      user: { id: '2', name: 'New' },
      tokens: { accessToken: 'at2', refreshToken: 'rt2' },
      memberships: [],
    } as any)
    const result = await useAuthStore.getState().register({ login: 'new', password: 'pass' })
    expect(result).toBe(true)
    expect(useAuthStore.getState().user?.name).toBe('New')
  })

  it('sets error on failure', async () => {
    vi.mocked(api.register).mockRejectedValue(new Error('Duplicate'))
    const result = await useAuthStore.getState().register({ login: 'dup', password: 'pass' })
    expect(result).toBe(false)
    expect(useAuthStore.getState().error).toBe('Duplicate')
  })
})

describe('auth store - staff', () => {
  it('addStaffMember returns false when missing fields', async () => {
    const result = await useAuthStore.getState().addStaffMember({})
    expect(result).toBe(false)
  })
})

describe('ORG_ROLES', () => {
  it('has all required roles', () => {
    const expected = ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', 'cashier', 'accountant', 'laboratory', 'manager', 'intern']
    expected.forEach(r => expect(ORG_ROLES[r]).toBeDefined())
  })

  it('owner has canSeeSuperAdmin', () => {
    expect(ORG_ROLES.owner.canSeeSuperAdmin).toBe(true)
  })

  it('doctor has ownDataOnly', () => {
    expect(ORG_ROLES.doctor.ownDataOnly).toBe(true)
  })

  it('reception is readOnly', () => {
    expect(ORG_ROLES.reception.readOnly).toBe(true)
  })

  it('all roles have pages array', () => {
    Object.values(ORG_ROLES).forEach(role => {
      expect(Array.isArray(role.pages)).toBe(true)
      expect(role.pages.length).toBeGreaterThan(0)
    })
  })
})

describe('PLATFORM_ROLES', () => {
  it('has superadmin, support, user, verified', () => {
    expect(PLATFORM_ROLES.superadmin).toBeDefined()
    expect(PLATFORM_ROLES.support).toBeDefined()
    expect(PLATFORM_ROLES.user).toBeDefined()
    expect(PLATFORM_ROLES.verified).toBeDefined()
  })

  it('superadmin canSeeSuperAdmin', () => {
    expect(PLATFORM_ROLES.superadmin.canSeeSuperAdmin).toBe(true)
  })
})
