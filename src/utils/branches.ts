import { apiRequest } from './api';

export type ClinicBranch = {
  id: string;
  clinicId: string;
  code: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  active: boolean;
  isDefault: boolean;
  settings?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

const BRANCH_API = '/api/organizations/branches';

export async function getClinicBranches(clinicId: string): Promise<ClinicBranch[]> {
  return apiRequest(`${BRANCH_API}?clinicId=${encodeURIComponent(clinicId)}`);
}

export async function createClinicBranch(input: {
  clinicId: string;
  code?: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
}): Promise<ClinicBranch> {
  return apiRequest(BRANCH_API, { method: 'POST', body: JSON.stringify(input) });
}

export async function updateClinicBranch(id: string, input: Partial<Omit<ClinicBranch, 'id' | 'clinicId' | 'createdAt' | 'updatedAt'>>): Promise<ClinicBranch> {
  return apiRequest(`${BRANCH_API}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function assignClinicMemberToBranch(branchId: string, userId: string): Promise<{ userId: string; branchId: string }> {
  return apiRequest(`${BRANCH_API}/${encodeURIComponent(branchId)}/members/${encodeURIComponent(userId)}`, { method: 'POST' });
}
