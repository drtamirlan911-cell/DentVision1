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
  // Only unwrap explicit API envelopes { ok, data }. Do NOT strip domain payloads that include a `data` field (e.g. AI chat).
  if (data && typeof data === 'object' && 'ok' in data && data.data !== undefined) {
    return data.data;
  }
  return data;
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

export async function lookupInvitation(code: string): Promise<any> {
  return apiRequest(`/api/auth/invitations/lookup?code=${encodeURIComponent(code)}`);
}

export async function createDemoClinic(): Promise<any> {
  return apiRequest('/api/auth/demo-clinic', { method: 'POST' });
}

// ─── Clinic SaaS billing ───
export async function getClinicBilling(): Promise<any> {
  return apiRequest('/api/clinic-billing/me');
}

export async function checkoutClinicBilling(plan: string, months = 1): Promise<any> {
  return apiRequest('/api/clinic-billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, months }),
  });
}

export async function confirmClinicBilling(paymentId: string): Promise<any> {
  return apiRequest('/api/clinic-billing/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  });
}

export async function getClinicBillingPayment(paymentId: string): Promise<any> {
  return apiRequest(`/api/clinic-billing/payments/${paymentId}`);
}

/** Map frontend role labels to backend UserRole enum values. */
export function toBackendInviteRole(role?: string): string {
  const raw = String(role || 'doctor').toLowerCase();
  if (raw === 'owner' || raw === 'director') return 'OWNER';
  if (raw === 'admin' || raw === 'cashier') return 'ADMIN';
  if (raw === 'assistant') return 'ASSISTANT';
  if (raw === 'manager') return 'MANAGER';
  if (raw === 'lab' || raw === 'laboratory') return 'LAB';
  if (raw === 'student' || raw === 'intern') return 'STUDENT';
  return 'DOCTOR';
}

export async function createInvitation(data: {
  clinicId: string;
  email?: string;
  role?: string;
  spec?: string;
  expiresInDays?: number;
}): Promise<any> {
  return apiRequest('/api/auth/invitations', {
    method: 'POST',
    body: JSON.stringify({
      clinicId: data.clinicId,
      email: data.email || undefined,
      role: toBackendInviteRole(data.role),
      expiresInDays: data.expiresInDays ?? 7,
    }),
  });
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

export async function updateClinic(
  clinicId: string,
  data: Partial<Clinic> & { settings?: import('../types').ClinicSettings },
): Promise<Clinic> {
  return apiRequest(`/api/clinics/${clinicId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getClinicSettings(clinicId: string): Promise<{
  clinic: Clinic;
  settings: import('../types').ClinicSettings;
}> {
  return apiRequest(`/api/clinics/${clinicId}/settings`);
}

// ─── IAM contexts / context switching ───
export async function getMyContexts(): Promise<{ contexts: any[] }> {
  return apiRequest('/api/iam/me/contexts');
}
export async function switchContext(scopeType: string, scopeId?: string): Promise<any> {
  return apiRequest('/api/iam/switch-context', {
    method: 'POST',
    body: JSON.stringify({ scopeType, scopeId }),
  });
}

// ─── Supplier Workspace (self-service; uses a SUPPLIER-scoped token) ───
async function supplierFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data !== undefined ? data.data : data;
}

export const supplierWs = {
  me: (t: string) => supplierFetch('/api/supplier/me', t),
  updateMe: (t: string, b: Record<string, unknown>) => supplierFetch('/api/supplier/me', t, { method: 'PATCH', body: JSON.stringify(b) }),
  addDocument: (t: string, b: Record<string, unknown>) => supplierFetch('/api/supplier/documents', t, { method: 'POST', body: JSON.stringify(b) }),
  products: (t: string) => supplierFetch('/api/supplier/products', t),
  createProduct: (t: string, b: Record<string, unknown>) => supplierFetch('/api/supplier/products', t, { method: 'POST', body: JSON.stringify(b) }),
  updateProduct: (t: string, id: string, b: Record<string, unknown>) => supplierFetch(`/api/supplier/products/${id}`, t, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteProduct: (t: string, id: string) => supplierFetch(`/api/supplier/products/${id}`, t, { method: 'DELETE' }),
  wallet: (t: string) => supplierFetch('/api/supplier/wallet', t),
  analytics: (t: string) => supplierFetch('/api/supplier/analytics', t),
  dashboard: (t: string) => supplierFetch('/api/supplier/dashboard', t),
  insights: (t: string) => supplierFetch('/api/supplier/insights', t),
  orders: (t: string) => supplierFetch('/api/supplier/orders', t),
  updateOrderStatus: (t: string, id: string, status: string) => supplierFetch(`/api/supplier/orders/${id}/status`, t, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createPromotion: (t: string, b: Record<string, unknown>) => supplierFetch('/api/supplier/promotions', t, { method: 'POST', body: JSON.stringify(b) }),
  requestPayout: (t: string, b: Record<string, unknown>) => supplierFetch('/api/supplier/payouts', t, { method: 'POST', body: JSON.stringify(b) }),
};

async function lecturerFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data !== undefined ? data.data : data;
}

export const lecturerWs = {
  register: (b: Record<string, unknown> = {}) => apiRequest('/api/lecturer/register', { method: 'POST', body: JSON.stringify(b) }),
  me: (t: string) => lecturerFetch('/api/lecturer/me', t),
  updateMe: (t: string, b: Record<string, unknown>) => lecturerFetch('/api/lecturer/me', t, { method: 'PATCH', body: JSON.stringify(b) }),
  courses: (t: string) => lecturerFetch('/api/lecturer/courses', t),
  createCourse: (t: string, b: Record<string, unknown>) => lecturerFetch('/api/lecturer/courses', t, { method: 'POST', body: JSON.stringify(b) }),
  updateCourse: (t: string, id: string, b: Record<string, unknown>) => lecturerFetch(`/api/lecturer/courses/${id}`, t, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteCourse: (t: string, id: string) => lecturerFetch(`/api/lecturer/courses/${id}`, t, { method: 'DELETE' }),
  wallet: (t: string) => lecturerFetch('/api/lecturer/wallet', t),
  analytics: (t: string) => lecturerFetch('/api/lecturer/analytics', t),
  requestPayout: (t: string, b: Record<string, unknown>) => lecturerFetch('/api/lecturer/payouts', t, { method: 'POST', body: JSON.stringify(b) }),
};

export async function saveClinicSettings(
  clinicId: string,
  settings: import('../types').ClinicSettings,
): Promise<any> {
  return apiRequest(`/api/clinics/${clinicId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export interface ClinicStaffMember {
  id: string;
  name: string;
  role: string;
  spec?: string | null;
  avatar?: string | null;
  joinedAt?: string;
}

/** Clinic team roster, backed by the real /api/clinics/:id members list. */
export async function getClinicStaff(clinicId: string): Promise<ClinicStaffMember[]> {
  if (!clinicId) return [];
  const clinic = await apiRequest(`/api/clinics/${clinicId}`);
  const members = Array.isArray(clinic?.members) ? clinic.members : [];
  return members.map((m: any) => ({
    id: m.user?.id,
    name: [m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ').trim() || 'Без имени',
    role: String(m.role || '').toLowerCase() === 'owner'
      ? 'director'
      : String(m.role || '').toLowerCase() === 'cashier'
        ? 'admin'
        : String(m.role || '').toLowerCase(),
    spec: m.user?.spec || null,
    avatar: m.user?.avatar || null,
    email: m.user?.email || null,
    phone: m.user?.phone || null,
    commissionPercent: m.commissionPercent ?? 30,
    joinedAt: m.joinedAt,
  }));
}

// ─── Clinic Data (resource endpoints — clinicId from JWT) ───
function collection<T>(response: T[] | { data?: T[]; items?: T[] } | null | undefined): T[] {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];
  if (Array.isArray((response as any).data)) return (response as any).data;
  if (Array.isArray((response as any).items)) return (response as any).items;
  return [];
}

function mapReceipt(raw: any): Receipt {
  const statusRaw = String(raw?.status || '').toUpperCase();
  const status =
    statusRaw === 'PAID' || raw?.status === 'paid' || raw?.status === 'completed'
      ? 'paid'
      : statusRaw === 'PARTIAL'
        ? 'partial'
        : statusRaw === 'OVERDUE' || statusRaw === 'UNPAID' || statusRaw === 'PENDING'
          ? 'debt'
          : (raw?.status as Receipt['status']) || 'debt';
  return {
    id: raw.id,
    clinicId: raw.clinicId,
    patientId: raw.patientId,
    patientName: raw.patientName,
    doctorId: raw.doctorId,
    date: raw.paidAt
      ? String(raw.paidAt).slice(0, 10)
      : raw.date || (raw.createdAt ? String(raw.createdAt).slice(0, 10) : ''),
    status,
    total: Number(raw.total ?? raw.amount ?? 0),
    amount: Number(raw.amount ?? raw.total ?? 0),
    payMethod: raw.payMethod || raw.paymentMethod,
    paymentType: raw.paymentType,
    notes: raw.notes,
    service: raw.service,
    appointmentId: raw.appointmentId,
    items: Array.isArray(raw.items) ? raw.items : [],
    createdAt: raw.createdAt,
  };
}

export async function getPatients(clinicId: string): Promise<Patient[]> {
  return collection<Patient>(await apiRequest('/api/patients?limit=200'));
}

export async function getPatient(id: string): Promise<Patient> {
  return apiRequest(`/api/patients/${id}`);
}

export async function getPatientSummary(patientId: string): Promise<any> {
  return apiRequest(`/api/patients/${patientId}/summary`);
}

export async function getAppointments(clinicId: string): Promise<Appointment[]> {
  return collection<Appointment>(await apiRequest('/api/appointments?limit=200'));
}

export async function checkAppointmentConflicts(params: {
  doctorId?: string;
  date: string;
  time: string;
  duration?: number;
  excludeId?: string;
  patientId?: string;
  chairId?: string;
}): Promise<{ hasConflict: boolean; conflicts: Appointment[] }> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, String(v)); });
  return apiRequest(`/api/appointments/conflicts?${q}`);
}

export async function getReceipts(clinicId: string): Promise<Receipt[]> {
  return collection(await apiRequest('/api/billing/invoices?limit=200')).map(mapReceipt);
}

export async function getFinanceReport(params: { from?: string; to?: string } = {}): Promise<any> {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const qs = q.toString();
  return apiRequest(`/api/billing/reports${qs ? `?${qs}` : ''}`);
}

export interface DoctorPayrollVisit {
  appointmentId: string;
  date: string;
  time?: string | null;
  patientName?: string;
  services: Array<{ name: string; price: number; matCost: number }>;
  gross: number;
  matCost: number;
  net: number;
  earned: number;
}

export interface DoctorPayrollPayload {
  from: string;
  to: string;
  payroll: {
    userId: string;
    name: string;
    role: string;
    percent: number;
    visits: number;
    gross: number;
    matCost: number;
    net: number;
    earned: number;
    visitDetails: DoctorPayrollVisit[];
  };
}

export async function getMyPayroll(params: { from?: string; to?: string } = {}): Promise<DoctorPayrollPayload> {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const qs = q.toString();
  return apiRequest(`/api/billing/my-payroll${qs ? `?${qs}` : ''}`);
}

export async function getLabOrders(clinicId: string): Promise<LabOrder[]> {
  return collection<LabOrder>(await apiRequest('/api/lab-orders'));
}

export async function getExpenses(clinicId: string): Promise<Expense[]> {
  return collection<Expense>(await apiRequest('/api/crm/expenses'));
}

export async function getInventory(clinicId: string): Promise<InventoryItem[]> {
  const rows = collection<any>(await apiRequest('/api/inventory'));
  return rows.map((r) => ({
    ...r,
    min: r.min ?? r.minimum ?? 0,
    minQuantity: r.minQuantity ?? r.minimum ?? 0,
    cost: r.cost ?? r.price ?? 0,
    unit: r.unit || 'шт',
  }));
}

export async function getPromotions(clinicId: string): Promise<Promotion[]> {
  return collection<Promotion>(await apiRequest('/api/crm/promotions'));
}

export async function getBookings(clinicId: string): Promise<Booking[]> {
  return collection<Booking>(await apiRequest('/api/crm/bookings'));
}

export async function confirmBooking(id: string): Promise<any> {
  return apiRequest(`/api/crm/bookings/${id}/confirm`, { method: 'POST', body: '{}' });
}

// ─── Upserts (resource endpoints) ───
export async function upsertPatient(data: Partial<Patient>): Promise<any> {
  return apiRequest('/api/patients', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertAppointment(data: Partial<Appointment> & { force?: boolean }): Promise<any> {
  return apiRequest('/api/appointments', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertReceipt(data: Partial<Receipt>): Promise<any> {
  const payload = {
    ...data,
    amount: data.amount ?? data.total,
    items: data.items || (data.service ? [{ name: data.service, price: data.total || data.amount || 0, qty: 1 }] : []),
    status: data.status === 'paid' || data.status === 'completed' ? 'PAID' : data.status === 'partial' ? 'PARTIAL' : 'PENDING',
  };
  const created = await apiRequest('/api/billing/invoices', { method: 'POST', body: JSON.stringify(payload) });
  if ((data.status === 'paid' || data.status === 'completed') && created?.id) {
    try {
      await apiRequest(`/api/billing/invoices/${created.id}/pay`, { method: 'POST', body: '{}' });
    } catch { /* ignore */ }
  }
  return mapReceipt(created);
}

export async function upsertLabOrder(data: Partial<LabOrder>): Promise<any> {
  return apiRequest('/api/lab-orders', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertExpense(data: Partial<Expense>): Promise<any> {
  return apiRequest('/api/crm/expenses', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertInventoryItem(data: Partial<InventoryItem>): Promise<any> {
  return apiRequest('/api/inventory', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      minimum: data.minQuantity ?? data.min ?? 0,
      price: (data as any).cost ?? (data as any).price,
    }),
  });
}

export async function upsertUser(data: Partial<User> & { clinicId?: string; password?: string; login?: string }): Promise<any> {
  const clinicId = data.clinicId;
  if (clinicId) {
    const name = String(data.name || '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    return upsertClinicStaff(clinicId, {
      email: String(data.email || data.login || ''),
      password: data.password,
      firstName: (data as any).firstName || parts[0] || name || 'Сотрудник',
      lastName: (data as any).lastName || parts.slice(1).join(' ') || '',
      name,
      phone: data.phone,
      role: data.role,
      spec: data.spec,
    });
  }
  return apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertSubscription(data: Partial<Subscription>): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function uploadPhoto(data: Partial<Photo>): Promise<any> {
  return apiRequest('/api/medical/images', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPatientImages(patientId: string): Promise<any[]> {
  return collection(await apiRequest(`/api/medical/images/${patientId}`));
}

export async function upsertPromotion(data: Partial<Promotion>): Promise<any> {
  return apiRequest('/api/crm/promotions', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertBooking(data: Partial<Booking>): Promise<any> {
  return apiRequest('/api/crm/bookings', { method: 'POST', body: JSON.stringify(data) });
}

export async function deletePromotion(id: string): Promise<any> {
  return apiRequest(`/api/crm/promotions/${id}`, { method: 'DELETE' });
}

export async function getPriceList(): Promise<any[]> {
  return collection(await apiRequest('/api/crm/price-list'));
}

export async function upsertPriceListItem(data: {
  serviceCode: string;
  price: number;
  name?: string;
  matCost?: number;
  active?: boolean;
}): Promise<any> {
  return apiRequest('/api/crm/price-list', { method: 'POST', body: JSON.stringify(data) });
}

/** Create a custom clinic service in the price list. */
export async function addPriceListService(data: {
  name: string;
  price: number;
  category?: string;
  matCost?: number;
}): Promise<any> {
  const slug = String(data.name || 'service')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'service';
  const serviceCode = `custom_${slug}_${Date.now().toString(36)}`;
  const name = data.category
    ? `${data.category} · ${data.name}`
    : data.name;
  return upsertPriceListItem({
    serviceCode,
    price: Number(data.price),
    name,
    matCost: Number(data.matCost || 0),
    active: true,
  });
}

export async function closeAppointment(
  id: string,
  data: {
    notes?: string;
    services?: Array<{ name: string; price: number; matCost?: number }>;
    serviceName?: string;
    servicePrice?: number;
    matCost?: number;
    discount?: number;
    paymentStatus?: string;
    diagnosis?: string;
    toothNumber?: string;
  },
): Promise<any> {
  return apiRequest(`/api/appointments/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function depositPatient(patientId: string, amount: number): Promise<any> {
  return apiRequest(`/api/patients/${patientId}/deposit`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function markReminderSent(reminderKey: string, channel = 'whatsapp'): Promise<any> {
  return apiRequest('/api/crm/reminders/sent', {
    method: 'POST',
    body: JSON.stringify({ reminderKey, channel }),
  });
}

export async function getReminderSentKeys(): Promise<string[]> {
  const rows = collection<{ reminderKey: string }>(await apiRequest('/api/crm/reminders/sent'));
  return rows.map(r => r.reminderKey);
}

export async function runClinicReminders(opts: { hoursWindow?: number; hoursMin?: number } = {}): Promise<any> {
  return apiRequest('/api/crm/reminders/run', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function getChairs(_clinicId?: string): Promise<import('../types').Chair[]> {
  return collection(await apiRequest('/api/crm/chairs'));
}

export async function upsertChair(data: Partial<import('../types').Chair>): Promise<any> {
  return apiRequest('/api/crm/chairs', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteChair(id: string): Promise<any> {
  return apiRequest(`/api/crm/chairs/${id}`, { method: 'DELETE' });
}

export async function sendDocumentForSignature(id: string): Promise<any> {
  return apiRequest(`/api/documents/${id}/send-signature`, { method: 'POST', body: '{}' });
}

export async function signDocument(id: string, payload: { signatureData?: string; signedByName?: string; token?: string }): Promise<any> {
  return apiRequest(`/api/documents/${id}/sign`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateTreatmentPlanStage(
  planId: string,
  stageId: string,
  data: { status?: string; cost?: number; title?: string; appointmentId?: string; invoiceId?: string },
): Promise<any> {
  return apiRequest(`/api/crm/treatment-plans/${planId}/stages/${stageId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Deletes (resource endpoints) ───
export async function deletePatient(id: string): Promise<any> {
  return apiRequest(`/api/patients/${id}`, { method: 'DELETE' });
}

export async function deleteAppointment(id: string): Promise<any> {
  return apiRequest(`/api/appointments/${id}`, { method: 'DELETE' });
}

export async function deleteReceipt(id: string): Promise<any> {
  return apiRequest(`/api/billing/invoices/${id}`, { method: 'DELETE' });
}

export async function upsertClinicStaff(clinicId: string, data: {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  role?: string;
  spec?: string;
}): Promise<any> {
  return apiRequest(`/api/clinics/${clinicId}/staff`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClinicStaff(
  clinicId: string,
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    role?: string;
    spec?: string;
    password?: string;
  },
): Promise<any> {
  return apiRequest(`/api/clinics/${clinicId}/staff/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePhoto(id: string): Promise<any> {
  return apiRequest(`/api/medical/images/${id}`, { method: 'DELETE' });
}

export async function deleteInventoryItem(id: string): Promise<any> {
  return apiRequest(`/api/inventory/${id}`, { method: 'DELETE' });
}

export async function deleteLabOrder(id: string): Promise<any> {
  return apiRequest(`/api/lab-orders/${id}`, { method: 'DELETE' });
}

export async function deleteExpense(id: string): Promise<any> {
  return apiRequest(`/api/crm/expenses/${id}`, { method: 'DELETE' });
}

export async function deleteSubscription(id: string): Promise<any> {
  return Promise.resolve({ ok: true });
}

export async function deleteBooking(id: string): Promise<any> {
  return apiRequest(`/api/crm/bookings/${id}`, { method: 'DELETE' });
}

// ─── Public Booking ───
export interface PublicClinicPayload {
  clinic: {
    id: string;
    name: string;
    city?: string;
    address?: string;
    phone?: string;
    logo?: string;
  };
  doctors: Array<{ id: string; name: string; spec?: string; avatar?: string }>;
  services: Array<{ id: string; name: string; price: number; category: string }>;
  settings: {
    workStart?: string;
    workEnd?: string;
    workDays?: number[];
    bookingSlotMinutes?: number;
    currency?: string;
  };
}

export async function getPublicClinic(clinicId: string): Promise<PublicClinicPayload> {
  const res = await fetch(`${API_URL}/api/public/clinic/${clinicId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Клиника не найдена');
  }
  const raw = await res.json();
  return raw.data || raw;
}

export async function getPublicSlots(
  clinicId: string,
  date: string,
  doctorId?: string,
): Promise<{ slots: string[]; workingDay: boolean }> {
  const q = new URLSearchParams({ date });
  if (doctorId) q.set('doctorId', doctorId);
  const res = await fetch(`${API_URL}/api/public/clinic/${clinicId}/slots?${q}`);
  if (!res.ok) throw new Error('Не удалось загрузить слоты');
  const raw = await res.json();
  const data = raw.data || raw;
  return { slots: data.slots || [], workingDay: data.workingDay !== false };
}

export async function submitBooking(data: {
  clinicId: string;
  patientName: string;
  phone: string;
  email?: string;
  doctorId?: string;
  serviceName?: string;
  date: string;
  time: string;
  notes?: string;
}): Promise<any> {
  const res = await fetch(`${API_URL}/api/public/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clinic_id: data.clinicId,
      patient_name: data.patientName,
      phone: data.phone,
      email: data.email,
      doctor_id: data.doctorId,
      service_name: data.serviceName,
      date: data.date,
      time: data.time,
      notes: data.notes,
    }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(raw.error || 'Ошибка при отправке');
  return raw.data || raw;
}

// ─── Medical Cards ───
// There is no dedicated MedicalCard table on the deployed schema — the
// structured fields (allergies, blood type, insurance, ...) are persisted
// as JSON on Patient.medicalHistory via the existing patient PATCH route.
export async function getMedicalCard(patientId: string): Promise<MedicalCard> {
  const patient = await apiRequest(`/api/patients/${patientId}`);
  return { id: patient.id, patientId: patient.id, clinicId: patient.clinicId, ...(patient.medicalHistory || {}) };
}

export async function upsertMedicalCard(data: Partial<MedicalCard> & Record<string, unknown>): Promise<any> {
  const patientId = (data.patientId || data.patient_id) as string;
  if (!patientId) throw new Error('patientId обязателен для медицинской карты');
  const { id, patientId: _pid, patient_id, clinicId, clinic_id, ...medicalHistory } = data as Record<string, unknown>;
  return apiRequest(`/api/patients/${patientId}`, {
    method: 'PATCH',
    body: JSON.stringify({ medicalHistory }),
  });
}

// ─── ICD-10 ───
export async function getICD10(search: string): Promise<ICD10Code[]> {
  const q = search ? `?q=${encodeURIComponent(search)}` : '';
  return apiRequest(`/api/medical/icd10${q}`);
}

// ─── Visits ───
// The backend Visit model only has {patientId, doctorId, diagnosis,
// complaints, anamnesis, treatment (Json), notes, date}. The CRM form
// collects more granular fields (procedures done, prescriptions, next
// visit date, ICD-10 codes) — those are packed into the `treatment` JSON
// column and unpacked again on read, instead of adding new columns.
function mapVisitFromBackend(raw: any): any {
  const t = (raw?.treatment && typeof raw.treatment === 'object') ? raw.treatment : {};
  return {
    ...raw,
    patient_id: raw.patientId,
    doctor_id: raw.doctorId,
    chief_complaint: raw.complaints,
    treatment_plan: t.plan || '',
    procedures_done: t.proceduresDone || '',
    prescriptions: t.prescriptions || '',
    next_visit_date: t.nextVisitDate || '',
    icd10_codes: t.icd10Codes || '',
    visit_date: raw.date,
  };
}

export async function getVisits(clinicId: string, patientId: string): Promise<Visit[]> {
  const raw = patientId
    ? await apiRequest(`/api/medical/patients/${patientId}/visits`)
    : await apiRequest('/api/medical/visits');
  return (Array.isArray(raw) ? raw : []).map(mapVisitFromBackend);
}

export async function upsertVisit(data: Partial<Visit> & Record<string, unknown>): Promise<any> {
  const patientId = (data.patientId || data.patient_id) as string;
  const doctorId = (data.doctorId || data.doctor_id) as string;
  const body = {
    doctorId,
    diagnosis: data.diagnosis ?? null,
    complaints: data.chief_complaint ?? data.complaints ?? null,
    anamnesis: data.anamnesis ?? null,
    notes: data.notes ?? null,
    treatment: {
      plan: data.treatment_plan ?? undefined,
      proceduresDone: data.procedures_done ?? undefined,
      prescriptions: data.prescriptions ?? undefined,
      nextVisitDate: data.next_visit_date ?? undefined,
      icd10Codes: data.icd10_codes ?? undefined,
    },
  };

  if (data.id) {
    return apiRequest(`/api/medical/visits/${data.id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  if (!patientId || !doctorId) throw new Error('Пациент и врач обязательны для визита');
  return apiRequest('/api/medical/visits', { method: 'POST', body: JSON.stringify({ ...body, patientId }) });
}

// ─── Documents ───
function decodeDocumentUrl(url: string | undefined): string {
  if (!url?.startsWith('data:text/plain')) return '';
  try {
    const base64 = url.split(',').slice(1).join(',');
    return atob(base64);
  } catch {
    return '';
  }
}

function mapDocument(raw: any): any {
  return {
    ...raw,
    doc_type: raw.type,
    patient_id: raw.patientId,
    content: decodeDocumentUrl(raw.url),
  };
}

export async function getDocuments(clinicId: string, patientId: string): Promise<Document[]> {
  const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
  const docs = await apiRequest(`/api/files${qs}`);
  return (Array.isArray(docs) ? docs : []).map(mapDocument);
}

export async function upsertDocument(data: Partial<Document> & Record<string, unknown>): Promise<any> {
  return apiRequest('/api/files/documents', {
    method: 'POST',
    body: JSON.stringify({
      id: data.id,
      patientId: data.patientId || data.patient_id,
      docType: data.doc_type || data.docType || data.type,
      title: data.title,
      content: data.content,
      status: data.status,
    }),
  });
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
  return collection<WaitingListItem>(await apiRequest('/api/crm/waiting-list'));
}

export async function upsertWaitingListItem(data: Partial<WaitingListItem>): Promise<any> {
  return apiRequest('/api/crm/waiting-list', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteWaitingListItem(id: string): Promise<any> {
  return apiRequest(`/api/crm/waiting-list/${id}`, { method: 'DELETE' });
}

// ─── Shop ───
export async function getShopCategories(): Promise<any> {
  return collection(await apiRequest('/api/shop/categories'));
}
export async function getShopProducts(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const qs = q.toString();
  return collection(await apiRequest(`/api/shop/products${qs ? `?${qs}` : ''}`));
}
export async function getShopProduct(id: string): Promise<any> { return apiRequest(`/api/shop/products/${id}`); }
export async function getShopSuppliers(): Promise<any> {
  return collection(await apiRequest('/api/shop/suppliers'));
}
export async function createShopOrder(data: any): Promise<any> { return apiRequest('/api/shop/orders', { method: 'POST', body: JSON.stringify(data) }); }
export async function getShopOrders(clinicId: string): Promise<any> { return collection(await apiRequest('/api/shop/orders')); }
export async function createShopReview(data: any): Promise<any> { return Promise.resolve({ ok: true }); }
export async function toggleShopFavorite(data: any): Promise<any> { return apiRequest('/api/shop/favorites', { method: 'POST', body: JSON.stringify(data) }); }
export async function getShopFavorites(clinicId: string): Promise<any> { return apiRequest('/api/shop/favorites'); }

// ─── School / Academy OS ───
export async function getAcademyHub(): Promise<any> {
  return apiRequest('/api/school/hub');
}
export async function getSchoolCourses(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const qs = q.toString();
  return collection(await apiRequest(`/api/school/courses${qs ? `?${qs}` : ''}`));
}
export async function getSchoolCourse(id: string): Promise<any> { return apiRequest(`/api/school/courses/${id}`); }
export async function enrollCourse(data: any): Promise<any> { return apiRequest('/api/school/enrollments', { method: 'POST', body: JSON.stringify(data) }); }
export async function getEnrollments(userId: string): Promise<any> { return apiRequest('/api/school/enrollments'); }
export async function updateEnrollment(id: string, data: any): Promise<any> { return apiRequest(`/api/school/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function getSchoolClinicalCases(category?: string): Promise<any> {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return collection(await apiRequest(`/api/school/clinical-cases${q}`));
}
export async function getSchoolLibrary(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const qs = q.toString();
  return collection(await apiRequest(`/api/school/library${qs ? `?${qs}` : ''}`));
}
export async function getSchoolLive(): Promise<any> {
  return collection(await apiRequest('/api/school/live'));
}
export async function getSchoolWebinars(): Promise<any> {
  return collection(await apiRequest('/api/school/webinars'));
}
export async function getSchoolOfficeCourses(): Promise<any> {
  return collection(await apiRequest('/api/school/office-courses'));
}
export async function registerAcademyProduct(payload: {
  productId: string;
  format: 'webinar' | 'office' | 'live';
}): Promise<any> {
  return apiRequest('/api/school/commerce/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export async function getSchoolCertificates(userId: string): Promise<any> {
  return collection(await apiRequest('/api/school/certificates'));
}
export async function getAcademies(): Promise<any> {
  return collection(await apiRequest('/api/academies'));
}
export async function getLecturers(params: Record<string, string> = {}): Promise<any> {
  const q = new URLSearchParams(params).toString();
  return collection(await apiRequest(`/api/lecturers${q ? `?${q}` : ''}`));
}
export async function reviewSchoolHomework(payload: {
  title?: string;
  notes?: string;
  category?: string;
  imageCount?: number;
}): Promise<any> {
  return apiRequest('/api/school/homework/review', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getLessonExam(lessonId: string): Promise<any> {
  return apiRequest(`/api/school/lessons/${lessonId}/exam`);
}

export async function submitLessonExam(lessonId: string, answers: Record<string, number>, courseId?: string): Promise<any> {
  return apiRequest(`/api/school/lessons/${lessonId}/exam/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers, courseId }),
  });
}

export async function askSchoolTutor(payload: {
  message: string;
  courseId?: string;
  lessonId?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<any> {
  return apiRequest('/api/school/tutor', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Treatment Plans ───
export async function getTreatmentPlans(clinicId: string, params: { patientId?: string; status?: string } = {}): Promise<any[]> {
  const q = new URLSearchParams();
  if (params.patientId) q.set('patientId', params.patientId);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return apiRequest(`/api/crm/${clinicId}/treatment-plans${qs ? `?${qs}` : ''}`);
}

export async function upsertTreatmentPlan(data: Record<string, unknown>): Promise<any> {
  return apiRequest('/api/crm/treatment-plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTreatmentPlan(id: string): Promise<any> {
  return apiRequest(`/api/crm/treatment-plans/${id}`, { method: 'DELETE' });
}

// ─── AI Threads ───
export async function getAiThreads(): Promise<any> {
  return apiRequest('/api/ai/threads');
}

export async function getActiveAiThread(): Promise<any> {
  return apiRequest('/api/ai/threads/active');
}

export async function startNewAiThread(): Promise<any> {
  return apiRequest('/api/ai/threads/new', { method: 'POST', body: '{}' });
}

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
export async function getMyProfile(): Promise<any> {
  return apiRequest('/api/profile');
}
export async function getPublicProfile(identifier: string): Promise<any> {
  return apiRequest(`/api/profile/${encodeURIComponent(identifier)}`);
}
export async function updateMyProfile(data: any): Promise<any> {
  return apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function addSkill(data: any): Promise<any> {
  return apiRequest('/api/profile/skills', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteSkill(id: string): Promise<any> {
  return apiRequest(`/api/profile/skills/${id}`, { method: 'DELETE' });
}

export async function addCertificate(data: any): Promise<any> {
  return apiRequest('/api/profile/certificates', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteCertificate(id: string): Promise<any> {
  return apiRequest(`/api/profile/certificates/${id}`, { method: 'DELETE' });
}

export async function addAchievement(data: any): Promise<any> {
  return apiRequest('/api/profile/achievements', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteAchievement(id: string): Promise<any> {
  return apiRequest(`/api/profile/achievements/${id}`, { method: 'DELETE' });
}

export async function addPortfolioItem(data: any): Promise<any> {
  return apiRequest('/api/profile/portfolio', { method: 'POST', body: JSON.stringify(data) });
}
export async function deletePortfolioItem(id: string): Promise<any> {
  return apiRequest(`/api/profile/portfolio/${id}`, { method: 'DELETE' });
}

export async function addCase(data: any): Promise<any> {
  return apiRequest('/api/profile/cases', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteCase(id: string): Promise<any> {
  return apiRequest(`/api/profile/cases/${id}`, { method: 'DELETE' });
}

/** Self-serve: register as a supplier company and become owner. */
export async function registerAsSupplier(data: {
  name: string;
  kind?: string;
  bin?: string;
  legalAddress?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}): Promise<any> {
  return apiRequest('/api/suppliers/register', { method: 'POST', body: JSON.stringify(data) });
}

/** Platform: link a user to a supplier by email or userId. */
export async function addSupplierMember(supplierId: string, body: { email?: string; userId?: string; role?: string }): Promise<any> {
  return apiRequest(`/api/suppliers/${supplierId}/members`, { method: 'POST', body: JSON.stringify(body) });
}

// ─── Hidden platform ops (SUPERADMIN + X-Platform-Ops-Key) ───
const OPS_KEY_SESSION = 'dv_ops_key';

function getOpsKey(): string {
  try { return sessionStorage.getItem(OPS_KEY_SESSION) || ''; } catch { return ''; }
}

async function opsRequest(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const opsKey = getOpsKey();
  if (opsKey) headers['X-Platform-Ops-Key'] = opsKey;
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (data && typeof data === 'object' && 'ok' in data && data.data !== undefined) return data.data;
  return data;
}

export async function opsListSuppliers(params: { status?: string; search?: string; page?: number } = {}): Promise<any> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString();
  return opsRequest(`/api/ops/suppliers${qs ? `?${qs}` : ''}`);
}

export async function opsSetSupplierStatus(id: string, status: string): Promise<any> {
  return opsRequest(`/api/ops/suppliers/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function opsAddSupplierMember(
  id: string,
  body: { email?: string; userId?: string; role?: string },
): Promise<any> {
  return opsRequest(`/api/ops/suppliers/${id}/members`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─── Platform Ops Command Center ───
export async function opsOverview(): Promise<any> {
  return opsRequest('/api/ops/overview');
}

export async function opsListClinics(): Promise<any> {
  return opsRequest('/api/ops/clinics');
}

export async function opsClinicPlan(id: string, plan: string): Promise<any> {
  return opsRequest(`/api/ops/clinics/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export async function opsClinicExtend(id: string, months = 1): Promise<any> {
  return opsRequest(`/api/ops/clinics/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify({ months }),
  });
}

export async function opsClinicSuspend(id: string): Promise<any> {
  return opsRequest(`/api/ops/clinics/${id}/suspend`, { method: 'POST' });
}

export async function opsClinicActivate(id: string): Promise<any> {
  return opsRequest(`/api/ops/clinics/${id}/activate`, { method: 'POST' });
}

export async function opsSchool(): Promise<any> {
  return opsRequest('/api/ops/school');
}

export async function opsLecturerLevel(id: string, level: string): Promise<any> {
  return opsRequest(`/api/ops/lecturers/${id}/level`, {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

export async function opsAutoAdvanceSuppliers(verify = false): Promise<any> {
  return opsRequest('/api/ops/automations/advance-supplier-reviews', {
    method: 'POST',
    body: JSON.stringify({ verify, verifyReviewed: verify }),
  });
}

export async function opsAutoVerifyLecturers(): Promise<any> {
  return opsRequest('/api/ops/automations/verify-new-lecturers', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function opsAutoExtendClinics(months = 1, daysAhead = 14): Promise<any> {
  return opsRequest('/api/ops/automations/extend-expiring-clinics', {
    method: 'POST',
    body: JSON.stringify({ months, daysAhead }),
  });
}

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
  sessionId?: string;
}

/** Stable UUID session id per user — prevents shared AI chat across accounts. */
export function getAiSessionId(userId?: string | null): string {
  const key = `dv_ai_session_${userId || 'guest'}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
  } catch { /* ignore */ }
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try { localStorage.setItem(key, id); } catch { /* ignore */ }
  return id;
}

export function clearAiSessionId(userId?: string | null): void {
  try { localStorage.removeItem(`dv_ai_session_${userId || 'guest'}`); } catch { /* ignore */ }
}

export async function aiChat(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  opts?: { sessionId?: string; userId?: string | null },
): Promise<AIChatResponse> {
  const sessionId = opts?.sessionId || getAiSessionId(opts?.userId);
  const res = await apiRequest('/api/ai/query', {
    method: 'POST',
    body: JSON.stringify({
      text: message,
      message,
      history: history.slice(-20),
      sessionId,
    }),
  });

  // Support both live server shape ({ reply, skill, ... }) and legacy envelope ({ message, intent })
  const reply = res?.reply || res?.message || '';
  const skill = res?.skill || res?.intent || 'general';
  const actionsRaw = Array.isArray(res?.actions)
    ? res.actions
    : res?.action
      ? [{ type: res.action.type, label: res.action.type || res.action.label, params: res.action.payload || res.action.params, confidence: 1, requiresConfirmation: !!res.needsConfirmation }]
      : [];

  if (res?.sessionId) {
    try {
      localStorage.setItem(`dv_ai_session_${opts?.userId || 'guest'}`, res.sessionId);
    } catch { /* ignore */ }
  }

  return {
    reply,
    skill,
    source: res?.source || 'ai',
    data: res?.data,
    recommendations: res?.recommendations,
    actions: actionsRaw.map((a: any) => ({
      type: a.type || a.action,
      label: a.label || a.type || a.action,
      confidence: a.confidence ?? 1,
      params: a.params || {},
      requiresConfirmation: a.requiresConfirmation,
    })),
    suggestions: Array.isArray(res?.suggestions) ? res.suggestions : [],
    proactive: Array.isArray(res?.proactive) ? res.proactive : [],
    conversationContext: res?.conversationContext || { turnCount: 0, entities: {} },
    sessionId: res?.sessionId || sessionId,
  } as AIChatResponse;
}

/** Prefer real SSE stream; fall back to local typewriter on failure */
export async function aiChatStream(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  onChunk: (partial: string, done: boolean) => void,
  opts?: { sessionId?: string; userId?: string | null },
): Promise<AIChatResponse> {
  try {
    const streamed = await aiChatSSE(message, history, onChunk, opts);
    if (streamed) return streamed;
  } catch {
    // fall through to simulated stream
  }

  const full = await aiChat(message, history, opts);
  const text = full.reply || '';
  if (!text) {
    onChunk('', true);
    return full;
  }
  const chunkSize = Math.max(2, Math.ceil(text.length / 40));
  let i = 0;
  await new Promise<void>((resolve) => {
    const tick = () => {
      i = Math.min(text.length, i + chunkSize);
      onChunk(text.slice(0, i), i >= text.length);
      if (i >= text.length) resolve();
      else setTimeout(tick, 16);
    };
    tick();
  });
  return full;
}

async function aiChatSSE(
  message: string,
  history: Array<{ role: string; content: string }>,
  onChunk: (partial: string, done: boolean) => void,
  opts?: { sessionId?: string; userId?: string | null },
): Promise<AIChatResponse | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_accessToken) headers.Authorization = `Bearer ${_accessToken}`;
  else {
    try {
      const guestData = localStorage.getItem('dv_guest');
      if (guestData) {
        const { guestToken } = JSON.parse(guestData);
        if (guestToken) headers.Authorization = `Bearer ${guestToken}`;
      }
    } catch { /* ignore */ }
  }

  const sessionId = opts?.sessionId || getAiSessionId(opts?.userId);
  const res = await fetch(`${API_URL}/api/ai/query/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: message, message, history: history.slice(-20), sessionId }),
  });
  if (!res.ok || !res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let partial = '';
  let donePayload: any = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === 'token' && evt.text) {
          partial += evt.text;
          onChunk(partial, false);
        } else if (evt.type === 'done') {
          donePayload = evt;
          partial = evt.reply || partial;
          onChunk(partial, true);
        } else if (evt.type === 'error') {
          throw new Error(evt.error || 'SSE error');
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  if (!donePayload) {
    onChunk(partial, true);
    return {
      reply: partial,
      skill: 'general',
      source: 'ai',
      actions: [],
      suggestions: [],
      proactive: [],
      conversationContext: { turnCount: 0, entities: {} },
    };
  }

  return {
    reply: donePayload.reply || partial,
    skill: donePayload.skill || 'general',
    source: donePayload.source || 'ai',
    data: donePayload.data,
    recommendations: donePayload.recommendations,
    actions: Array.isArray(donePayload.actions) ? donePayload.actions : [],
    suggestions: Array.isArray(donePayload.suggestions) ? donePayload.suggestions : [],
    proactive: Array.isArray(donePayload.proactive) ? donePayload.proactive : [],
    conversationContext: donePayload.conversationContext || { turnCount: 0, entities: {} },
  };
}

export async function aiProactive(): Promise<{ alerts: Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }> }> {
  const res = await apiRequest('/api/ai/proactive');
  const raw = res?.alerts || res?.data?.alerts || [];
  const alerts = raw.map((a: any) => ({
    type: a.type || 'info',
    category: a.category || a.type || 'general',
    text: a.text || a.message || '',
    priority: typeof a.priority === 'number' ? a.priority : a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0,
    action: a.action ? { type: a.action.type } : undefined,
  }));
  return { alerts };
}
export async function aiAction(action: string, params: Record<string, unknown> = {}): Promise<any> {
  return apiRequest('/api/ai/action', {
    method: 'POST',
    body: JSON.stringify({ action, params, confirmationRequired: false }),
  });
}
export async function aiDigitalTwin(): Promise<any> {
  return apiRequest('/api/ai/digital-twin');
}

// ─── Jobs (HH-class) ───
export async function getJobs(params: Record<string, string> = {}): Promise<any[]> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return apiRequest(`/api/jobs?${q}`);
}
export async function createJob(data: any): Promise<any> {
  return apiRequest('/api/jobs', { method: 'POST', body: JSON.stringify(data) });
}
export async function applyToJob(id: string, coverNote = ''): Promise<any> {
  return apiRequest(`/api/jobs/${id}/apply`, { method: 'POST', body: JSON.stringify({ coverNote }) });
}
export async function getMyJobApplications(): Promise<any[]> {
  return apiRequest('/api/jobs/me/applications');
}

// ─── Community (IG + Threads) ───
export async function getCommunityPosts(topic?: string): Promise<any[]> {
  const q = topic && topic !== 'Все' ? `?topic=${encodeURIComponent(topic)}` : '';
  return apiRequest(`/api/community/posts${q}`);
}
export async function createCommunityPost(data: { content: string; tags?: string[]; kind?: string }): Promise<any> {
  return apiRequest('/api/community/posts', { method: 'POST', body: JSON.stringify(data) });
}
export async function likeCommunityPost(id: string): Promise<any> {
  return apiRequest(`/api/community/posts/${id}/like`, { method: 'POST' });
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
