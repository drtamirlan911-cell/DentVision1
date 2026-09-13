export type ContentSurface = 'ACADEMY' | 'MARKETPLACE';
export type ContentAudience = 'GENERAL' | 'PATIENT' | 'PROFESSIONAL' | 'DOCTOR' | 'DENTAL_STUDENT' | 'ASSISTANT' | 'LAB' | 'DIAGNOSTIC' | 'SELLER';
export type ActiveContentContext = 'PATIENT' | 'DOCTOR' | 'DENTAL_STUDENT' | 'ASSISTANT' | 'LAB' | 'DIAGNOSTIC' | 'SELLER' | 'LECTURER';

export interface ContentAccessRequest {
  surface: ContentSurface;
  activeContext: ActiveContentContext;
  audiences: readonly ContentAudience[];
}

const CONTEXT_AUDIENCES: Readonly<Record<ActiveContentContext, readonly ContentAudience[]>> = {
  PATIENT: ['GENERAL', 'PATIENT'],
  DOCTOR: ['GENERAL', 'PROFESSIONAL', 'DOCTOR'],
  DENTAL_STUDENT: ['GENERAL', 'PROFESSIONAL', 'DENTAL_STUDENT'],
  ASSISTANT: ['GENERAL', 'PROFESSIONAL', 'ASSISTANT'],
  LAB: ['GENERAL', 'PROFESSIONAL', 'LAB'],
  DIAGNOSTIC: ['GENERAL', 'PROFESSIONAL', 'DIAGNOSTIC'],
  SELLER: ['GENERAL', 'PROFESSIONAL', 'SELLER'],
  LECTURER: ['GENERAL', 'PROFESSIONAL'],
};

/** Backend policy: active context, not any other role held by the Person, controls content access. */
export function canAccessContent(request: ContentAccessRequest): boolean {
  return request.audiences.some((audience) => CONTEXT_AUDIENCES[request.activeContext].includes(audience));
}

/** Apply this allow-list to Academy catalog and Marketplace product queries before returning data. */
export function getAllowedAudiences(activeContext: ActiveContentContext): readonly ContentAudience[] {
  return CONTEXT_AUDIENCES[activeContext];
}

export function isProfessionalAudience(audience: ContentAudience): boolean {
  return audience === 'PROFESSIONAL' || audience === 'DOCTOR' || audience === 'DENTAL_STUDENT' || audience === 'ASSISTANT' || audience === 'LAB' || audience === 'DIAGNOSTIC' || audience === 'SELLER';
}
