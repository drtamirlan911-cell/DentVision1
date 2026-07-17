import { create } from 'zustand'
import { User, Clinic } from '@/types'
import * as api from '@/utils/api'

interface Membership {
  id: string
  clinicId: string
  clinicName: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  memberships: Membership[]
  activeMembership: Membership | null
  activeClinic: Clinic | null
  loading: boolean
  error: string | null

  login: (loginStr: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  restoreSession: () => Promise<void>
  setActiveClinic: (clinicId: string) => Promise<void>
}

function mapMemberships(raw: any[]): Membership[] {
  return (raw || []).map((m: any) => ({
    id: m.id || m.clinicId,
    clinicId: m.clinicId,
    clinicName: m.clinic?.name || m.clinicName || '',
    role: m.role || 'staff',
  }))
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  memberships: [],
  activeMembership: null,
  activeClinic: null,
  loading: false,
  error: null,

  login: async (loginStr, password) => {
    set({ loading: true, error: null })
    try {
      const result = await api.login(loginStr, password)
      const { accessToken, refreshToken } = result.tokens || result
      api.setTokens(accessToken, refreshToken)

      let user = result.user
      let memberships = result.memberships || []
      let activeMembership = result.activeMembership || null

      if (!user) {
        const me = await api.getMe() as any
        user = me.user
        memberships = me.memberships || []
        activeMembership = me.activeMembership || null
      }

      set({
        user,
        token: accessToken,
        refreshToken,
        memberships: mapMemberships(memberships),
        activeMembership,
        activeClinic: activeMembership?.clinic || null,
        loading: false,
        error: null,
      })
    } catch (err) {
      set({ loading: false, error: (err as Error).message || 'Login failed' })
      throw err
    }
  },

  logout: () => {
    api.clearTokens()
    set({
      user: null,
      token: null,
      refreshToken: null,
      memberships: [],
      activeMembership: null,
      activeClinic: null,
      loading: false,
      error: null,
    })
  },

  refresh: async () => {
    try {
      const stored = api.loadTokens()
      if (!stored?.refreshToken) throw new Error('No refresh token')
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
        }
      )
      if (!res.ok) throw new Error('Refresh failed')
      const raw = await res.json()
      const data = raw.data || raw
      api.setTokens(data.accessToken, data.refreshToken)
      set({ token: data.accessToken, refreshToken: data.refreshToken })
    } catch (err) {
      api.clearTokens()
      set({
        user: null,
        token: null,
        refreshToken: null,
        memberships: [],
        activeMembership: null,
        activeClinic: null,
      })
      throw err
    }
  },

  restoreSession: async () => {
    const stored = api.loadTokens()
    if (!stored?.accessToken) {
      set({ loading: false })
      return
    }
    set({ loading: true })
    try {
      const me = await api.getMe() as any
      const user = me.user
      const memberships = me.memberships || []
      const activeMembership = me.activeMembership || null
      set({
        user,
        token: stored.accessToken,
        refreshToken: stored.refreshToken,
        memberships: mapMemberships(memberships),
        activeMembership,
        activeClinic: activeMembership?.clinic || null,
        loading: false,
      })
    } catch {
      api.clearTokens()
      set({
        user: null,
        token: null,
        refreshToken: null,
        memberships: [],
        activeMembership: null,
        activeClinic: null,
        loading: false,
      })
    }
  },

  setActiveClinic: async (clinicId) => {
    try {
      const result = await api.switchClinic(clinicId)
      if (result?.accessToken) {
        api.setTokens(result.accessToken, result.refreshToken ?? null)
        set({ token: result.accessToken, refreshToken: result.refreshToken ?? null })
      }
      const activeMembership = result.activeMembership || null
      set({
        activeMembership,
        activeClinic: activeMembership?.clinic || null,
      })
    } catch (err) {
      set({ error: (err as Error).message || 'Failed to switch clinic' })
    }
  },
}))
