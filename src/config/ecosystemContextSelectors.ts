import type { EcosystemParticipant } from './ecosystem';

export interface EcosystemContextSelection {
  participant: EcosystemParticipant;
  organizationId?: string;
  branchId?: string;
  patientId?: string;
  caseId?: string;
}

export type EcosystemDeepLinkTarget =
  | 'ai'
  | 'patient'
  | 'case'
  | 'appointment'
  | 'diagnostics'
  | 'medical-lab'
  | 'dental-lab'
  | 'market'
  | 'finance'
  | 'academy'
  | 'jobs'
  | 'settings';

const PATHS: Record<EcosystemDeepLinkTarget, string> = {
  ai: '/ai',
  patient: '/crm/patients',
  case: '/crm/cases',
  appointment: '/crm/schedule',
  diagnostics: '/diagnostics',
  'medical-lab': '/diagnostics/lab',
  'dental-lab': '/crm/lab',
  market: '/shop',
  finance: '/crm/cashier',
  academy: '/school',
  jobs: '/jobs',
  settings: '/settings',
};

export function ecosystemPath(target: EcosystemDeepLinkTarget, selection?: Partial<EcosystemContextSelection>) {
  const base = PATHS[target];
  const params = new URLSearchParams();
  if (selection?.organizationId) params.set('organizationId', selection.organizationId);
  if (selection?.branchId) params.set('branchId', selection.branchId);
  if (selection?.patientId) params.set('patient', selection.patientId);
  if (selection?.caseId) params.set('caseId', selection.caseId);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function caseContext(selection: Partial<EcosystemContextSelection>) {
  return {
    patientId: selection.patientId,
    caseId: selection.caseId,
    branchId: selection.branchId,
    organizationId: selection.organizationId,
  };
}
