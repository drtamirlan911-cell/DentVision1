import { create } from 'zustand'
import { User, Clinic, UserRole, RoleCapabilities } from '@/types'
import * as api from '@/utils/api'
import { API_URL } from '@/utils/apiOrigin'
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
  owner: { label: 'Руководитель', icon: '👔', pages: ['dashboard', 'schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'audit', 'agent-activity', 'ai-approvals', 'backup', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-labs', 'diagnostics-results', 'profile', 'bi', 'patient-inbox', 'workflow'], canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true, canManageClinicSettings: true, canManageFinance: true },
  director: { label: 'Руководитель', icon: '👔', pages: ['dashboard', 'schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'audit', 'agent-activity', 'ai-approvals', 'backup', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-labs', 'diagnostics-results', 'profile', 'bi', 'patient-inbox', 'workflow'], canSeeSalary: true, canSeeReports: true, canAddStaff: true, canSeeExpenses: true, canSeeAudit: true, canBackup: true, canManageClinicSettings: true, canManageFinance: true },
  admin: { label: 'Администратор', icon: '💼', pages: ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-results', 'profile', 'patient-inbox', 'workflow', 'ai-approvals'], canSeeSalary: false, canSeeExpenses: false, canAddStaff: true, canManageClinicSettings: true, canManageFinance: true },
  doctor: { label: 'Врач', icon: '👨‍⚕️', pages: ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'lab', 'reminders', 'school', 'treatment-plans', 'dental-chart', 'diagnostics-referrals', 'diagnostics-results', 'profile', 'ai-approvals'], canSeeSalary: false, canSeeOwnSalary: true, ownDataOnly: true },
  assistant: { label: 'Ассистент', icon: '🤝', pages: ['schedule', 'patients', 'visits', 'documents', 'reminders', 'shop', 'school', 'diagnostics-referrals', 'diagnostics-results', 'profile'], canSeeSalary: false, ownDataOnly: true, readOnly: true },
  reception: { label: 'Регистратор', icon: '📋', pages: ['schedule', 'patients', 'documents', 'reminders', 'shop', 'profile'], canAddStaff: false, readOnly: true },
  accountant: { label: 'Бухгалтер', icon: '📊', pages: ['analytics', 'finance', 'cashier', 'pricelist', 'dashboard', 'profile'], canSeeSalary: true, canSeeExpenses: true, canManageFinance: true },
  laboratory: { label: 'Лаборатория', icon: '🔬', pages: ['lab', 'shop', 'diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories', 'diagnostics-results', 'profile'] },
  lab: { label: 'Лаборатория', icon: '🔬', pages: ['lab', 'shop', 'diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories', 'diagnostics-results', 'profile'] },
  manager: { label: 'Менеджер', icon: '🧭', pages: ['dashboard', 'schedule', 'patients', 'analytics', 'staff', 'promotions', 'shop', 'profile'], canSeeReports: true, canAddStaff: true },
  intern: { label: 'Стажёр', icon: '🌱', pages: ['schedule', 'patients', 'visits', 'documents', 'school', 'profile'], ownDataOnly: true, readOnly: true },
  student: { label: 'Студент', icon: '🎓', pages: ['school', 'profile'], ownDataOnly: true, readOnly: true },
  diagnostic_center: { label: 'Диагностический центр', icon: '🔬', pages: ['diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-results', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings', 'profile'] },
  lab_diagnostic: { label: 'Лаборатория', icon: '🔬', pages: ['diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories', 'diagnostics-results', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings', 'profile'] },
  patient: { label: 'Пациент', icon: 'patient', pages: ['profile', 'shop', 'school'] },
}

const PARTNER_ROLE_LABELS: Record<string, string> = {
  diagnostic_owner: 'Владелец диагностического центра',
  diagnostic_admin: 'Администратор диагностического центра',
  diagnostic_manager: 'Управляющий диагностического центра',
  diagnostic_operator: 'Оператор диагностического центра',
  radiologist: 'Рентгенолог',
  radiology_technician: 'Рентген-лаборант',
  diagnostic_reception: 'Регистратура диагностического центра',
  diagnostic_finance: 'Финансы диагностического центра',
  diagnostic_quality: 'Контроль качества диагностики',
  medical_lab_owner: 'Владелец медицинской лаборатории',
  medical_lab_admin: 'Администратор медицинской лаборатории',
  medical_lab_manager: 'Управляющий медицинской лаборатории',
  medical_lab_reception: 'Регистратура медицинской лаборатории',
  medical_lab_technician: 'Лаборант',
  medical_lab_validator: 'Валидатор результатов',
  medical_lab_doctor: 'Врач лаборатории',
  medical_lab_finance: 'Финансы медицинской лаборатории',
  medical_lab_quality: 'Контроль качества лаборатории',
  dental_lab_owner: 'Владелец зуботехнической лаборатории',
  dental_lab_admin: 'Администратор зуботехнической лаборатории',
  dental_lab_manager: 'Управляющий зуботехнической лаборатории',
  lab_coordinator: 'Координатор лаборатории',
  dental_technician: 'Зубной техник',
  cad_designer: 'CAD-дизайнер',
  ceramist: 'Керамист',
  orthodontic_technician: 'Ортодонтический техник',
  qc_specialist: 'Контроль качества лаборатории',
  lab_finance: 'Финансы лаборатории',
};

export const PLATFORM_ROLES: Record<string, RoleConfig> = {
  superadmin: { label: 'Super Admin', icon: '⚙️', pages: ['admin', 'audit', 'agent-activity', 'ai-approvals', 'backup', 'analytics', 'settings', 'security', 'quality', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'platform-finance', 'ai-governance', 'support', 'profile', 'bi', 'supplier'], canSeeSalary: false, canSeeSuperAdmin: true, canAddStaff: false, canSeeAudit: true, canBackup: true, canManageClinicSettings: true, canManageFinance: true },
  support: { label: 'Поддержка', icon: '🛟', pages: ['admin', 'analytics', 'settings', 'profile'] },
  developer: { label: 'Разработчик', icon: '🛠️', pages: ['admin', 'quality', 'analytics', 'settings', 'audit', 'agent-activity', 'ai-approvals', 'backup', 'profile', 'security'] },
  user: { label: 'Пользователь', icon: '👤', pages: ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile'] },
  verified: { label: 'Проверенный', icon: '✅', pages: ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile'] },
}

export function canManageClinicSettings(role: string | null | undefined): boolean {
  const r = normalizeRole(role)
  return r === 'owner' || r === 'director' || r === 'admin' || r === 'superadmin'
}

export function canAcceptPayment(role: string | null | undefined): boolean { return canManageClinicSettings(role) }

function normalizeRole(role: string | undefined | null): string {
  const raw = String(role || 'user').toLowerCase()
  if (raw === 'cashier') return 'admin'
  if (raw === 'owner') return 'owner'
  return raw
}

interface Membership { id: string; clinicId: string; role: string; spec?: string | null; department?: string | null; status: string; joinedAt: string; clinic?: Clinic }
interface RegisterFormData { name?: string; firstName?: string; lastName?: string; city?: string; country?: string; phone?: string; email?: string; login: string; password: string; [key: string]: unknown }
interface StaffData { clinicId?: string; login?: string; password?: string; [key: string]: unknown }
const _seedStore: { clinics: Clinic[]; users: User[] } = { clinics: [...INIT_CLINICS], users: [...INIT_USERS] }

export interface WorkspaceContext {
  id: string; scopeType: string; scopeId: string; organizationId?: string;
  name: string; roleKey: string; roleLabel: string; personType?: string;
  logo?: string | null; joinedAt?: string; role?: string; level?: string;
  clinic?: unknown; supplier?: unknown; academy?: unknown;
}

interface AuthState {
  user: User | null; token: string | null; refreshToken: string | null; clinic: Clinic | null; clinics: Membership[]; workspaceContexts: WorkspaceContext[]; activeWorkspace: WorkspaceContext | null; activeMembership: Membership | null; activeClinic: Clinic | null; permissions: string[]; pages: string[]; effectiveRole: string | null
  capabilities: { canSeeSalary: boolean; canAddStaff: boolean; canSeeAudit: boolean; canBackup: boolean; canSeeReports: boolean; canSeeExpenses: boolean; canManageClinicSettings: boolean; canManageFinance: boolean; ownDataOnly: boolean; readOnly: boolean }
  loading: boolean; error: string | null; _restoring: boolean; _restorePromise: Promise<void> | null
  login: (loginStr: string, password: string) => Promise<boolean>; loginWithGoogle: (idToken: string) => Promise<boolean>; logout: () => void; register: (formData: RegisterFormData) => Promise<boolean>; forgotPassword: (loginStr: string) => Promise<unknown>; refresh: () => Promise<void>; restoreSession: () => Promise<void>; setActiveClinic: (clinicId: string) => Promise<void>; switchClinic: (clinicId: string | null) => Promise<void>; switchWorkspace: (workspace: WorkspaceContext) => Promise<void>; addStaffMember: (staffData: StaffData) => Promise<User | false>; getClinicStaff: (clinicId: string) => User[]
  can: (action: string) => boolean; allClinics: Clinic[]; allUsers: User[]
}

function normalizeUser(raw: any) { if (!raw) return raw; const name = raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim() || raw.email; const photoUrl = raw.photoUrl || raw.avatar || undefined; return { ...raw, name, photoUrl, avatar: raw.avatar || photoUrl || undefined, platformRole: normalizeRole(raw.platformRole || raw.role), role: normalizeRole(raw.role) } }
function mapMemberships(raw: any[]): Membership[] { return (raw || []).map((m: any) => ({ id: m.id || m.clinicId, clinicId: m.clinicId, role: normalizeRole(m.role), spec: m.spec || null, department: m.department || null, status: m.status || 'active', joinedAt: m.joinedAt || new Date().toISOString(), clinic: m.clinic ? { ...m.clinic, type: m.clinic.type || 'clinic' } : null })) }
function mapActiveMembership(raw: any): Membership | null { if (!raw) return null; return mapMemberships([raw])[0] || null }
async function hydrateAuthFromMe() { const me = await api.getMe() as any; const user = normalizeUser(me.user); const memberships = mapMemberships(me.memberships || []); const activeMembership = pickActiveMembership(mapActiveMembership(me.activeMembership), memberships); return { user, memberships, activeMembership, permissions: me.permissions || [], pages: me.pages || [], effectiveRole: me.effectiveRole || null, capabilities: me.capabilities || { canSeeSalary: false, canAddStaff: false, canSeeAudit: false, canBackup: false, canSeeReports: false, canSeeExpenses: false, canManageClinicSettings: false, canManageFinance: false, ownDataOnly: false, readOnly: false } } }
function getTokenClinicId(token: string | null | undefined): string | null { try { const payload = token?.split('.')[1]; if (!payload) return null; return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).clinicId || null } catch { return null } }
function buildClinicFromMembership(m: Membership | null): Clinic | null { if (!m) return null; if (m.clinic) return m.clinic as Clinic; if (m.clinicId) return { id: m.clinicId, name: 'Клиника' } as Clinic; return null }
function resolveRole(activeMembership: Membership | null, user: User | null): string { return normalizeRole(activeMembership?.role || user?.platformRole || user?.role || 'user') }
export function getRoleDisplayLabel(role: string | null | undefined): string {
  const resolvedRole = normalizeRole(role);
  if (ORG_ROLES[resolvedRole]) return ORG_ROLES[resolvedRole].label;
  if (PARTNER_ROLE_LABELS[resolvedRole]) return PARTNER_ROLE_LABELS[resolvedRole];
  if (PLATFORM_ROLES[resolvedRole]) return PLATFORM_ROLES[resolvedRole].label;
  return resolvedRole === 'user' ? 'Участник' : resolvedRole;
}

function resolveRoleInfo(activeMembership: Membership | null, user: User | null): RoleConfig {
  const resolvedRole = resolveRole(activeMembership, user);
  if (ORG_ROLES[resolvedRole]) return ORG_ROLES[resolvedRole];
  const partnerLabel = PARTNER_ROLE_LABELS[resolvedRole];
  if (partnerLabel) return { label: partnerLabel, icon: 'partner', pages: [] };
  if (activeMembership) return ORG_ROLES.doctor;
  return PLATFORM_ROLES[resolvedRole] || PLATFORM_ROLES.user;
}
function pickActiveMembership(active: Membership | null, memberships: Membership[]): Membership | null { if (active?.clinicId) return active; return memberships[0] || null }

async function applySignIn(set: (partial: Partial<AuthState>) => void, result: any): Promise<void> {
  let workspaceContexts: WorkspaceContext[] = []
  try { workspaceContexts = (await api.getMyContexts()).contexts || [] } catch { /* workspace list is non-blocking */ }
  const { accessToken, refreshToken } = result.tokens || result
  api.setTokens(accessToken, refreshToken)
  let user = normalizeUser(result.user); let memberships = mapMemberships(result.memberships || []); let activeMembership = pickActiveMembership(mapActiveMembership(result.activeMembership), memberships)
  let permissions: string[] = Array.isArray(result.permissions) ? result.permissions : []; let pages: string[] = Array.isArray(result.pages) ? result.pages : []; let effectiveRole: string | null = result.effectiveRole || null
  let capabilities = result.capabilities || { canSeeSalary: false, canAddStaff: false, canSeeAudit: false, canBackup: false, canSeeReports: false, canSeeExpenses: false, canManageClinicSettings: false, canManageFinance: false, ownDataOnly: false, readOnly: false }
  if (!user || result.memberships === undefined) { const me = await hydrateAuthFromMe(); user = me.user; memberships = me.memberships; activeMembership = pickActiveMembership(me.activeMembership, memberships); permissions = me.permissions; pages = me.pages; effectiveRole = me.effectiveRole; capabilities = me.capabilities }
  set({ user, token: accessToken, refreshToken, clinic: buildClinicFromMembership(activeMembership), clinics: memberships, workspaceContexts, activeWorkspace: workspaceContexts.find((w) => w.scopeType === 'CLINIC' && w.scopeId === (user as any)?.clinicId) || workspaceContexts[0] || null, activeMembership, activeClinic: buildClinicFromMembership(activeMembership), permissions, pages, effectiveRole, capabilities, loading: false, error: null })
  useGuestStore.getState().clearGuest()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null, token: null, refreshToken: null, clinic: null, clinics: [], workspaceContexts: [], activeWorkspace: null, activeMembership: null, activeClinic: null, permissions: [], pages: [], effectiveRole: null,
  capabilities: { canSeeSalary: false, canAddStaff: false, canSeeAudit: false, canBackup: false, canSeeReports: false, canSeeExpenses: false, canManageClinicSettings: false, canManageFinance: false, ownDataOnly: false, readOnly: false },
  loading: false, error: null, _restoring: false, _restorePromise: null,
  can: (action: string) => { const s = get(); const ri = resolveRoleInfo(s.activeMembership, s.user); return ri ? !!ri[action] : false },
  allClinics: [..._seedStore.clinics], allUsers: [..._seedStore.users],

  restoreSession: async () => {
    const stored = api.loadTokens(); if (!stored?.accessToken && !stored?.refreshToken) { set({ loading: false }); return }
    const inFlight = get()._restorePromise; if (inFlight) return inFlight
    const run = (async () => { set({ loading: true, _restoring: true }); try { const me = await hydrateAuthFromMe(); let accessToken = stored.accessToken; let refreshToken = stored.refreshToken; if (me.activeMembership?.clinicId && !getTokenClinicId(accessToken)) { const switched = await api.switchClinic(me.activeMembership.clinicId); accessToken = switched.accessToken || accessToken; refreshToken = switched.refreshToken || refreshToken; api.setTokens(accessToken, refreshToken) } set({ user: me.user, token: accessToken, refreshToken, clinic: buildClinicFromMembership(me.activeMembership), clinics: me.memberships, workspaceContexts: get().workspaceContexts, activeWorkspace: get().activeWorkspace, activeMembership: me.activeMembership, activeClinic: buildClinicFromMembership(me.activeMembership), permissions: me.permissions, pages: me.pages, effectiveRole: me.effectiveRole || null, capabilities: me.capabilities }) } catch { api.clearTokens(); set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], workspaceContexts: [], activeWorkspace: null, activeMembership: null, activeClinic: null, permissions: [], pages: [], effectiveRole: null }) } finally { set({ loading: false, _restoring: false, _restorePromise: null }) } })(); set({ _restorePromise: run }); return run
  },

  login: async (loginStr, password) => { set({ loading: true, error: null }); try { await applySignIn(set, await api.login(loginStr, password)); return true } catch (err) { set({ loading: false, error: (err as Error).message || 'Login failed' }); return false } },
  loginWithGoogle: async (idToken) => { set({ loading: true, error: null }); try { await applySignIn(set, await api.googleSignIn(idToken)); return true } catch (err) { set({ loading: false, error: (err as Error).message || 'Google sign-in failed' }); return false } },
  logout: () => { try { useAIStore.getState().resetAI() } catch { /* ignore */ }; api.clearTokens(); set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, permissions: [], pages: [], effectiveRole: null, workspaceContexts: [], activeWorkspace: null, capabilities: { canSeeSalary: false, canAddStaff: false, canSeeAudit: false, canBackup: false, canSeeReports: false, canSeeExpenses: false, canManageClinicSettings: false, canManageFinance: false, ownDataOnly: false, readOnly: false }, loading: false, error: null }) },
  register: async (formData) => { set({ loading: true, error: null }); try { const result = await api.register(formData); const { accessToken, refreshToken } = result.tokens || result; if (accessToken) api.setTokens(accessToken, refreshToken); let user = normalizeUser(result.user); let memberships = mapMemberships(result.memberships || []); let activeMembership = pickActiveMembership(mapActiveMembership(result.activeMembership), memberships); let permissions: string[] = Array.isArray(result.permissions) ? result.permissions : []; if (accessToken && (!user || result.memberships === undefined)) { const me = await hydrateAuthFromMe(); user = me.user; memberships = me.memberships; activeMembership = pickActiveMembership(me.activeMembership, memberships); permissions = me.permissions } set({ user, token: accessToken || null, refreshToken: refreshToken || null, clinic: buildClinicFromMembership(activeMembership), clinics: memberships, workspaceContexts: (await api.getMyContexts().catch(() => ({ contexts: [] }))).contexts || [], activeWorkspace: null, activeMembership, activeClinic: buildClinicFromMembership(activeMembership), permissions, loading: false, error: null }); useGuestStore.getState().clearGuest(); return true } catch (err) { set({ loading: false, error: (err as Error).message || 'Registration failed' }); return false } },
  forgotPassword: async (loginStr) => { try { return await api.forgotPassword(loginStr) } catch { return { error: 'Ошибка соединения' } } },

  refresh: async () => {
    try {
      const stored = api.loadTokens(); if (!stored?.refreshToken) throw new Error('No refresh token')
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: stored.refreshToken }) })
      if (!res.ok) throw new Error('Refresh failed')
      const raw = await res.json(); const data = raw.data || raw
      api.setTokens(data.accessToken, data.refreshToken); set({ token: data.accessToken, refreshToken: data.refreshToken })
    } catch (err) { api.clearTokens(); set({ user: null, token: null, refreshToken: null, clinic: null, clinics: [], activeMembership: null, activeClinic: null, permissions: [] }); throw err }
  },

  switchClinic: async (clinicId) => { try { const result = await api.switchClinic(clinicId); if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken ?? null); let activeMembership = mapActiveMembership(result?.activeMembership); if (!activeMembership && clinicId) activeMembership = get().clinics.find((m) => m.clinicId === clinicId) || null; set({ token: result?.accessToken || get().token, refreshToken: result?.refreshToken ?? get().refreshToken, activeMembership, clinic: buildClinicFromMembership(activeMembership), activeClinic: buildClinicFromMembership(activeMembership), permissions: Array.isArray(result?.permissions) ? result.permissions : get().permissions, pages: Array.isArray(result?.pages) ? result.pages : get().pages, effectiveRole: result?.effectiveRole || get().effectiveRole, capabilities: result.capabilities || get().capabilities, activeWorkspace: get().workspaceContexts.find((w) => w.scopeType === 'CLINIC' && w.scopeId === clinicId) || get().activeWorkspace }) } catch (err) { set({ error: (err as Error).message || 'Failed to switch clinic' }); throw err } },
  switchWorkspace: async (workspace) => { try { const result = await api.switchWorkspace(workspace.scopeType, workspace.scopeId); if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken ?? null); const me = await hydrateAuthFromMe(); const activeWorkspace = get().workspaceContexts.find((w) => w.id === workspace.id) || workspace; set({ user: me.user, token: result?.accessToken || get().token, refreshToken: result?.refreshToken ?? get().refreshToken, clinics: me.memberships, activeMembership: me.memberships.find((m) => m.clinicId === activeWorkspace.scopeId) || null, clinic: activeWorkspace.scopeType === 'CLINIC' ? buildClinicFromMembership(me.memberships.find((m) => m.clinicId === activeWorkspace.scopeId) || null) : null, activeClinic: activeWorkspace.scopeType === 'CLINIC' ? buildClinicFromMembership(me.memberships.find((m) => m.clinicId === activeWorkspace.scopeId) || null) : null, permissions: Array.isArray(result?.permissions) ? result.permissions : me.permissions, pages: Array.isArray(result?.pages) ? result.pages : me.pages, effectiveRole: result?.effectiveRole || me.effectiveRole || null, capabilities: result?.capabilities || me.capabilities, activeWorkspace, error: null }); try { useAIStore.getState().resetAI() } catch {} } catch (err) { set({ error: (err as Error).message || 'Failed to switch workspace' }); throw err } },
  setActiveClinic: async (clinicId) => { await get().switchClinic(clinicId) },
  addStaffMember: async (staffData) => { if (!staffData.clinicId || !staffData.login || !staffData.password) return false; try { const result = await api.upsertUser(staffData); if (result) { const newUser = { ...staffData, id: result.id || gid() } as User; _seedStore.users = [..._seedStore.users, newUser]; return newUser } } catch (err) { console.error('API addStaff failed:', err) } const newUser = { ...staffData, id: gid() } as User; _seedStore.users = [..._seedStore.users, newUser]; return newUser },
  getClinicStaff: (clinicId) => _seedStore.users.filter(u => u.clinicId === clinicId),
}))

export function useAuth() {
  const user = useAuthStore((s) => s.user); const workspaceContexts = useAuthStore((s) => s.workspaceContexts); const activeWorkspace = useAuthStore((s) => s.activeWorkspace); const clinic = useAuthStore((s) => s.clinic); const clinics = useAuthStore((s) => s.clinics); const activeMembership = useAuthStore((s) => s.activeMembership); const activeClinic = useAuthStore((s) => s.activeClinic); const permissions = useAuthStore((s) => s.permissions); const pages = useAuthStore((s) => s.pages); const effectiveRole = useAuthStore((s) => s.effectiveRole); const capabilities = useAuthStore((s) => s.capabilities); const loading = useAuthStore((s) => s.loading); const error = useAuthStore((s) => s.error); const login = useAuthStore((s) => s.login); const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle); const logout = useAuthStore((s) => s.logout); const register = useAuthStore((s) => s.register); const forgotPassword = useAuthStore((s) => s.forgotPassword); const addStaffMember = useAuthStore((s) => s.addStaffMember); const getClinicStaff = useAuthStore((s) => s.getClinicStaff); const switchClinic = useAuthStore((s) => s.switchClinic); const switchWorkspace = useAuthStore((s) => s.switchWorkspace); const can = useAuthStore((s) => s.can); const allClinics = useAuthStore((s) => s.allClinics); const allUsers = useAuthStore((s) => s.allUsers)
  const role = resolveRole(activeMembership, user) as UserRole; const roleInfo = resolveRoleInfo(activeMembership, user); const mode = activeMembership ? ('workspace' as const) : ('personal' as const)
  return { user, clinic, clinics, workspaceContexts, activeWorkspace, activeMembership, activeClinic, mode, loading, error, login, loginWithGoogle, logout, register, forgotPassword, addStaffMember, getClinicStaff, switchClinic, switchWorkspace, isAuthenticated: !!user, role, roleInfo, pages, capabilities, effectiveRole, permissions, can, allClinics, allUsers }
}
