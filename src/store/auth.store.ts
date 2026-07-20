import { create } from 'zustand'
import { User, Clinic, UserRole } from '@/types'
import * as api from '@/utils/api'
import { useGuestStore } from './guest.store'
import { INIT_CLINICS, INIT_USERS, gid } from '@/utils/constants'

// ─── Role config (moved from AuthContext) ───

interface RoleConfig {
  label: string
  icon: string
  pages: string[]
  canSeeSalary?: boolean
  canSeeSuperAdmin?: boolean
  canAddStaff?: boolean
  canSeeAudit?: boolean
  canBackup?: boolean
  canSeeReports?: boolean
  canSeeExpenses?: boolean
  ownDataOnly?: boolean
  readOnly?: boolean
  [key: string]: string | boolean | string[] | undefined
}

export const ORG_ROLES: Record<string, RoleConfig> = {
  owner: { label: 'Владелец', icon: '👑', pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','staff','audit','backup','shop','school','analytics','settings'], canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true },
  director: { label: 'Руководитель', icon: '👔', pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','staff','audit','backup','shop','school','analytics','settings'], canSeeSalary: true, canSeeReports: true, canAddStaff: true, canSeeExpenses: true, canSeeAudit: true, canBackup: true },
  admin: { label: 'Администратор', icon: '💼', pages: ['schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','reminders','promotions','inventory','staff','documents','shop','school','analytics','settings'], canSeeSalary: false, canSeeExpenses: false, canAddStaff: true },
  doctor: { label: 'Врач', icon: '👨‍⚕️', pages: ['schedule','patients','medical-card','visits','icd10','documents','lab','ai','reminders','school'], canSeeSalary: false, ownDataOnly: true },
  assistant: { label: 'Ассистент', icon: '🤝', pages: ['schedule','patients','visits','documents','reminders','shop','school'], canSeeSalary: false, ownDataOnly: true, readOnly: true },
  reception: { label: 'Регистратор', icon: '📋', pages: ['schedule','patients','documents','reminders','shop'], canAddStaff: false, readOnly: true },
  cashier: { label: 'Кассир', icon: '💰', pages: ['cashier','pricelist','receipts','shop'], readOnly: true },
  accountant: { label: 'Бухгалтер', icon: '📊', pages: ['analytics','cashier','pricelist','dashboard'], canSeeSalary: true, canSeeExpenses: true },
  laboratory: { label: 'Лаборатория', icon: '🔬', pages: ['lab','shop'] },
  manager: { label: 'Менеджер', icon: '🧭', pages: ['dashboard','schedule','patients','analytics','staff','promotions','shop'], canSeeReports: true, canAddStaff: true },
  intern: { label: 'Стажёр', icon: '🌱', pages: ['schedule','patients','visits','documents','school'], ownDataOnly: true, readOnly: true },
}

export const PLATFORM_ROLES: Record<string, RoleConfig> = {
  superadmin: { label: 'Super Admin', icon: '⚙️', pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','admin','audit','backup','shop','school','analytics','settings'], canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true },
  support: { label: 'Поддержка', icon: '🛟', pages: ['admin','analytics','settings'] },
  user: { label: 'Пользователь', icon: '👤', pages: ['shop','school','ai'] },
  verified: { label: 'Проверенный', icon: '✅', pages: ['shop','school','ai'] },
}

// ─── Membership type ───

interface Membership {
  id: string
  clinicId: string
  role: string
  spec?: string | null
  department?: string | null
  status: string
  joinedAt: string
  clinic?: Clinic
}

interface RegisterFormData {
  name?: string
  firstName?: string
  lastName?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  login: string
  password: string
  [key: string]: unknown
}

interface StaffData {
  clinicId?: string
  login?: string
  password?: string
  [key: string]: unknown
}

// ─── Seed data store ───

const _seedStore: { clinics: Clinic[]; users: User[] } = {
  clinics: [...INIT_CLINICS],
  users: [...INIT_USERS],
}

// ─── Zustand store ───

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  clinic: Clinic | null
  clinics: Membership[]
  activeMembership: Membership | null
  activeClinic: Clinic | null
  loading: boolean
  error: string | null

  login: (loginStr: string, password: string) => Promise<boolean>
  logout: () => void
  register: (formData: RegisterFormData) => Promise<boolean>
  forgotPassword: (loginStr: string) => Promise<unknown>
  refresh: () => Promise<void>
  restoreSession: () => Promise<void>
  setActiveClinic: (clinicId: string) => Promise<void>
  switchClinic: (clinicId: string | null) => Promise<void>
  addStaffMember: (staffData: StaffData) => Promise<Record<string, unknown> | false>
  getClinicStaff: (clinicId: string) => User[]

  isAuthenticated: boolean
  role: UserRole | null
  roleInfo: RoleConfig | null
  mode: 'personal' | 'workspace'
  can: (action: string) => boolean
  allClinics: Clinic[]
  allUsers: User[]
}

function normalizeRole(role: string | undefined | null): string {
  return String(role || 'user').toLowerCase()
}

function normalizeUser(raw: any) {
  if (!raw) return raw
  const name = raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim() || raw.email
  return {
    ...raw,
    name,
    platformRole: normalizeRole(raw.platformRole || raw.role),
    role: normalizeRole(raw.role),
  }
}

function mapMemberships(raw: any[]): Membership[] {
  return (raw || []).map((m: any) => ({
    id: m.id || m.clinicId,
    clinicId: m.clinicId,
    role: normalizeRole(m.role),
    spec: m.spec || null,
    department: m.department || null,
    status: m.status || 'active',
    joinedAt: m.joinedAt || new Date().toISOString(),
    clinic: m.clinic ? { ...m.clinic, type: m.clinic.type || 'clinic' } : null,
  }))
}

function mapActiveMembership(raw: any): Membership | null {
  if (!raw) return null
  const mapped = mapMemberships([raw])
  return mapped[0] || null
}

async function hydrateAuthFromMe() {
  const me = await api.getMe() as any
  const user = normalizeUser(me.user)
  const memberships = mapMemberships(me.memberships || [])
  const activeMembership = mapActiveMembership(me.activeMembership)
  return { user, memberships, activeMembership }
}

function getTokenClinicId(token: string | null | undefined): string | null {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).clinicId || null
  } catch {
    return null
  }
}

function buildClinicFromMembership(m: Membership | null): Clinic | null {
  if (!m) return null
  return (m.clinic as Clinic) || null
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  clinic: null,
  clinics: [],
  activeMembership: null,
  activeClinic: null,
  loading: false,
  error: null,

  // ─── Derived state ───
  get isAuthenticated() { return !!get().user },
  get role() { const s = get(); return (s.activeMembership?.role || s.user?.platformRole || s.user?.role || null) as UserRole | null },
  get roleInfo() {
    const s = get()
    const resolvedRole = s.activeMembership?.role || s.user?.platformRole || s.user?.role || 'user'
    return s.activeMembership
      ? (ORG_ROLES[resolvedRole] || ORG_ROLES.doctor)
      : (PLATFORM_ROLES[resolvedRole] || PLATFORM_ROLES.user)
  },
  get mode() { return get().activeMembership ? 'workspace' as const : 'personal' as const },
  can: (action: string) => { const ri = get().roleInfo; return ri ? !!ri[action] : false },
  allClinics: _seedStore.clinics,
  allUsers: _seedStore.users,

  // ─── Session restoration ───
  restoreSession: async () => {
    const stored = api.loadTokens()
    if (!stored?.accessToken) {
      set({ loading: false })
      return
    }
    set({ loading: true })
    try {
      const me = await hydrateAuthFromMe()
      // Old sessions created before the workspace fix have no clinicId in
      // their JWT. Re-issue a clinic-scoped token so CRM API calls work.
      let accessToken = stored.accessToken
      let refreshToken = stored.refreshToken
      if (me.activeMembership?.clinicId && !getTokenClinicId(accessToken)) {
        const switched = await api.switchClinic(me.activeMembership.clinicId)
        accessToken = switched.accessToken || accessToken
        refreshToken = switched.refreshToken || refreshToken
        api.setTokens(accessToken, refreshToken)
      }
      set({
        user: me.user,
        token: accessToken,
        refreshToken,
        clinic: buildClinicFromMembership(me.activeMembership),
        clinics: me.memberships,
        activeMembership: me.activeMembership,
        activeClinic: buildClinicFromMembership(me.activeMembership),
        loading: false,
      })
    } catch {
      api.clearTokens()
      set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, loading: false })
    }
  },

  // ─── Login ───
  login: async (loginStr, password) => {
    set({ loading: true, error: null })
    try {
      const result = await api.login(loginStr, password)
      const { accessToken, refreshToken } = result.tokens || result
      api.setTokens(accessToken, refreshToken)

      const me = await hydrateAuthFromMe()

      set({
        user: me.user,
        token: accessToken,
        refreshToken,
        clinic: buildClinicFromMembership(me.activeMembership),
        clinics: me.memberships,
        activeMembership: me.activeMembership,
        activeClinic: buildClinicFromMembership(me.activeMembership),
        loading: false,
        error: null,
      })
      useGuestStore.getState().clearGuest()
      return true
    } catch (err) {
      set({ loading: false, error: (err as Error).message || 'Login failed' })
      return false
    }
  },

  // ─── Logout ───
  logout: () => {
    api.clearTokens()
    set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, loading: false, error: null })
  },

  // ─── Register ───
  register: async (formData) => {
    set({ loading: true, error: null })
    try {
      const result = await api.register(formData)
      const { accessToken, refreshToken } = result.tokens || result
      if (accessToken) api.setTokens(accessToken, refreshToken)

      const me = accessToken ? await hydrateAuthFromMe() : { user: result.user, memberships: [], activeMembership: null }

      set({
        user: me.user,
        token: accessToken || null,
        refreshToken: refreshToken || null,
        clinic: buildClinicFromMembership(me.activeMembership),
        clinics: me.memberships,
        activeMembership: me.activeMembership,
        activeClinic: buildClinicFromMembership(me.activeMembership),
        loading: false,
        error: null,
      })
      useGuestStore.getState().clearGuest()
      return true
    } catch (err) {
      set({ loading: false, error: (err as Error).message || 'Registration failed' })
      return false
    }
  },

  // ─── Forgot password ───
  forgotPassword: async (loginStr) => {
    try { return await api.forgotPassword(loginStr) } catch { return { error: 'Ошибка соединения' } }
  },

  // ─── Token refresh ───
  refresh: async () => {
    try {
      const stored = api.loadTokens()
      if (!stored?.refreshToken) throw new Error('No refresh token')
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/refresh`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: stored.refreshToken }) }
      )
      if (!res.ok) throw new Error('Refresh failed')
      const raw = await res.json()
      const data = raw.data || raw
      api.setTokens(data.accessToken, data.refreshToken)
      set({ token: data.accessToken, refreshToken: data.refreshToken })
    } catch (err) {
      api.clearTokens()
      set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null })
      throw err
    }
  },

  // ─── Switch clinic ───
  switchClinic: async (clinicId) => {
    try {
      const result = await api.switchClinic(clinicId)
      if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken ?? null)
      const activeMembership = result.activeMembership || null
      set({
        token: result.accessToken || get().token,
        refreshToken: result.refreshToken ?? get().refreshToken,
        activeMembership,
        clinic: buildClinicFromMembership(activeMembership),
        activeClinic: buildClinicFromMembership(activeMembership),
      })
    } catch (err) {
      set({ error: (err as Error).message || 'Failed to switch clinic' })
    }
  },

  // Alias for backward compatibility with AuthContext consumers
  setActiveClinic: async (clinicId) => { await get().switchClinic(clinicId) },

  // ─── Staff management ───
  addStaffMember: async (staffData) => {
    if (!staffData.clinicId || !staffData.login || !staffData.password) return false
    try {
      const result = await api.upsertUser(staffData)
      if (result) {
        const newUser = { ...staffData, id: result.id || gid() } as User
        _seedStore.users.push(newUser)
        return newUser
      }
    } catch (err) { console.error('API addStaff failed:', err) }
    const newUser = { ...staffData, id: gid() } as User
    _seedStore.users.push(newUser)
    return newUser
  },

  getClinicStaff: (clinicId) => _seedStore.users.filter(u => u.clinicId === clinicId),
}))

// ─── useAuth hook (drop-in replacement for AuthContext) ───

export function useAuth() {
  const state = useAuthStore()
  return {
    user: state.user,
    clinic: state.clinic,
    clinics: state.clinics,
    activeMembership: state.activeMembership,
    activeClinic: state.activeClinic,
    mode: state.mode,
    loading: state.loading,
    error: state.error,
    login: state.login,
    logout: state.logout,
    register: state.register,
    forgotPassword: state.forgotPassword,
    addStaffMember: state.addStaffMember,
    getClinicStaff: state.getClinicStaff,
    switchClinic: state.switchClinic,
    isAuthenticated: !!state.user,
    role: state.role,
    roleInfo: state.roleInfo,
    can: state.can,
    allClinics: state.allClinics,
    allUsers: state.allUsers,
  }
}
