import { create } from 'zustand'
import { User, Clinic, UserRole, RoleCapabilities } from '@/types'
import * as api from '@/utils/api'
import { useGuestStore } from './guest.store'
import { useAIStore } from './ai.store'
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
  canManageClinicSettings?: boolean
  canManageFinance?: boolean
  ownDataOnly?: boolean
  readOnly?: boolean
  [key: string]: string | boolean | string[] | undefined
}

export const ORG_ROLES: Record<string, RoleConfig> = {
  owner: {
    label: 'Руководитель',
    icon: '👔',
    pages: ['dashboard', 'schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'audit', 'agent-activity', 'backup', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-labs', 'diagnostics-results', 'profile', 'bi', 'patient-inbox', 'workflow'],
    canSeeSalary: true,
    canSeeSuperAdmin: true,
    canAddStaff: true,
    canSeeAudit: true,
    canBackup: true,
    canManageClinicSettings: true,
    canManageFinance: true,
  },
  director: {
    label: 'Руководитель',
    icon: '👔',
    pages: ['dashboard', 'schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'audit', 'agent-activity', 'backup', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-labs', 'diagnostics-results', 'profile', 'bi', 'patient-inbox', 'workflow'],
    canSeeSalary: true,
    canSeeReports: true,
    canAddStaff: true,
    canSeeExpenses: true,
    canSeeAudit: true,
    canBackup: true,
    canManageClinicSettings: true,
    canManageFinance: true,
  },
  admin: {
    label: 'Администратор',
    icon: '💼',
    pages: ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-results', 'profile', 'patient-inbox', 'workflow'],
    canSeeSalary: false,
    canSeeExpenses: false,
    canAddStaff: true,
    canManageClinicSettings: true,
    canManageFinance: true,
  },
  doctor: { label: 'Врач', icon: '👨‍⚕️', pages: ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'lab', 'reminders', 'school', 'treatment-plans', 'dental-chart', 'diagnostics-referrals', 'diagnostics-results', 'profile'], canSeeSalary: false, canSeeOwnSalary: true, ownDataOnly: true },
  assistant: { label: 'Ассистент', icon: '🤝', pages: ['schedule', 'patients', 'visits', 'documents', 'reminders', 'shop', 'school', 'diagnostics-referrals', 'profile'], canSeeSalary: false, ownDataOnly: true, readOnly: true },
  reception: { label: 'Регистратор', icon: '📋', pages: ['schedule', 'patients', 'documents', 'reminders', 'shop', 'profile'], canAddStaff: false, readOnly: true },
  accountant: { label: 'Бухгалтер', icon: '📊', pages: ['analytics', 'finance', 'cashier', 'pricelist', 'dashboard', 'profile'], canSeeSalary: true, canSeeExpenses: true, canManageFinance: true },
  laboratory: { label: 'Лаборатория', icon: '🔬', pages: ['lab', 'shop', 'diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories', 'diagnostics-results', 'profile'] },
  lab: { label: 'Лаборатория', icon: '🔬', pages: ['lab', 'shop', 'diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories', 'diagnostics-results', 'profile'] },
  manager: { label: 'Менеджер', icon: '🧭', pages: ['dashboard', 'schedule', 'patients', 'analytics', 'staff', 'promotions', 'shop', 'profile'], canSeeReports: true, canAddStaff: true },
  intern: { label: 'Стажёр', icon: '🌱', pages: ['schedule', 'patients', 'visits', 'documents', 'school', 'profile'], ownDataOnly: true, readOnly: true },
  // External learner, not clinic staff — maps to the backend's zero-permission
  // STUDENT role (roleMatrix.ts). Without this entry, resolveRoleInfo() below
  // fell through to ORG_ROLES.doctor for any STUDENT with a clinic membership,
  // handing full patient-record access to someone the server grants nothing.
  student: { label: 'Студент', icon: '🎓', pages: ['school', 'profile'], ownDataOnly: true, readOnly: true },
  diagnostic_center: { label: 'Диагностический центр', icon: '🔬', pages: ['diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-results', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings', 'profile'] },
  lab_diagnostic: { label: 'Лаборатория', icon: '🔬', pages: ['diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories', 'diagnostics-results', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings', 'profile'] },
}

export const PLATFORM_ROLES: Record<string, RoleConfig> = {
  superadmin: {
    label: 'Super Admin',
    icon: '⚙️',
    pages: ['admin', 'audit', 'agent-activity', 'backup', 'analytics', 'settings', 'security', 'quality',
      'diagnostics', 'diagnostics-centers', 'diagnostics-labs',
      'platform-finance', 'ai-governance', 'support', 'profile', 'bi', 'supplier'],
    canSeeSalary: false,
    canSeeSuperAdmin: true,
    canAddStaff: false,
    canSeeAudit: true,
    canBackup: true,
    canManageClinicSettings: true,
    canManageFinance: true,
  },
  support: { label: 'Поддержка', icon: '🛟', pages: ['admin', 'analytics', 'settings', 'profile'] },
  developer: { label: 'Разработчик', icon: '🛠️', pages: ['admin', 'quality', 'analytics', 'settings', 'audit', 'agent-activity', 'backup', 'profile', 'security'] },
  user: { label: 'Пользователь', icon: '👤', pages: ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile'] },
  verified: { label: 'Проверенный', icon: '✅', pages: ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile'] },
}

/** Clinic settings ACL: Руководитель (owner/director) + Администратор. */
export function canManageClinicSettings(role: string | null | undefined): boolean {
  const r = normalizeRole(role)
  return r === 'owner' || r === 'director' || r === 'admin' || r === 'superadmin'
}

/** Приём оплаты в CRM: только руководитель и администратор. */
export function canAcceptPayment(role: string | null | undefined): boolean {
  return canManageClinicSettings(role)
}

function normalizeRole(role: string | undefined | null): string {
  const raw = String(role || 'user').toLowerCase()
  // Retired role: cashier duties belong to admin
  if (raw === 'cashier') return 'admin'
  // Backend OWNER ≈ frontend Руководитель
  if (raw === 'owner') return 'owner'
  return raw
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
  permissions: string[]
  pages: string[]
  effectiveRole: string | null
  capabilities: {
    canSeeSalary: boolean
    canAddStaff: boolean
    canSeeAudit: boolean
    canBackup: boolean
    canSeeReports: boolean
    canSeeExpenses: boolean
    canManageClinicSettings: boolean
    canManageFinance: boolean
    ownDataOnly: boolean
    readOnly: boolean
  }
  loading: boolean
  error: string | null
  _restoring: boolean
  _restorePromise: Promise<void> | null

  login: (loginStr: string, password: string) => Promise<boolean>
  loginWithGoogle: (idToken: string) => Promise<boolean>
  logout: () => void
  register: (formData: RegisterFormData) => Promise<boolean>
  forgotPassword: (loginStr: string) => Promise<unknown>
  refresh: () => Promise<void>
  restoreSession: () => Promise<void>
  setActiveClinic: (clinicId: string) => Promise<void>
  switchClinic: (clinicId: string | null) => Promise<void>
  addStaffMember: (staffData: StaffData) => Promise<User | false>
  getClinicStaff: (clinicId: string) => User[]

  can: (action: string) => boolean
  allClinics: Clinic[]
  allUsers: User[]
}

function normalizeUser(raw: any) {
  if (!raw) return raw
  const name = raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim() || raw.email
  const photoUrl = raw.photoUrl || raw.avatar || undefined
  return {
    ...raw,
    name,
    photoUrl,
    avatar: raw.avatar || photoUrl || undefined,
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
  const activeMembership = pickActiveMembership(
    mapActiveMembership(me.activeMembership),
    memberships,
  )
  return { 
    user, 
    memberships, 
    activeMembership, 
    permissions: me.permissions || [], 
    pages: me.pages || [],
    effectiveRole: me.effectiveRole || null,
    capabilities: me.capabilities || {
      canSeeSalary: false,
      canAddStaff: false,
      canSeeAudit: false,
      canBackup: false,
      canSeeReports: false,
      canSeeExpenses: false,
      canManageClinicSettings: false,
      canManageFinance: false,
      ownDataOnly: false,
      readOnly: false,
    }
  }
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
  if (m.clinic) return m.clinic as Clinic
  if (m.clinicId) return { id: m.clinicId, name: 'Клиника' } as Clinic
  return null
}

function resolveRole(activeMembership: Membership | null, user: User | null): string {
  return normalizeRole(activeMembership?.role || user?.platformRole || user?.role || 'user')
}

function resolveRoleInfo(activeMembership: Membership | null, user: User | null): RoleConfig {
  const resolvedRole = resolveRole(activeMembership, user)
  // Prefer org ACL whenever the resolved role is a clinic role (OWNER/ADMIN/…).
  // Do NOT require activeMembership: switch-clinic historically returned only
  // tokens and wiped membership, which previously fell through to PLATFORM user
  // and hid clinic-settings from the sidebar.
  if (ORG_ROLES[resolvedRole]) return ORG_ROLES[resolvedRole]
  if (activeMembership) return ORG_ROLES.doctor
  return PLATFORM_ROLES[resolvedRole] || PLATFORM_ROLES.user
}

/** Pick active membership from login/me payload, falling back to first clinic. */
function pickActiveMembership(
  active: Membership | null,
  memberships: Membership[],
): Membership | null {
  if (active?.clinicId) return active
  return memberships[0] || null
}

/**
 * Put a successful sign-in into the store.
 *
 * Shared by password and Google sign-in: both endpoints return the same
 * payload, and a second copy of this that drifted by one field would give one
 * of the two a different permission picture.
 */
async function applySignIn(set: (partial: Partial<AuthState>) => void, result: any): Promise<void> {
  const { accessToken, refreshToken } = result.tokens || result
  api.setTokens(accessToken, refreshToken)

  // The sign-in response already carries memberships (see auth.routes.ts).
  // Only fall back to a second /me round trip for older/partial responses —
  // this keeps sign-in resilient to a transient /me failure.
  let user = normalizeUser(result.user)
  let memberships = mapMemberships(result.memberships || [])
  let activeMembership = pickActiveMembership(
    mapActiveMembership(result.activeMembership),
    memberships,
  )
  let permissions: string[] = Array.isArray(result.permissions) ? result.permissions : []
  let pages: string[] = Array.isArray(result.pages) ? result.pages : []
  let effectiveRole: string | null = result.effectiveRole || null
  let capabilities = result.capabilities || {
    canSeeSalary: false,
    canAddStaff: false,
    canSeeAudit: false,
    canBackup: false,
    canSeeReports: false,
    canSeeExpenses: false,
    canManageClinicSettings: false,
    canManageFinance: false,
    ownDataOnly: false,
    readOnly: false,
  }

  // Only the absence of the `memberships` key means the response used an
  // older/partial contract — an explicit empty array is a valid "no clinics
  // yet" state and must not trigger an extra round trip.
  if (!user || result.memberships === undefined) {
    const me = await hydrateAuthFromMe()
    user = me.user
    memberships = me.memberships
    activeMembership = pickActiveMembership(me.activeMembership, memberships)
    permissions = me.permissions
    pages = me.pages
    effectiveRole = me.effectiveRole
    capabilities = me.capabilities
  }

  set({
    user,
    token: accessToken,
    refreshToken,
    clinic: buildClinicFromMembership(activeMembership),
    clinics: memberships,
    activeMembership,
    activeClinic: buildClinicFromMembership(activeMembership),
    permissions,
    pages,
    effectiveRole,
    capabilities,
    loading: false,
    error: null,
  })
  useGuestStore.getState().clearGuest()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  clinic: null,
  clinics: [],
  activeMembership: null,
  activeClinic: null,
  permissions: [],
  pages: [],
  effectiveRole: null,
  capabilities: { canSeeSalary: false, canAddStaff: false, canSeeAudit: false, canBackup: false, canSeeReports: false, canSeeExpenses: false, canManageClinicSettings: false, canManageFinance: false, ownDataOnly: false, readOnly: false },
  loading: false,
  error: null,
  _restoring: false,
  _restorePromise: null,

  // ─── Derived helpers (do NOT use getters on the state object —
  // Zustand Object.assign freezes getters into stale snapshots on set()).
  can: (action: string) => {
    const s = get()
    const ri = resolveRoleInfo(s.activeMembership, s.user)
    return ri ? !!ri[action] : false
  },
  allClinics: [..._seedStore.clinics],
  allUsers: [..._seedStore.users],

  // ─── Session restoration ───
  restoreSession: async () => {
    const stored = api.loadTokens()
    if (!stored?.accessToken && !stored?.refreshToken) {
      set({ loading: false })
      return
    }
    // Prevent concurrent restores (e.g. sidebar + layout both reacting to a
    // context switch at the same time). Callers that `await` this must wait for
    // the in-flight restore rather than returning early: RequirePage renders a
    // spinner while `loading` is true, so an early return handed the caller a
    // resolved promise while the UI was still blocked.
    const inFlight = get()._restorePromise
    if (inFlight) return inFlight

    const run = (async () => {
      set({ loading: true, _restoring: true })
      try {
        const me = await hydrateAuthFromMe()
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
          permissions: me.permissions,
          pages: me.pages,
          effectiveRole: me.effectiveRole || null,
          capabilities: me.capabilities,
        })
      } catch {
        api.clearTokens()
        set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, permissions: [], effectiveRole: null })
      } finally {
        // Always in `finally`: leaving `loading` true on any path freezes every
        // RequirePage-wrapped screen behind a spinner with no way to recover.
        set({ loading: false, _restoring: false, _restorePromise: null })
      }
    })()

    set({ _restorePromise: run })
    return run
  },

  // ─── Login ───
  login: async (loginStr, password) => {
    set({ loading: true, error: null })
    try {
      await applySignIn(set, await api.login(loginStr, password))
      return true
    } catch (err) {
      set({ loading: false, error: (err as Error).message || 'Login failed' })
      return false
    }
  },

  /**
   * Sign in with a Google ID token.
   *
   * `POST /auth/google` answers with the same payload `/auth/login` does — the
   * backend builds both from one function for exactly this reason — so the
   * store applies it through the same path. Anything else would leave a Google
   * user in a subtly different state than a password user.
   */
  loginWithGoogle: async (idToken) => {
    set({ loading: true, error: null })
    try {
      await applySignIn(set, await api.googleSignIn(idToken))
      return true
    } catch (err) {
      set({ loading: false, error: (err as Error).message || 'Google sign-in failed' })
      return false
    }
  },

  // ─── Logout ───
  logout: () => {
    try { useAIStore.getState().resetAI() } catch { /* ignore */ }
    api.clearTokens()
    set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, permissions: [], pages: [], effectiveRole: null, capabilities: { canSeeSalary: false, canAddStaff: false, canSeeAudit: false, canBackup: false, canSeeReports: false, canSeeExpenses: false, canManageClinicSettings: false, canManageFinance: false, ownDataOnly: false, readOnly: false }, loading: false, error: null })
  },

  // ─── Register ───
  register: async (formData) => {
    set({ loading: true, error: null })
    try {
      const result = await api.register(formData)
      const { accessToken, refreshToken } = result.tokens || result
      if (accessToken) api.setTokens(accessToken, refreshToken)

      let user = normalizeUser(result.user)
      let memberships = mapMemberships(result.memberships || [])
      let activeMembership = pickActiveMembership(
        mapActiveMembership(result.activeMembership),
        memberships,
      )
      let permissions: string[] = Array.isArray(result.permissions) ? result.permissions : []

      if (accessToken && (!user || result.memberships === undefined)) {
        const me = await hydrateAuthFromMe()
        user = me.user
        memberships = me.memberships
        activeMembership = pickActiveMembership(me.activeMembership, memberships)
        permissions = me.permissions
      }

      set({
        user,
        token: accessToken || null,
        refreshToken: refreshToken || null,
        clinic: buildClinicFromMembership(activeMembership),
        clinics: memberships,
        activeMembership,
        activeClinic: buildClinicFromMembership(activeMembership),
        permissions,
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
      set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, permissions: [] })
      throw err
    }
  },

  // ─── Switch clinic ───
  switchClinic: async (clinicId) => {
    try {
      const result = await api.switchClinic(clinicId)
      if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken ?? null)

      // API may return only tokens (legacy). Never wipe membership — rebuild
      // from the local clinics list or re-hydrate /me.
      let activeMembership = mapActiveMembership(result?.activeMembership)
      if (!activeMembership && clinicId) {
        activeMembership = get().clinics.find((m) => m.clinicId === clinicId) || null
      }
      if (!activeMembership) {
        const me = await hydrateAuthFromMe()
        activeMembership = pickActiveMembership(
          clinicId
            ? me.memberships.find((m) => m.clinicId === clinicId) || me.activeMembership
            : me.activeMembership,
          me.memberships,
        )
set({
            user: me.user,
            clinics: me.memberships,
            token: result?.accessToken || get().token,
            refreshToken: result?.refreshToken ?? get().refreshToken,
            activeMembership,
            clinic: buildClinicFromMembership(activeMembership),
            activeClinic: buildClinicFromMembership(activeMembership),
            permissions: me.permissions,
            pages: me.pages,
            effectiveRole: me.effectiveRole || null,
            capabilities: me.capabilities,
          })
          return
      }

      set({
        token: result?.accessToken || get().token,
        refreshToken: result?.refreshToken ?? get().refreshToken,
        activeMembership,
        clinic: buildClinicFromMembership(activeMembership),
        activeClinic: buildClinicFromMembership(activeMembership),
        permissions: Array.isArray(result?.permissions) ? result.permissions : get().permissions,
        pages: Array.isArray(result?.pages) ? result.pages : get().pages,
        effectiveRole: result?.effectiveRole || get().effectiveRole,
        capabilities: result.capabilities || get().capabilities,
      })
    } catch (err) {
      set({ error: (err as Error).message || 'Failed to switch clinic' })
      throw err
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
        _seedStore.users = [..._seedStore.users, newUser]
        return newUser
      }
    } catch (err) { console.error('API addStaff failed:', err) }
    const newUser = { ...staffData, id: gid() } as User
    _seedStore.users = [..._seedStore.users, newUser]
    return newUser
  },

  getClinicStaff: (clinicId) => _seedStore.users.filter(u => u.clinicId === clinicId),
}))

// ─── useAuth hook (drop-in replacement for AuthContext) ───

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const clinic = useAuthStore((s) => s.clinic)
  const clinics = useAuthStore((s) => s.clinics)
  const activeMembership = useAuthStore((s) => s.activeMembership)
  const activeClinic = useAuthStore((s) => s.activeClinic)
  const permissions = useAuthStore((s) => s.permissions)
  const pages = useAuthStore((s) => s.pages)
  const effectiveRole = useAuthStore((s) => s.effectiveRole)
  const capabilities = useAuthStore((s) => s.capabilities)
  const loading = useAuthStore((s) => s.loading)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const logout = useAuthStore((s) => s.logout)
  const register = useAuthStore((s) => s.register)
  const forgotPassword = useAuthStore((s) => s.forgotPassword)
  const addStaffMember = useAuthStore((s) => s.addStaffMember)
  const getClinicStaff = useAuthStore((s) => s.getClinicStaff)
  const switchClinic = useAuthStore((s) => s.switchClinic)
  const can = useAuthStore((s) => s.can)
  const allClinics = useAuthStore((s) => s.allClinics)
  const allUsers = useAuthStore((s) => s.allUsers)

  const role = resolveRole(activeMembership, user) as UserRole
  const roleInfo = resolveRoleInfo(activeMembership, user)
  const mode = activeMembership ? ('workspace' as const) : ('personal' as const)

return {
    user,
    clinic,
    clinics,
    activeMembership,
    activeClinic,
    mode,
    loading,
    error,
    login,
    loginWithGoogle,
    logout,
    register,
    forgotPassword,
    addStaffMember,
    getClinicStaff,
    switchClinic,
    isAuthenticated: !!user,
    role,
    roleInfo,
    pages,
    capabilities,
    effectiveRole,
    permissions,
    can,
    allClinics,
    allUsers,
  }
}
