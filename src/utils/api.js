// Temporary API shim for local/dev builds.
// Replace these with real backend calls when a backend endpoint is available.

const mockDelay = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

async function request(_path, _options = {}) {
  await mockDelay(0);
  return { ok: true, data: null };
}

export async function login(loginStr, password) {
  await mockDelay(0);
  console.debug('API login shim is disabled; using local auth fallback', { login: loginStr, passwordProvided: Boolean(password) });
  return null;
}

export async function getClinic(clinicId) {
  await mockDelay(0);
  return { id: clinicId, name: 'Local Clinic', active: true };
}

export async function getPatients() {
  await mockDelay(0);
  return [];
}

export async function getAppointments() {
  await mockDelay(0);
  return [];
}

export async function getReceipts() {
  await mockDelay(0);
  return [];
}

export async function getLabOrders() {
  await mockDelay(0);
  return [];
}

export async function getExpenses() {
  await mockDelay(0);
  return [];
}

export async function getInventory() {
  await mockDelay(0);
  return [];
}

export async function upsertPatient(data) {
  await request('/patients', { method: 'POST', body: data });
  return data;
}

export async function upsertAppointment(data) {
  await request('/appointments', { method: 'POST', body: data });
  return data;
}

export async function upsertReceipt(data) {
  await request('/receipts', { method: 'POST', body: data });
  return data;
}

export async function upsertLabOrder(data) {
  await request('/lab-orders', { method: 'POST', body: data });
  return data;
}

export async function upsertExpense(data) {
  await request('/expenses', { method: 'POST', body: data });
  return data;
}

export async function upsertInventoryItem(data) {
  await request('/inventory', { method: 'POST', body: data });
  return data;
}

export async function upsertUser(data) {
  await request('/users', { method: 'POST', body: data });
  return data;
}

export async function upsertSubscription(data) {
  await request('/subscriptions', { method: 'POST', body: data });
  return data;
}

export async function uploadPhoto(data) {
  await request('/photos', { method: 'POST', body: data });
  return data;
}

export async function deletePatient(id) {
  await request(`/patients/${id}`, { method: 'DELETE' });
  return true;
}

export async function deleteAppointment(id) {
  await request(`/appointments/${id}`, { method: 'DELETE' });
  return true;
}

export async function deleteReceipt(id) {
  await request(`/receipts/${id}`, { method: 'DELETE' });
  return true;
}

export async function deletePhoto(id) {
  await request(`/photos/${id}`, { method: 'DELETE' });
  return true;
}

export async function deleteInventoryItem(id) {
  await request(`/inventory/${id}`, { method: 'DELETE' });
  return true;
}

export async function deleteLabOrder(id) {
  await request(`/lab-orders/${id}`, { method: 'DELETE' });
  return true;
}

export async function deleteExpense(id) {
  await request(`/expenses/${id}`, { method: 'DELETE' });
  return true;
}

export async function deleteSubscription(id) {
  await request(`/subscriptions/${id}`, { method: 'DELETE' });
  return true;
}
