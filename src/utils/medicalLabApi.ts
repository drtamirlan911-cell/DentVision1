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
export interface MedicalLabOrder { id: string; clinicId: string; patientId?: string | null; treatmentCaseId?: string | null; labId?: string | null; accessionRequired?: boolean; orderedByUserId: string; status: MedicalLabStatus; priority: string; notes?: string | null; specimenType?: string | null; collectedAt?: string | null; receivedAt?: string | null; resultReadyAt?: string | null; verifiedAt?: string | null; interpretation?: string | null; metadata?: unknown; createdAt: string; updatedAt?: string | null; }
export interface MedicalLabTest { id: string; orderId: string; testId?: string | null; name: string; analyteCode?: string | null; result?: string | null; unit?: string | null; referenceRange?: string | null; flag?: string | null; resultText?: string | null; metadata?: unknown; verifiedAt?: string | null; verifiedByUserId?: string | null; }
export interface MedicalLabEvent { id: string; orderId: string; clinicId: string; fromStatus?: string | null; toStatus: string; note?: string | null; actorUserId: string; createdAt: string; }
export interface MedicalLabSpecimen { id: string; orderId: string; labId: string; accessionNumber: string; parentSpecimenId?: string | null; specimenType: string; containerType?: string | null; volume?: string | number | null; volumeUnit?: string | null; status: string; location?: string | null; collectedAt: string; receivedAt?: string | null; createdByUserId: string; receivedByUserId?: string | null; createdAt: string; }
export interface MedicalLabSpecimenEvent { id: string; specimenId: string; orderId: string; labId: string; eventType: string; fromStatus?: string | null; toStatus?: string | null; location?: string | null; note?: string | null; actorUserId: string; createdAt: string; metadata?: unknown; }
export interface MedicalLabDetail {
  order: MedicalLabOrder;
  tests: MedicalLabTest[];
  events: MedicalLabEvent[];
  specimens?: MedicalLabSpecimen[];
  specimenEvents?: MedicalLabSpecimenEvent[];
  capabilities?: string[];
  isLaboratoryWorkspace?: boolean;
}

export interface MedicalLabCapabilities {
  laboratoryId: string;
  roles: string[];
  capabilities: string[];
}
export interface MedicalLabFinance {
  wallet: { id: string; ownerType: 'PARTNER'; ownerId: string; currency: string; balance: string };
  availableBalanceMinor: string;
  canRequestPayout: boolean;
  payouts: Array<{ id: string; amount: string; status: 'requested' | 'approved' | 'paid' | 'rejected'; createdAt: string; updatedAt: string }>;
  economics: {
    period: { from: string | null; to: string | null };
    totals: {
      operations: number;
      grossMinor: string;
      commissionMinor: string;
      partnerPayoutMinor: string;
      costMinor: string;
      contributionMarginMinor: string;
      contributionMarginBps: number;
    };
    rows: Array<{
      transactionId: string;
      operationId: string;
      grossMinor: string;
      commissionMinor: string;
      partnerPayoutMinor: string;
      status: string;
      economicsVersion: number;
      payoutId: string | null;
      payoutStatus: string | null;
      payoutAmountMinor: string | null;
    }>;
    discrepancies: number;
  };
}
export const getMedicalLabCapabilities = () => request<MedicalLabCapabilities>('/capabilities');
export const getMedicalLabFinance = () => request<MedicalLabFinance>('/finance');
export const requestMedicalLabPayout = (amount: string) =>
  request<{ id: string; amount: string; status: 'requested' }>(
    '/payouts',
    { method: 'POST', body: JSON.stringify({ amount: amount.trim() }) },
  );

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
export const performMedicalLabQualityControl = (id: string, decision: 'passed' | 'failed', note?: string) =>
  request<MedicalLabOrder>(`/orders/${id}/quality-control`, { method: 'POST', body: JSON.stringify({ decision, note }) });
export const verifyMedicalLabOrder = (id: string) => request<MedicalLabOrder>(`/orders/${id}/verify`, { method: 'POST' });
export const saveMedicalLabInterpretation = (id: string, interpretation: string, source: 'human' | 'ai' = 'human') => request<MedicalLabOrder>(`/orders/${id}/interpretation`, { method: 'POST', body: JSON.stringify({ interpretation, source }) });

export const createMedicalLabSpecimen = (id: string, body: { specimenType?: string; containerType?: string; volume?: number; volumeUnit?: string; location?: string; barcode?: string }) =>
  request<MedicalLabSpecimen>('/orders/' + id + '/specimens', { method: 'POST', body: JSON.stringify(body) });
export const scanMedicalLabSpecimen = (id: string, body: { barcode: string; action?: 'received' | 'rejected'; location?: string; note?: string }) =>
  request<{ specimen: MedicalLabSpecimen; order: MedicalLabOrder; orderAdvanced: boolean }>('/orders/' + id + '/specimens/scan', { method: 'POST', body: JSON.stringify(body) });
export const createMedicalLabAliquot = (id: string, specimenId: string, body: { specimenType?: string; containerType?: string; volume?: number; volumeUnit?: string; location?: string; barcode?: string }) =>
  request<MedicalLabSpecimen>('/orders/' + id + '/specimens/' + specimenId + '/aliquots', { method: 'POST', body: JSON.stringify(body) });
