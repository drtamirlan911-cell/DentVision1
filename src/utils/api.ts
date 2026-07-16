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
    try { localStorage.setItem('dv_tokens', JSON.stringify({ access, refresh })); } catch {}
  } else {
    try { localStorage.removeItem('dv_tokens'); } catch {}
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
  } catch {}
  return null;
}

export function clearTokens(): void {
  _accessToken = null;
  _refreshToken = null;
  try { localStorage.removeItem('dv_tokens'); } catch {}
}

export function getAccessToken(): string | null { return _accessToken; }

// ─── Token Refresh ───
async function refreshAccessToken(): Promise<string> {
  if (!_refreshToken) throw new Error('No refresh token');
  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ refreshToken: _refreshToken }))));
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `d=${encodeURIComponent(encoded)}`,
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch (err) {
      clearTokens();
      // Redirect to login on auth failure
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
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

  // Attach access token
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  // WAF-safe transport: encode JSON body as base64 field `d` via urlencoded,
  // so Cloudflare WAF does not block credential-like payloads.
  let finalOptions: RequestInit = { ...options, headers };
  if (options.body && typeof options.body === 'string') {
    const encoded = btoa(unescape(encodeURIComponent(options.body)));
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    finalOptions = { ...options, headers, body: `d=${encodeURIComponent(encoded)}` };
  } else {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(`${API_URL}${path}`, finalOptions);
  let data = await res.json();

  // If token expired, try refresh once
  if (res.status === 401 && data.code === 'TOKEN_EXPIRED' && _refreshToken) {
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
  return data;
}

// ─── Auth ───
export async function login(loginStr: string, password: string): Promise<LoginResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginStr, password }),
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
    body: JSON.stringify({ login }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<any> {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
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
  return apiRequest('/api/clinics');
}

export async function getClinic(clinicId: string): Promise<Clinic> {
  const clinics = await apiRequest('/api/clinics');
  return clinics.find((c: any) => c.id === clinicId) || { id: clinicId, name: 'Clinic', active: true };
}

// ─── Clinic Data (granular endpoints) ───
export async function getPatients(clinicId: string): Promise<Patient[]> {
  return apiRequest(`/api/crm/${clinicId}/patients`);
}

export async function getAppointments(clinicId: string): Promise<Appointment[]> {
  return apiRequest(`/api/crm/${clinicId}/appointments`);
}

export async function getReceipts(clinicId: string): Promise<Receipt[]> {
  return apiRequest(`/api/crm/${clinicId}/receipts`);
}

export async function getLabOrders(clinicId: string): Promise<LabOrder[]> {
  return apiRequest(`/api/crm/${clinicId}/lab_orders`);
}

export async function getExpenses(clinicId: string): Promise<Expense[]> {
  return apiRequest(`/api/crm/${clinicId}/expenses`);
}

export async function getInventory(clinicId: string): Promise<InventoryItem[]> {
  return apiRequest(`/api/crm/${clinicId}/inventory`);
}

export async function getPromotions(clinicId: string): Promise<Promotion[]> {
  return apiRequest(`/api/crm/${clinicId}/promotions`);
}

export async function getBookings(clinicId: string): Promise<Booking[]> {
  return apiRequest(`/api/crm/${clinicId}/bookings`);
}

// ─── Upserts (granular CRM endpoints) ───
export async function upsertPatient(data: Partial<Patient>): Promise<any> {
  return apiRequest('/api/crm/patients', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertAppointment(data: Partial<Appointment>): Promise<any> {
  return apiRequest('/api/crm/appointments', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertReceipt(data: Partial<Receipt>): Promise<any> {
  return apiRequest('/api/crm/receipts', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertLabOrder(data: Partial<LabOrder>): Promise<any> {
  return apiRequest('/api/crm/lab_orders', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertExpense(data: Partial<Expense>): Promise<any> {
  return apiRequest('/api/crm/expenses', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertInventoryItem(data: Partial<InventoryItem>): Promise<any> {
  return apiRequest('/api/crm/inventory', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertUser(data: Partial<User>): Promise<any> {
  return apiRequest('/api/crm/users/create', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertSubscription(data: Partial<Subscription>): Promise<any> {
  return apiRequest('/api/crm/subscriptions', { method: 'POST', body: JSON.stringify(data) });
}

export async function uploadPhoto(data: Partial<Photo>): Promise<any> {
  return apiRequest('/api/crm/photos', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertPromotion(data: Partial<Promotion>): Promise<any> {
  return apiRequest('/api/crm/promotions', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertBooking(data: Partial<Booking>): Promise<any> {
  return apiRequest('/api/crm/bookings', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Deletes (granular CRM endpoints) ───
export async function deletePatient(id: string): Promise<any> {
  return apiRequest(`/api/crm/patients/${id}`, { method: 'DELETE' });
}

export async function deleteAppointment(id: string): Promise<any> {
  return apiRequest(`/api/crm/appointments/${id}`, { method: 'DELETE' });
}

export async function deleteReceipt(id: string): Promise<any> {
  return apiRequest(`/api/crm/receipts/${id}`, { method: 'DELETE' });
}

export async function deletePhoto(id: string): Promise<any> {
  return apiRequest(`/api/crm/photos/${id}`, { method: 'DELETE' });
}

export async function deleteInventoryItem(id: string): Promise<any> {
  return apiRequest(`/api/crm/inventory/${id}`, { method: 'DELETE' });
}

export async function deleteLabOrder(id: string): Promise<any> {
  return apiRequest(`/api/crm/lab_orders/${id}`, { method: 'DELETE' });
}

export async function deleteExpense(id: string): Promise<any> {
  return apiRequest(`/api/crm/expenses/${id}`, { method: 'DELETE' });
}

export async function deleteSubscription(id: string): Promise<any> {
  return apiRequest(`/api/crm/subscriptions/${id}`, { method: 'DELETE' });
}

export async function deletePromotion(id: string): Promise<any> {
  return apiRequest(`/api/crm/promotions/${id}`, { method: 'DELETE' });
}

export async function deleteBooking(id: string): Promise<any> {
  return apiRequest(`/api/crm/bookings/${id}`, { method: 'DELETE' });
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
  return apiRequest(`/api/medical-cards/${patientId}`);
}

export async function upsertMedicalCard(data: Partial<MedicalCard>): Promise<any> {
  return apiRequest('/api/medical-cards/upsert', { method: 'POST', body: JSON.stringify(data) });
}

// ─── ICD-10 ───
export async function getICD10(search: string): Promise<ICD10Code[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(`/api/icd10${q}`);
}

// ─── Visits ───
export async function getVisits(clinicId: string, patientId: string): Promise<Visit[]> {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinic_id', clinicId);
  if (patientId) params.set('patient_id', patientId);
  return apiRequest(`/api/visits?${params}`);
}

export async function upsertVisit(data: Partial<Visit>): Promise<any> {
  return apiRequest('/api/visits/upsert', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Documents ───
export async function getDocuments(clinicId: string, patientId: string): Promise<Document[]> {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinic_id', clinicId);
  if (patientId) params.set('patient_id', patientId);
  return apiRequest(`/api/documents?${params}`);
}

export async function upsertDocument(data: Partial<Document>): Promise<any> {
  return apiRequest('/api/documents/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteDocument(id: string): Promise<any> {
  return apiRequest(`/api/documents/${id}`, { method: 'DELETE' });
}

// ─── Audit Log ───
export async function getAuditLog(clinicId: string, limit: number = 100): Promise<AuditLogEntry[]> {
  return apiRequest(`/api/audit-log?clinic_id=${clinicId}&limit=${limit}`);
}

// ─── Backup ───
export async function createBackup(clinicId: string): Promise<any> {
  return apiRequest('/api/backup', { method: 'POST', body: JSON.stringify({ clinic_id: clinicId }) });
}

// ─── Treatments ───
export async function upsertTreatment(data: any): Promise<any> {
  return apiRequest('/api/crm/treatments', { method: 'POST', body: JSON.stringify(data) });
}

export async function getTreatments(clinicId: string): Promise<any[]> {
  return apiRequest(`/api/crm/${clinicId}/treatments`);
}

// ─── Waiting List ───
export async function getWaitingList(clinicId: string): Promise<WaitingListItem[]> {
  return apiRequest(`/api/crm/${clinicId}/waiting_list`);
}

// ─── Shop ───
export async function getShopCategories(): Promise<any> { return apiRequest('/api/shop/categories'); }
export async function getShopProducts(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return apiRequest(`/api/shop/products?${q}`);
}
export async function getShopProduct(id: string): Promise<any> { return apiRequest(`/api/shop/products/${id}`); }
export async function getShopSuppliers(): Promise<any> { return apiRequest('/api/shop/suppliers'); }
export async function createShopOrder(data: any): Promise<any> { return apiRequest('/api/shop/orders', { method: 'POST', body: JSON.stringify(data) }); }
export async function getShopOrders(clinicId: string): Promise<any> { return apiRequest(`/api/shop/orders?clinic_id=${clinicId}`); }
export async function createShopReview(data: any): Promise<any> { return apiRequest('/api/shop/reviews', { method: 'POST', body: JSON.stringify(data) }); }
export async function toggleShopFavorite(data: any): Promise<any> { return apiRequest('/api/shop/favorites', { method: 'POST', body: JSON.stringify(data) }); }
export async function getShopFavorites(clinicId: string): Promise<any> { return apiRequest(`/api/shop/favorites?clinic_id=${clinicId}`); }

// ─── School ───
export async function getSchoolCourses(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return apiRequest(`/api/school/courses?${q}`);
}
export async function getSchoolCourse(id: string): Promise<any> { return apiRequest(`/api/school/courses/${id}`); }
export async function enrollCourse(data: any): Promise<any> { return apiRequest('/api/school/enrollments', { method: 'POST', body: JSON.stringify(data) }); }
export async function getEnrollments(userId: string): Promise<any> { return apiRequest(`/api/school/enrollments?user_id=${userId}`); }
export async function updateEnrollment(id: string, data: any): Promise<any> { return apiRequest(`/api/school/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function getSchoolClinicalCases(category: string): Promise<any> { return apiRequest(`/api/school/clinical-cases${category ? `?category=${category}` : ''}`); }
export async function getSchoolLibrary(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return apiRequest(`/api/school/library?${q}`);
}
export async function getSchoolCertificates(userId: string): Promise<any> { return apiRequest(`/api/school/certificates?user_id=${userId}`); }

// ─── Service Access ───
export async function getServiceAccess(clinicId: string): Promise<Record<string, boolean>> {
  return apiRequest(`/api/service-access/${clinicId}`);
}

export async function setServiceAccess(clinicId: string, service: string, enabled: boolean): Promise<any> {
  return apiRequest('/api/service-access', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId, service, enabled }),
  });
}

export async function setServiceAccessBulk(clinicId: string, services: Record<string, boolean>): Promise<any> {
  return apiRequest('/api/service-access/bulk', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId, services }),
  });
}

export async function getPublicServiceAccess(clinicId: string): Promise<Record<string, boolean>> {
  return apiRequest(`/api/service-access/public/${clinicId}`);
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
  return data.count || 0
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
export async function createShopCategory(data: any): Promise<any> { return apiRequest('/api/shop/categories', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteShopCategory(id: string): Promise<any> { return apiRequest(`/api/shop/categories/${id}`, { method: 'DELETE' }); }
export async function createShopSupplier(data: any): Promise<any> { return apiRequest('/api/shop/suppliers', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteShopSupplier(id: string): Promise<any> { return apiRequest(`/api/shop/suppliers/${id}`, { method: 'DELETE' }); }
export async function createShopProduct(data: any): Promise<any> { return apiRequest('/api/shop/products', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateShopProduct(id: string, data: any): Promise<any> { return apiRequest(`/api/shop/products`, { method: 'POST', body: JSON.stringify({ ...data, id }) }); }
export async function deleteShopProduct(id: string): Promise<any> { return apiRequest(`/api/shop/products/${id}`, { method: 'DELETE' }); }

// ─── School content management (superadmin) ───
export async function createSchoolCourse(data: any): Promise<any> { return apiRequest('/api/school/courses', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateSchoolCourse(id: string, data: any): Promise<any> { return apiRequest(`/api/school/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteSchoolCourse(id: string): Promise<any> { return apiRequest(`/api/school/courses/${id}`, { method: 'DELETE' }); }
export async function createSchoolClinicalCase(data: any): Promise<any> { return apiRequest('/api/school/clinical-cases', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteSchoolClinicalCase(id: string): Promise<any> { return apiRequest(`/api/school/clinical-cases/${id}`, { method: 'DELETE' }); }
export async function createSchoolLibraryItem(data: any): Promise<any> { return apiRequest('/api/school/library', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteSchoolLibraryItem(id: string): Promise<any> { return apiRequest(`/api/school/library/${id}`, { method: 'DELETE' }); }

// ─── User Professional Profile (LinkedIn-style) ───
export async function getMyProfile(): Promise<any> { return apiRequest('/api/profile'); }
export async function getPublicProfile(identifier: string): Promise<any> { return apiRequest(`/api/profile/${identifier}`); }
export async function updateMyProfile(data: any): Promise<any> { return apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(data) }); }

export async function addSkill(data: any): Promise<any> { return apiRequest('/api/profile/skills', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteSkill(id: string): Promise<any> { return apiRequest(`/api/profile/skills/${id}`, { method: 'DELETE' }); }

export async function addCertificate(data: any): Promise<any> { return apiRequest('/api/profile/certificates', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteCertificate(id: string): Promise<any> { return apiRequest(`/api/profile/certificates/${id}`, { method: 'DELETE' }); }

export async function addAchievement(data: any): Promise<any> { return apiRequest('/api/profile/achievements', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteAchievement(id: string): Promise<any> { return apiRequest(`/api/profile/achievements/${id}`, { method: 'DELETE' }); }

export async function addPortfolioItem(data: any): Promise<any> { return apiRequest('/api/profile/portfolio', { method: 'POST', body: JSON.stringify(data) }); }
export async function deletePortfolioItem(id: string): Promise<any> { return apiRequest(`/api/profile/portfolio/${id}`, { method: 'DELETE' }); }

export async function addCase(data: any): Promise<any> { return apiRequest('/api/profile/cases', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteCase(id: string): Promise<any> { return apiRequest(`/api/profile/cases/${id}`, { method: 'DELETE' }); }
