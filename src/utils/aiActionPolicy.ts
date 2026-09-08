/**
 * Single source of truth for client-side AI action safety.
 *
 * Backend tools remain authoritative: mutating tools are confirmation-gated
 * server-side. This policy makes the UI fail closed as well, so a malformed
 * or incomplete model response cannot silently execute a mutation.
 */

const MUTATING_ACTIONS = new Set([
  'CreateAppointment',
  'UpdateAppointment',
  'UpdateAppointmentStatus',
  'CancelAppointment',
  'CreatePatient',
  'UpdatePatient',
  'DeletePatient',
  'CreateLabOrder',
  'UpdateLabOrder',
  'CancelLabOrder',
  'CreateInvoice',
  'UpdateInvoice',
  'CancelInvoice',
  'CreateTreatmentPlan',
  'UpdateTreatmentPlan',
  'DeleteTreatmentPlan',
  'CreateDiagnosticReferral',
  'UpdateDiagnosticReferral',
  'CancelDiagnosticReferral',
  'ApplyToothFindings',
  'UpdateTooth',
  'UpdateDentalChart',
  'GenerateDailyReport',
]);

const MUTATION_VERBS = /^(create|update|delete|remove|cancel|book|reschedule|assign|unassign|add|apply|write|record|pay|charge|refund|issue|send|submit|approve|reject|archive|restore|complete|close|openinvoice|createinvoice)/i;

export function isMutatingActionType(type: string): boolean {
  const normalized = String(type || '').trim();
  if (!normalized) return false;
  return MUTATING_ACTIONS.has(normalized) || MUTATION_VERBS.test(normalized);
}

export function isNavigationActionType(type: string): boolean {
  return /^open_|^navigate$/i.test(String(type || '').trim()) || /^Open[A-Z]/.test(String(type || '').trim());
}

export function requiresExplicitConfirmation(params: {
  type: string;
  requiresConfirmation?: boolean;
  confidence?: number;
}): boolean {
  if (isMutatingActionType(params.type)) return true;
  if (params.requiresConfirmation === true) return true;
  return (params.confidence ?? 1) <= 0.85;
}

export function withClinicalContext(
  params: Record<string, unknown> | undefined,
  context?: { patientId?: string | null; planId?: string | null; visitId?: string | null },
): Record<string, unknown> {
  const next = { ...(params || {}) };
  if (!next.patientId && context?.patientId) next.patientId = context.patientId;
  if (!next.planId && context?.planId) next.planId = context.planId;
  if (!next.visitId && context?.visitId) next.visitId = context.visitId;
  return next;
}
