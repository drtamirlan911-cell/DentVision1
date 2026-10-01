export type ContentSurface = 'ACADEMY' | 'MARKETPLACE';
export type ContentAudience = 'GENERAL' | 'PATIENT' | 'PROFESSIONAL' | 'DOCTOR' | 'DENTAL_STUDENT' | 'ASSISTANT' | 'LAB' | 'DIAGNOSTIC' | 'SELLER';
export type ActiveContentContext = 'PUBLIC' | 'PATIENT' | 'BUYER' | 'DOCTOR' | 'DENTAL_STUDENT' | 'ASSISTANT' | 'LAB' | 'DIAGNOSTIC' | 'SELLER' | 'LECTURER';

export interface ContentAccessRequest {
  surface: ContentSurface;
  activeContext: ActiveContentContext;
  audiences: readonly ContentAudience[];
}

const CONTEXT_AUDIENCES: Readonly<Record<ActiveContentContext, readonly ContentAudience[]>> = {
  PUBLIC: ['GENERAL'],
  PATIENT: ['GENERAL', 'PATIENT'],
  BUYER: ['GENERAL', 'PROFESSIONAL'],
  DOCTOR: ['GENERAL', 'PROFESSIONAL', 'DOCTOR'],
  DENTAL_STUDENT: ['GENERAL', 'PROFESSIONAL', 'DENTAL_STUDENT'],
  ASSISTANT: ['GENERAL', 'PROFESSIONAL', 'ASSISTANT'],
  LAB: ['GENERAL', 'PROFESSIONAL', 'LAB'],
  DIAGNOSTIC: ['GENERAL', 'PROFESSIONAL', 'DIAGNOSTIC'],
  SELLER: ['GENERAL', 'PROFESSIONAL', 'SELLER'],
  LECTURER: ['GENERAL', 'PROFESSIONAL'],
};

const PROFESSIONAL_AUDIENCES: ReadonlySet<ContentAudience> = new Set([
  'PROFESSIONAL',
  'DOCTOR',
  'DENTAL_STUDENT',
  'ASSISTANT',
  'LAB',
  'DIAGNOSTIC',
  'SELLER',
]);

export function canAccessContent(request: ContentAccessRequest): boolean {
  const audiences = request.audiences;
  if ((request.activeContext === 'PATIENT' || request.activeContext === 'PUBLIC') && audiences.some((audience) => PROFESSIONAL_AUDIENCES.has(audience))) {
    return false;
  }
  return audiences.some((audience) => CONTEXT_AUDIENCES[request.activeContext].includes(audience));
}

export function getAllowedAudiences(activeContext: ActiveContentContext): readonly ContentAudience[] {
  return CONTEXT_AUDIENCES[activeContext];
}

export function isProfessionalAudience(audience: ContentAudience): boolean {
  return PROFESSIONAL_AUDIENCES.has(audience);
}
