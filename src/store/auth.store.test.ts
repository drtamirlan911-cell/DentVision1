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
    const expected = ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', 'accountant', 'laboratory', 'manager', 'intern']
    expected.forEach(r => expect(ORG_ROLES[r]).toBeDefined())
    expect(ORG_ROLES.cashier).toBeUndefined()
    expect(ORG_ROLES.admin.canManageClinicSettings).toBe(true)
    expect(ORG_ROLES.admin.pages).toContain('finance')
    expect(ORG_ROLES.admin.pages).toContain('clinic-settings')
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

describe('auth store - clinic settings visibility', () => {
  it('OWNER membership exposes clinic-settings after login', async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: '1', name: 'Owner', role: 'OWNER', email: 'owner@dentvision.kz' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
      memberships: [
        {
          id: 'm1',
          clinicId: 'c1',
          role: 'OWNER',
          clinic: { id: 'c1', name: 'Demo' },
        },
      ],
      activeMembership: {
        id: 'm1',
        clinicId: 'c1',
        role: 'OWNER',
        clinic: { id: 'c1', name: 'Demo' },
      },
    } as any)

    await useAuthStore.getState().login('owner@dentvision.kz', 'Demo1234!')
    const state = useAuthStore.getState()
    expect(state.activeMembership?.role).toBe('owner')
    expect(state.can('canManageClinicSettings')).toBe(true)
  })

  it('switchClinic without activeMembership in response keeps clinic role', async () => {
    useAuthStore.setState({
      user: { id: '1', name: 'Owner', role: 'owner' } as any,
      clinics: [
        {
          id: 'm1',
          clinicId: 'c1',
          role: 'owner',
          status: 'active',
          joinedAt: new Date().toISOString(),
          clinic: { id: 'c1', name: 'Demo' } as any,
        },
      ],
      activeMembership: {
        id: 'm1',
        clinicId: 'c1',
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
        clinic: { id: 'c1', name: 'Demo' } as any,
      },
      clinic: { id: 'c1', name: 'Demo' } as any,
    })

    vi.mocked(api.switchClinic).mockResolvedValue({
      accessToken: 'at2',
      refreshToken: 'rt2',
      // legacy: no activeMembership
    } as any)

    await useAuthStore.getState().switchClinic('c1')
    const state = useAuthStore.getState()
    expect(state.activeMembership?.clinicId).toBe('c1')
    expect(state.activeMembership?.role).toBe('owner')
    expect(state.can('canManageClinicSettings')).toBe(true)
  })

  it('user.role OWNER without membership still gets clinic-settings ACL', () => {
    useAuthStore.setState({
      user: { id: '1', name: 'Owner', role: 'owner', platformRole: 'owner' } as any,
      activeMembership: null,
      clinics: [],
    })
    expect(useAuthStore.getState().can('canManageClinicSettings')).toBe(true)
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
