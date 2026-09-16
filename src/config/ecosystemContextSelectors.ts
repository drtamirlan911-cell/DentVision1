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
  // `/diagnostics/lab` is the existing shared lab entry route. The explicit
  // workspace query keeps medical laboratory and dental laboratory semantics
  // separate without inventing a second backend domain or breaking existing
  // deep links/bookmarks.
  'medical-lab': '/diagnostics/lab?workspace=medical-lab',
  'dental-lab': '/crm/lab',
  market: '/shop',
  finance: '/crm/cashier',
  academy: '/school',
  jobs: '/jobs',
  settings: '/settings',
};

export function ecosystemPath(target: EcosystemDeepLinkTarget, selection?: Partial<EcosystemContextSelection>) {
  const base = PATHS[target];
  const [pathname, existingQuery] = base.split('?');
  const params = new URLSearchParams(existingQuery || '');
  if (selection?.organizationId) params.set('organizationId', selection.organizationId);
  if (selection?.branchId) params.set('branchId', selection.branchId);
  if (selection?.patientId) params.set('patient', selection.patientId);
  if (selection?.caseId) params.set('caseId', selection.caseId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function caseContext(selection: Partial<EcosystemContextSelection>) {
  return {
    patientId: selection.patientId,
    caseId: selection.caseId,
    branchId: selection.branchId,
    organizationId: selection.organizationId,
  };
}
