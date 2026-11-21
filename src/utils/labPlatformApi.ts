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

export interface DentalLabShipment {
  id: string;
  labOrderId: string;
  laboratoryId: string;
  method: 'COURIER' | 'PICKUP';
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  status: 'dispatched' | 'ready_for_pickup' | 'delivered';
  dispatchedAt: string;
  deliveredAt?: string | null;
  proofUrl?: string | null;
  recipientName?: string | null;
  deliveryNote?: string | null;
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
  remakeRequest?: { id: string; status: 'requested' | 'accepted' | 'rejected'; reason: string; requestedByUserId: string; requestedAt: string; laboratoryId: string; decidedByUserId?: string; decidedAt?: string; responseNote?: string | null } | null;
  shipment?: DentalLabShipment | null;
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
export const updateLabPlatformRemakeRequest = (id: string, decision: 'accept' | 'reject', note?: string) => request<LabPlatformOrder>(`/orders/${id}/remake-request`, { method: 'PATCH', body: JSON.stringify({ decision, note }) });
export const createLabPlatformShipment = (id: string, body: { method: 'COURIER' | 'PICKUP'; carrier?: string; trackingNumber?: string; trackingUrl?: string; note?: string }) =>
  request<{ shipment: DentalLabShipment; order: LabPlatformOrder; idempotent?: boolean }>(`/orders/${id}/shipment`, { method: 'POST', body: JSON.stringify(body) });
export const confirmLabPlatformDelivery = (id: string, body: { proofUrl: string; recipientName: string; note?: string }) =>
  request<{ order: LabPlatformOrder; shipment: DentalLabShipment; idempotent?: boolean }>(`/orders/${id}/shipment/delivery-confirmation`, { method: 'POST', body: JSON.stringify(body) });
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
