// ═══════════════════════════════════════════════════════════════════
// DENTVISION API CLIENT — JWT authenticated
// ═══════════════════════════════════════════════════════════════════

import type {
  User,
  Clinic,
  Patient,
  Appointment,
  Receipt,
  LabOrder,
  Expense,
  InventoryItem,
  MedicalCard,
  Visit,
  Document,
  Promotion,
  Booking,
  Photo,
  Subscription,
  WaitingListItem,
  AuditLogEntry,
  ICD10Code,
  LoginResponse,
} from '../types';

const API_URL: string = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

// ─── Token Management ───
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;

export function setTokens(access: string | null, refresh: string | null): void {
  _accessToken = access;
  _refreshToken = refresh;
  if (access && refresh) {
    try { localStorage.setItem('dv_tokens', JSON.stringify({ access, refresh })); } catch { /* ignore */ }
  } else {
    try { localStorage.removeItem('dv_tokens'); } catch { /* ignore */ }
  }
}

export function loadTokens(): { accessToken: string; refreshToken: string } | null {
  try {
    const stored = localStorage.getItem('dv_tokens');
    if (stored) {
      const { access, refresh } = JSON.parse(stored);
      _accessToken = access;
      _refreshToken = refresh;
      return { accessToken: access, refreshToken: refresh };
    }
  } catch { /* ignore */ }
  return null;
}

export function clearTokens(): void {
  _accessToken = null;
  _refreshToken = null;
  try { localStorage.removeItem('dv_tokens'); } catch { /* ignore */ }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_accessToken || ''}`,
      },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    });
  } catch { /* ignore network errors */ }
  clearTokens();
}

export function getAccessToken(): string | null { return _accessToken; }

// ─── Token Refresh ───
async function refreshAccessToken(): Promise<string> {
  if (!_refreshToken) throw new Error('No refresh token');
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      if (!res.ok) throw new Error('Refresh failed');
      const raw = await res.json();
      const data = raw.data || raw;
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch (err) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw err;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// ─── Core API Request ───
async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  } else {
    // Fall back to guest token for anonymous access
    try {
      const guestData = localStorage.getItem('dv_guest');
      if (guestData) {
        const { guestToken } = JSON.parse(guestData);
        if (guestToken) headers['Authorization'] = `Bearer ${guestToken}`;
      }
    } catch { /* ignore */ }
  }

  const finalOptions: RequestInit = { ...options, headers };
  headers['Content-Type'] = 'application/json';

  let res = await fetch(`${API_URL}${path}`, finalOptions);
  let data = await res.json();

  if (res.status === 401 && (data.code === 'TOKEN_EXPIRED' || data.error?.includes('Невалидный')) && _refreshToken) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, finalOptions);
      data = await res.json();
    } catch {
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  // Backend wraps responses in { ok, data }. Unwrap for callers.
  return data.data !== undefined ? data.data : data;
}

// ─── Auth ───
export async function login(loginStr: string, password: string): Promise<LoginResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: loginStr, password }),
  });
}

export async function register(data: Partial<User> & { password: string }): Promise<any> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMe(): Promise<User> {
  return apiRequest('/api/auth/me');
}

export async function forgotPassword(login: string): Promise<any> {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: login }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<any> {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password: newPassword }),
  });
}

// ─── Workspaces (Membership) ───
export async function getMyClinics(): Promise<any[]> {
  return apiRequest('/api/auth/my-clinics');
}
export async function switchClinic(clinicId: string | null): Promise<any> {
  return apiRequest('/api/auth/switch-clinic', { method: 'POST', body: JSON.stringify({ clinicId }) });
}
export async function createClinic(data: any): Promise<any> {
  return apiRequest('/api/auth/clinics', { method: 'POST', body: JSON.stringify(data) });
}
export async function joinClinic(data: { code?: string; clinicId?: string }): Promise<any> {
  return apiRequest('/api/auth/join-clinic', { method: 'POST', body: JSON.stringify(data) });
}
export async function createInvitation(data: { clinicId: string; email?: string; role?: string; spec?: string }): Promise<any> {
  return apiRequest('/api/auth/invitations', { method: 'POST', body: JSON.stringify(data) });
}
export async function getInvitation(code: string): Promise<any> {
  return apiRequest(`/api/auth/invitations/lookup?code=${code}`);
}

// ─── Clinics ───
export async function getClinics(): Promise<Clinic[]> {
  const res = await apiRequest('/api/clinics');
  return res.data || res;
}

export async function getClinic(clinicId: string): Promise<Clinic> {
  return apiRequest(`/api/clinics/${clinicId}`);
}

// ─── Clinic Data (resource endpoints — clinicId from JWT) ───
export async function getPatients(clinicId: string): Promise<Patient[]> {
  return apiRequest('/api/patients');
}

export async function getPatient(id: string): Promise<Patient> {
  const patients = await apiRequest('/api/patients');
  return patients.find((p: any) => p.id === id);
}

export async function getAppointments(clinicId: string): Promise<Appointment[]> {
  return apiRequest('/api/appointments');
}

export async function getReceipts(clinicId: string): Promise<Receipt[]> {
  return apiRequest('/api/billing/invoices');
}

export async function getLabOrders(clinicId: string): Promise<LabOrder[]> {
  return Promise.resolve([]);
}

export async function getExpenses(clinicId: string): Promise<Expense[]> {
  return Promise.resolve([]);
}

export async function getInventory(clinicId: string): Promise<InventoryItem[]> {
  return apiRequest('/api/inventory');
}

export async function getPromotions(clinicId: string): Promise<Promotion[]> {
  return Promise.resolve([]);
}

export async function getBookings(clinicId: string): Promise<Booking[]> {
  return Promise.resolve([]);
}

// ─── Upserts (resource endpoints) ───
export async function upsertPatient(data: Partial<Patient>): Promise<any> {
  return apiRequest('/api/patients', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertAppointment(data: Partial<Appointment>): Promise<any> {
  return apiRequest('/api/appointments', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertReceipt(data: Partial<Receipt>): Promise<any> {
  return apiRequest('/api/billing/invoices', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertLabOrder(data: Partial<LabOrder>): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function upsertExpense(data: Partial<Expense>): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function upsertInventoryItem(data: Partial<InventoryItem>): Promise<any> {
  return apiRequest('/api/inventory', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertUser(data: Partial<User>): Promise<any> {
  return apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertSubscription(data: Partial<Subscription>): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function uploadPhoto(data: Partial<Photo>): Promise<any> {
  return apiRequest('/api/medical/images', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertPromotion(data: Partial<Promotion>): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function upsertBooking(data: Partial<Booking>): Promise<any> {
  return Promise.resolve({ ok: true });
}

// ─── Deletes (resource endpoints) ───
export async function deletePatient(id: string): Promise<any> {
  return apiRequest(`/api/patients/${id}`, { method: 'DELETE' });
}

export async function deleteAppointment(id: string): Promise<any> {
  return apiRequest(`/api/appointments/${id}`, { method: 'DELETE' });
}

export async function deleteReceipt(id: string): Promise<any> {
  return Promise.resolve({ ok: true, message: 'Invoice deletion not supported via API' });
}

export async function deletePhoto(id: string): Promise<any> {
  return apiRequest(`/api/files/${id}`, { method: 'DELETE' });
}

export async function deleteInventoryItem(id: string): Promise<any> {
  return apiRequest(`/api/inventory/${id}`, { method: 'DELETE' });
}

export async function deleteLabOrder(id: string): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function deleteExpense(id: string): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function deleteSubscription(id: string): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function deletePromotion(id: string): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function deleteBooking(id: string): Promise<any> {
  return Promise.resolve({ ok: true });
}

// ─── Public Booking ───
export async function getPublicClinic(clinicId: string): Promise<Clinic> {
  return apiRequest(`/api/public/clinic/${clinicId}`);
}

export async function submitBooking(data: Partial<Booking>): Promise<any> {
  return apiRequest('/api/public/booking', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Medical Cards ───
export async function getMedicalCard(patientId: string): Promise<MedicalCard> {
  return apiRequest(`/api/patients/${patientId}`);
}

export async function upsertMedicalCard(data: Partial<MedicalCard>): Promise<any> {
  return apiRequest('/api/medical/treatment-plan', { method: 'POST', body: JSON.stringify(data) });
}

// ─── ICD-10 ───
export async function getICD10(search: string): Promise<ICD10Code[]> {
  const q = search ? `?q=${encodeURIComponent(search)}` : '';
  return apiRequest(`/api/medical/icd10${q}`);
}

// ─── Visits ───
export async function getVisits(clinicId: string, patientId: string): Promise<Visit[]> {
  if (patientId) {
    return apiRequest(`/api/medical/patients/${patientId}/visits`);
  }
  return apiRequest('/api/medical/visits');
}

export async function upsertVisit(data: Partial<Visit>): Promise<any> {
  return apiRequest('/api/medical/visits', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Documents ───
export async function getDocuments(clinicId: string, patientId: string): Promise<Document[]> {
  return Promise.resolve([]);
}

export async function upsertDocument(data: Partial<Document>): Promise<any> {
  return apiRequest('/api/files/upload', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteDocument(id: string): Promise<any> {
  return apiRequest(`/api/files/${id}`, { method: 'DELETE' });
}

// ─── Audit Log ───
export async function getAuditLog(clinicId: string, limit: number = 100): Promise<AuditLogEntry[]> {
  return apiRequest(`/api/audit?limit=${limit}`);
}

// ─── Backup ───
export async function createBackup(clinicId: string): Promise<any> {
  return apiRequest('/api/audit/backup', { method: 'POST' });
}

// ─── Treatments ───
export async function upsertTreatment(data: any): Promise<any> {
  return apiRequest('/api/medical/treatment-plan', { method: 'POST', body: JSON.stringify(data) });
}

export async function getTreatments(clinicId: string): Promise<any[]> {
  return Promise.resolve([]);
}

// ─── Waiting List ───
export async function getWaitingList(clinicId: string): Promise<WaitingListItem[]> {
  return Promise.resolve([]);
}

// ─── Shop ───
export async function getShopCategories(): Promise<any> { return Promise.resolve([]); }
export async function getShopProducts(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return apiRequest(`/api/shop/products?${q}`);
}
export async function getShopProduct(id: string): Promise<any> { return apiRequest(`/api/shop/products/${id}`); }
export async function getShopSuppliers(): Promise<any> { return Promise.resolve([]); }
export async function createShopOrder(data: any): Promise<any> { return apiRequest('/api/shop/orders', { method: 'POST', body: JSON.stringify(data) }); }
export async function getShopOrders(clinicId: string): Promise<any> { return apiRequest('/api/shop/orders'); }
export async function createShopReview(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function toggleShopFavorite(data: any): Promise<any> { return apiRequest('/api/shop/favorites', { method: 'POST', body: JSON.stringify(data) }); }
export async function getShopFavorites(clinicId: string): Promise<any> { return apiRequest('/api/shop/favorites'); }

// ─── School ───
export async function getSchoolCourses(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return apiRequest(`/api/school/courses?${q}`);
}
export async function getSchoolCourse(id: string): Promise<any> { return apiRequest(`/api/school/courses/${id}`); }
export async function enrollCourse(data: any): Promise<any> { return apiRequest('/api/school/enrollments', { method: 'POST', body: JSON.stringify(data) }); }
export async function getEnrollments(userId: string): Promise<any> { return apiRequest('/api/school/enrollments'); }
export async function updateEnrollment(id: string, data: any): Promise<any> { return apiRequest(`/api/school/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function getSchoolClinicalCases(category: string): Promise<any> { return Promise.resolve([]); }
export async function getSchoolLibrary(params: Record<string, string> = {}): Promise<any> {
  return Promise.resolve([]);
}
export async function getSchoolCertificates(userId: string): Promise<any> { return Promise.resolve([]); }

// ─── Service Access ───
export async function getServiceAccess(clinicId: string): Promise<Record<string, boolean>> {
  return Promise.resolve({});
}

export async function setServiceAccess(clinicId: string, service: string, enabled: boolean): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function setServiceAccessBulk(clinicId: string, services: Record<string, boolean>): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function getPublicServiceAccess(clinicId: string): Promise<Record<string, boolean>> {
  return Promise.resolve({});
}

// ─── Notifications (unified Notification Center) ───
export interface NotificationInput {
  type: string
  category?: string
  clinicId?: string | null
  userId?: string | null
  title: string
  message?: string | null
  actionUrl?: string | null
}

export async function getNotifications(opts: { unread?: boolean; type?: string; limit?: number } = {}): Promise<any[]> {
  const q = new URLSearchParams()
  if (opts.unread) q.set('unread', 'true')
  if (opts.type) q.set('type', opts.type)
  if (opts.limit) q.set('limit', String(opts.limit))
  const qs = q.toString()
  return apiRequest(`/api/notifications${qs ? `?${qs}` : ''}`)
}

export async function getUnreadCount(): Promise<number> {
  const data = await apiRequest('/api/notifications/unread-count')
  return data.unread || data.count || 0
}

export async function createNotification(input: NotificationInput): Promise<any> {
  return apiRequest('/api/notifications', { method: 'POST', body: JSON.stringify(input) })
}

export async function markNotificationRead(id: string): Promise<any> {
  return apiRequest(`/api/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllNotificationsRead(): Promise<any> {
  return apiRequest('/api/notifications/read-all', { method: 'POST' })
}

// ─── Shop content management (superadmin) ───
export async function createShopCategory(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteShopCategory(id: string): Promise<any> { return Promise.resolve({ ok: true }); }
export async function createShopSupplier(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteShopSupplier(id: string): Promise<any> { return Promise.resolve({ ok: true }); }
export async function createShopProduct(data: any): Promise<any> { return apiRequest('/api/shop/products', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateShopProduct(id: string, data: any): Promise<any> { return apiRequest(`/api/shop/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteShopProduct(id: string): Promise<any> { return apiRequest(`/api/shop/products/${id}`, { method: 'DELETE' }); }

// ─── School content management (superadmin) ───
export async function createSchoolCourse(data: any): Promise<any> { return apiRequest('/api/school/courses', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateSchoolCourse(id: string, data: any): Promise<any> { return apiRequest(`/api/school/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteSchoolCourse(id: string): Promise<any> { return apiRequest(`/api/school/courses/${id}`, { method: 'DELETE' }); }
export async function createSchoolClinicalCase(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteSchoolClinicalCase(id: string): Promise<any> { return Promise.resolve({ ok: true }); }
export async function createSchoolLibraryItem(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteSchoolLibraryItem(id: string): Promise<any> { return Promise.resolve({ ok: true }); }

// ─── User Professional Profile (LinkedIn-style) ───
export async function getMyProfile(): Promise<any> { return Promise.resolve({}); }
export async function getPublicProfile(identifier: string): Promise<any> { return Promise.resolve({}); }
export async function updateMyProfile(data: any): Promise<any> { return Promise.resolve({ ok: true }); }

export async function addSkill(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteSkill(id: string): Promise<any> { return Promise.resolve({ ok: true }); }

export async function addCertificate(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteCertificate(id: string): Promise<any> { return Promise.resolve({ ok: true }); }

export async function addAchievement(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteAchievement(id: string): Promise<any> { return Promise.resolve({ ok: true }); }

export async function addPortfolioItem(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deletePortfolioItem(id: string): Promise<any> { return Promise.resolve({ ok: true }); }

export async function addCase(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function deleteCase(id: string): Promise<any> { return Promise.resolve({ ok: true }); }

// ─── AI Intelligence ───
export interface AIChatResponse {
  reply: string;
  skill: string;
  source?: string;
  data?: Record<string, unknown>;
  recommendations?: Array<Record<string, unknown>>;
  actions: Array<{ type: string; label: string; confidence: number; params?: Record<string, unknown>; requiresConfirmation?: boolean }>;
  suggestions: string[];
  proactive: Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }>;
  conversationContext: { turnCount: number; entities: Record<string, unknown> };
}
export async function aiChat(message: string, _history: Array<{ role: string; content: string }> = []): Promise<AIChatResponse> {
  const sessionId = (crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2);
  const res = await apiRequest('/api/ai/query', {
    method: 'POST',
    body: JSON.stringify({ text: message, sessionId }),
  });
  const d = res?.data || {};
  return {
    reply: d.message || '',
    skill: d.intent || 'general',
    source: 'ai',
    data: d,
    recommendations: undefined,
    actions: d.action
      ? [
          {
            type: d.action.type,
            label: d.action.type,
            confidence: 1,
            params: (d.action.payload as Record<string, unknown>) || {},
            requiresConfirmation: !!d.needsConfirmation,
          },
        ]
      : [],
    suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
    proactive: [],
    conversationContext: { turnCount: 0, entities: {} },
  } as AIChatResponse;
}
export async function aiProactive(): Promise<{ alerts: Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }> }> {
  const res = await apiRequest('/api/ai/proactive');
  const alerts = (res?.data?.alerts || []).map((a: any) => ({
    type: a.type || 'info',
    category: a.type || 'general',
    text: a.message || '',
    priority: a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0,
    action: a.action ? { type: a.action.type } : undefined,
  }));
  return { alerts };
}
export async function aiAction(action: string, params: Record<string, unknown> = {}): Promise<any> {
  return apiRequest('/api/ai/confirm', {
    method: 'POST',
    body: JSON.stringify({ actionId: action, confirmed: true, data: params }),
  });
}
export async function aiDigitalTwin(): Promise<any> {
  return apiRequest('/api/ai/digital-twin');
}

// ─── Admin (SuperAdmin) ───
export async function getAdminStats(): Promise<any> { return apiRequest('/api/admin/stats'); }
export async function getAdminClinics(): Promise<any> { return apiRequest('/api/admin/clinics'); }
export async function getAdminClinic(id: string): Promise<any> { return apiRequest(`/api/admin/clinics/${id}`); }
export async function createAdminClinic(data: any): Promise<any> { return apiRequest('/api/admin/clinics', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateAdminClinic(id: string, data: any): Promise<any> { return apiRequest(`/api/admin/clinics/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteAdminClinic(id: string): Promise<any> { return apiRequest(`/api/admin/clinics/${id}`, { method: 'DELETE' }); }
export async function toggleAdminClinic(id: string): Promise<any> { return apiRequest(`/api/admin/clinics/${id}/toggle`, { method: 'PATCH' }); }
export async function changeAdminClinicPlan(id: string, plan: string): Promise<any> { return apiRequest(`/api/admin/clinics/${id}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }); }
export async function extendAdminClinic(id: string, months: number): Promise<any> { return apiRequest(`/api/admin/clinics/${id}/extend`, { method: 'PATCH', body: JSON.stringify({ months }) }); }
export async function getAdminUsers(params?: { clinicId?: string; platformRole?: string }): Promise<any> {
  const q = new URLSearchParams();
  if (params?.clinicId) q.set('clinicId', params.clinicId);
  if (params?.platformRole) q.set('platformRole', params.platformRole);
  const qs = q.toString();
  return apiRequest(`/api/admin/users${qs ? '?' + qs : ''}`);
}
export async function createAdminUser(data: any): Promise<any> { return apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }); }
export async function resetAdminUserPassword(id: string, password: string): Promise<any> { return apiRequest(`/api/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }); }
export async function deleteAdminUser(id: string): Promise<any> { return apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' }); }
export async function getAdminSupport(): Promise<any> { return apiRequest('/api/admin/support'); }
export async function createAdminSupport(data: any): Promise<any> { return apiRequest('/api/admin/support', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteAdminSupport(id: string): Promise<any> { return apiRequest(`/api/admin/support/${id}`, { method: 'DELETE' }); }
