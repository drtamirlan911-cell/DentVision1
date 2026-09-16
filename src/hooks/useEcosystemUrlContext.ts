import { useLocation } from 'react-router-dom';

export interface EcosystemUrlContext {
  organizationId?: string;
  branchId?: string;
  patientId?: string;
  caseId?: string;
}

function parse(search: string): EcosystemUrlContext {
  const params = new URLSearchParams(search);
  return {
    organizationId: params.get('organizationId') || undefined,
    branchId: params.get('branchId') || undefined,
    // `patient` is the canonical ecosystem deep-link key. Keep `patientId`
    // as a backwards-compatible alias for existing external links.
    patientId: params.get('patient') || params.get('patientId') || undefined,
    caseId: params.get('caseId') || undefined,
  };
}

export function useEcosystemUrlContext(): EcosystemUrlContext {
  const { search } = useLocation();
  return parse(search);
}

export function ecosystemUrlContextFromSearch(search: string): EcosystemUrlContext {
  return parse(search);
}
