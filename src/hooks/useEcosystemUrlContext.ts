import { useLocation } from 'react-router-dom';

export interface EcosystemUrlContext {
  organizationId?: string;
  branchId?: string;
  patientId?: string;
  caseId?: string;
}

export function useEcosystemUrlContext(): EcosystemUrlContext {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return {
    organizationId: params.get('organizationId') || undefined,
    branchId: params.get('branchId') || undefined,
    patientId: params.get('patientId') || undefined,
    caseId: params.get('caseId') || undefined,
  };
}

export function ecosystemUrlContextFromSearch(search: string): EcosystemUrlContext {
  const params = new URLSearchParams(search);
  return {
    organizationId: params.get('organizationId') || undefined,
    branchId: params.get('branchId') || undefined,
    patientId: params.get('patientId') || undefined,
    caseId: params.get('caseId') || undefined,
  };
}
