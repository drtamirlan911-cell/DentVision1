import type { EcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';

/**
 * Carries the active DentVision workspace context across module navigation.
 * Keep identifiers in the URL so a clinical workflow survives route changes,
 * refreshes and direct links without introducing a second client-side state.
 */
export function withEcosystemContext(path: string, context: EcosystemUrlContext): string {
  const [pathname, rawQuery = ''] = path.split('?');
  const params = new URLSearchParams(rawQuery);

  if (context.organizationId) params.set('organizationId', context.organizationId);
  if (context.branchId) params.set('branchId', context.branchId);
  if (context.patientId) params.set('patient', context.patientId);
  if (context.caseId) params.set('caseId', context.caseId);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ecosystemContextQuery(context: EcosystemUrlContext): string {
  const query = withEcosystemContext('', context);
  return query.startsWith('?') ? query : query.replace(/^\?/, '');
}
