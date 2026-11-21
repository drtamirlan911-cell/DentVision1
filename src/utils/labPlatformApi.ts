import { API_URL } from './apiOrigin';
import { getAccessToken } from './api';

const BASE = `${API_URL}/api/lab-orders/platform`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) throw new Error(body?.error || `API ${res.status}`);
  return body?.data as T;
}

export interface LabPlatformOrder {
  id: string;
  clinicId: string;
  clinicName: string;
  patientId?: string | null;
  patientName: string;
  doctorId?: string | null;
  type: string;
  material: string;
  toothNumber: string | number;
  shade: string;
  notes: string;
  deadline?: string | null;
  price?: number | null;
  status: string;
  technicianId?: string | null;
  remakeOfId?: string | null;
  appointmentId?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  servicePriceSnapshot?: number | null;
  createdAt: string;
  updatedAt: string;
  qualityControl?: { checks: Record<string, boolean>; passed: boolean; note: string | null; checkedByUserId: string; checkedAt: string } | null;
}

export interface LabPlatformDashboard {
  lab: { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null; email?: string | null };
  membershipRole: string;
  totals: { all: number; active: number; dueSoon: number; overdue: number };
  byStatus: Record<string, number>;
  priority: LabPlatformOrder[];
}

export interface AvailableDentalLab {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
}
export const getAvailableDentalLabs = () => request<AvailableDentalLab[]>('/available-laboratories');
export const getLabPlatformDashboard = () => request<LabPlatformDashboard>('/dashboard');
export const getLabPlatformOrders = (status?: string) => request<LabPlatformOrder[]>(status ? `/orders?status=${encodeURIComponent(status)}` : '/orders');
export const updateLabPlatformOrderStatus = (id: string, status: string) => request<LabPlatformOrder>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const assignLabTechnician = (id: string, technicianId: string | null) => request<LabPlatformOrder>(`/orders/${id}/technician`, { method: 'PATCH', body: JSON.stringify({ technicianId }) });
export const updateLabPlatformQualityControl = (id: string, checks: Record<string, boolean>, note?: string) => request<LabPlatformOrder>(`/orders/${id}/qc`, { method: 'PATCH', body: JSON.stringify({ checks, note }) });
export const getLabPlatformTeam = () => request<Array<{ id: string; role?: string; firstName: string; lastName: string; email: string; avatar?: string | null }>>('/team');
export const assignClinicLabOrder = (orderId: string, laboratoryId: string, serviceId?: string) => request<LabPlatformOrder>('/assign', { method: 'POST', body: JSON.stringify({ orderId, laboratoryId, ...(serviceId ? { serviceId } : {}) }) });

export interface DentalLabService {
  id: string; labId: string; code: string; name: string; category: string;
  description?: string | null; material?: string | null; defaultPrice: number;
  turnaroundDays: number; active: boolean; createdAt: string; updatedAt: string;
}
export interface AvailableDentalLabService {
  id: string; code: string; name: string; category: string;
  description?: string | null; material?: string | null; defaultPrice: number; turnaroundDays: number;
}
export const getDentalLabServices = () => request<DentalLabService[]>('/services');
export const createDentalLabService = (body: { code: string; name: string; category: string; description?: string; material?: string; defaultPrice: number; turnaroundDays: number }) =>
  request<DentalLabService>('/services', { method: 'POST', body: JSON.stringify(body) });
export const updateDentalLabService = (id: string, body: Partial<Pick<DentalLabService, 'code' | 'name' | 'category' | 'description' | 'material' | 'defaultPrice' | 'turnaroundDays' | 'active'>>) =>
  request<DentalLabService>(`/services/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
export const getAvailableDentalLabServices = (labId: string) =>
  request<AvailableDentalLabService[]>(`/available-laboratories/${encodeURIComponent(labId)}/services`);
