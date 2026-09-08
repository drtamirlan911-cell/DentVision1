import type { AIAction } from '@/utils/aiExecutor';

/**
 * Canonical AI OS tool names that mutate clinic state.
 * Keep this list aligned with dentvision-backend/src/modules/ai/os/tools.ts.
 * Navigation and read-only tools must never be blocked by this policy.
 */
export const MUTATING_AI_ACTIONS = new Set([
  'createAppointment',
  'cancelAppointment',
  'createInvoice',
  'createTreatmentPlan',
  'createLabOrder',
  'createDiagnosticReferral',
  'applyToothFindings',
  'updateAppointment',
  'updateAppointmentStatus',
  'createPatient',
  'updatePatient',
  'deletePatient',
  'CreateAppointment',
  'CancelAppointment',
  'CreateInvoice',
  'CreateTreatmentPlan',
  'CreateLabOrder',
  'CreateDiagnosticReferral',
  'ApplyToothFindings',
  'UpdateAppointment',
  'UpdateAppointmentStatus',
  'CreatePatient',
  'UpdatePatient',
  'DeletePatient',
]);

const MUTATION_VERBS = /^(create|update|delete|remove|cancel|book|apply|write|send|pay|charge|refund|issue|assign|unassign|archive|restore|merge|transfer)/i;

/** True when an AI action can change clinic/patient/business state. */
export function isMutatingAIAction(action: Pick<AIAction, 'type'> | string): boolean {
  const type = typeof action === 'string' ? action : action.type;
  if (!type) return false;
  return MUTATING_AI_ACTIONS.has(type) || MUTATION_VERBS.test(type);
}

/**
 * Explicit confirmation is mandatory for mutations. A server-provided
 * requiresConfirmation flag remains authoritative for non-mutating actions.
 */
export function requiresExplicitAIConfirmation(action: Pick<AIAction, 'type' | 'requiresConfirmation'>): boolean {
  return isMutatingAIAction(action) || action.requiresConfirmation === true;
}

export function isReadOnlyAIAction(action: Pick<AIAction, 'type' | 'requiresConfirmation'>): boolean {
  return !isMutatingAIAction(action) && action.requiresConfirmation !== true;
}
