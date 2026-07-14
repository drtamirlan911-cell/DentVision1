// ═══════════════════════════════════════════════════════════════════
// DENTVISION API CLIENT — Real backend calls
// ═══════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Auth ───
export async function login(loginStr, password) {
  const user = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginStr, password }),
  });
  return user ? { user } : null;
}

export async function forgotPassword(login) {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ login }),
  });
}

export async function register(data) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function resetPassword(token, newPassword) {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

// ─── Clinics ───
export async function getClinics() {
  return apiRequest('/api/clinics');
}

export async function getClinic(clinicId) {
  const data = await apiRequest(`/api/clinic/${clinicId}/data`);
  return { id: clinicId, name: 'Clinic', active: true, ...data };
}

// ─── Clinic Data ───
export async function getPatients(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.patients || []);
}

export async function getAppointments(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.appointments || []);
}

export async function getReceipts(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.receipts || []);
}

export async function getLabOrders(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.labOrders || []);
}

export async function getExpenses(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.expenses || []);
}

export async function getInventory(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.inventory || []);
}

export async function getPromotions(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.promotions || []);
}

export async function getBookings(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.bookings || []);
}

// ─── Upserts ───
export async function upsertPatient(data) {
  return apiRequest('/api/patients/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertAppointment(data) {
  return apiRequest('/api/appointments/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertReceipt(data) {
  return apiRequest('/api/receipts/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertLabOrder(data) {
  return apiRequest('/api/lab_orders/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertExpense(data) {
  return apiRequest('/api/expenses/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertInventoryItem(data) {
  return apiRequest('/api/inventory/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertUser(data) {
  return apiRequest('/api/users/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertSubscription(data) {
  return apiRequest('/api/subscriptions/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function uploadPhoto(data) {
  return apiRequest('/api/photos/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertPromotion(data) {
  return apiRequest('/api/promotions/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function upsertBooking(data) {
  return apiRequest('/api/bookings/upsert', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Deletes ───
export async function deletePatient(id) {
  return apiRequest(`/api/patients/${id}`, { method: 'DELETE' });
}

export async function deleteAppointment(id) {
  return apiRequest(`/api/appointments/${id}`, { method: 'DELETE' });
}

export async function deleteReceipt(id) {
  return apiRequest(`/api/receipts/${id}`, { method: 'DELETE' });
}

export async function deletePhoto(id) {
  return apiRequest(`/api/photos/${id}`, { method: 'DELETE' });
}

export async function deleteInventoryItem(id) {
  return apiRequest(`/api/inventory/${id}`, { method: 'DELETE' });
}

export async function deleteLabOrder(id) {
  return apiRequest(`/api/lab_orders/${id}`, { method: 'DELETE' });
}

export async function deleteExpense(id) {
  return apiRequest(`/api/expenses/${id}`, { method: 'DELETE' });
}

export async function deleteSubscription(id) {
  return apiRequest(`/api/subscriptions/${id}`, { method: 'DELETE' });
}

export async function deletePromotion(id) {
  return apiRequest(`/api/promotions/${id}`, { method: 'DELETE' });
}

export async function deleteBooking(id) {
  return apiRequest(`/api/bookings/${id}`, { method: 'DELETE' });
}

// ─── Public Booking ───
export async function getPublicClinic(clinicId) {
  return apiRequest(`/api/public/clinic/${clinicId}`);
}

export async function submitBooking(data) {
  return apiRequest('/api/public/booking', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Medical Cards (Stage 2) ───
export async function getMedicalCard(patientId) {
  return apiRequest(`/api/medical-cards/${patientId}`);
}

export async function upsertMedicalCard(data) {
  return apiRequest('/api/medical-cards/upsert', { method: 'POST', body: JSON.stringify(data) });
}

// ─── ICD-10 ───
export async function getICD10(search) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(`/api/icd10${q}`);
}

// ─── Visits ───
export async function getVisits(clinicId, patientId) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinic_id', clinicId);
  if (patientId) params.set('patient_id', patientId);
  return apiRequest(`/api/visits?${params}`);
}

export async function upsertVisit(data) {
  return apiRequest('/api/visits/upsert', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Documents ───
export async function getDocuments(clinicId, patientId) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinic_id', clinicId);
  if (patientId) params.set('patient_id', patientId);
  return apiRequest(`/api/documents?${params}`);
}

export async function upsertDocument(data) {
  return apiRequest('/api/documents/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteDocument(id) {
  return apiRequest(`/api/documents/${id}`, { method: 'DELETE' });
}

// ─── Audit Log ───
export async function getAuditLog(clinicId, limit = 100) {
  return apiRequest(`/api/audit-log?clinic_id=${clinicId}&limit=${limit}`);
}

// ─── Backup ───
export async function createBackup(clinicId) {
  return apiRequest('/api/backup', { method: 'POST', body: JSON.stringify({ clinic_id: clinicId }) });
}

// ─── Treatments ───
export async function upsertTreatment(data) {
  return apiRequest('/api/treatments/upsert', { method: 'POST', body: JSON.stringify(data) });
}

export async function getTreatments(clinicId) {
  return apiRequest(`/api/clinic/${clinicId}/data`).then(d => d.treatments || []);
}
