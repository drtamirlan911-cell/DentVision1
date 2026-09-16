import { API_URL } from './apiOrigin';
import { getAccessToken } from './api';

const BASE = `${API_URL}/api/lab-orders/medical-laboratory`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) throw new Error(body?.error || `API ${res.status}`);
  return body?.data as T;
}

export type MedicalLabStatus = 'draft' | 'ordered' | 'sample_collected' | 'received' | 'processing' | 'result_ready' | 'verified' | 'cancelled';
export interface MedicalLabOrder { id: string; clinicId: string; patientId?: string | null; treatmentCaseId?: string | null; labId?: string | null; orderedByUserId: string; status: MedicalLabStatus; priority: string; notes?: string | null; specimenType?: string | null; collectedAt?: string | null; receivedAt?: string | null; resultReadyAt?: string | null; verifiedAt?: string | null; interpretation?: string | null; metadata?: unknown; createdAt: string; updatedAt?: string | null; }
export interface MedicalLabTest { id: string; orderId: string; testId?: string | null; name: string; analyteCode?: string | null; result?: string | null; unit?: string | null; referenceRange?: string | null; flag?: string | null; resultText?: string | null; metadata?: unknown; verifiedAt?: string | null; verifiedByUserId?: string | null; }
export interface MedicalLabEvent { id: string; orderId: string; clinicId: string; fromStatus?: string | null; toStatus: string; note?: string | null; actorUserId: string; createdAt: string; }
export interface MedicalLabDetail { order: MedicalLabOrder; tests: MedicalLabTest[]; events: MedicalLabEvent[]; }

export const listMedicalLabOrders = (params: { patientId?: string; caseId?: string; status?: string } = {}) => {
  const q = new URLSearchParams();
  if (params.patientId) q.set('patientId', params.patientId);
  if (params.caseId) q.set('caseId', params.caseId);
  if (params.status) q.set('status', params.status);
  return request<MedicalLabOrder[]>(`/orders${q.toString() ? `?${q}` : ''}`);
};
export const getMedicalLabOrder = (id: string) => request<MedicalLabDetail>(`/orders/${id}`);
export const createMedicalLabOrder = (body: { patientId?: string; treatmentCaseId?: string; labId?: string; priority?: string; notes?: string; specimenType?: string; tests?: Array<{ name: string; testId?: string; analyteCode?: string }>; metadata?: unknown }) => request<MedicalLabOrder>('/orders', { method: 'POST', body: JSON.stringify(body) });
export const updateMedicalLabStatus = (id: string, status: MedicalLabStatus, note?: string) => request<MedicalLabOrder>(`/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) });
export const saveMedicalLabResults = (id: string, results: Array<Partial<MedicalLabTest> & { id: string }>) => request<MedicalLabOrder>(`/orders/${id}/results`, { method: 'POST', body: JSON.stringify({ results }) });
export const verifyMedicalLabOrder = (id: string) => request<MedicalLabOrder>(`/orders/${id}/verify`, { method: 'POST' });
export const saveMedicalLabInterpretation = (id: string, interpretation: string, source: 'human' | 'ai' = 'human') => request<MedicalLabOrder>(`/orders/${id}/interpretation`, { method: 'POST', body: JSON.stringify({ interpretation, source }) });
