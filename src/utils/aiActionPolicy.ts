/** Centralized client-side AI action safety policy. Backend remains authoritative. */

const MUTATING_ACTIONS = new Set([
  'CreateAppointment','UpdateAppointment','UpdateAppointmentStatus','CancelAppointment',
  'CreatePatient','UpdatePatient','DeletePatient','CreateLabOrder','UpdateLabOrder','CancelLabOrder',
  'CreateInvoice','UpdateInvoice','CancelInvoice','CreateTreatmentPlan','UpdateTreatmentPlan','DeleteTreatmentPlan',
  'CreateDiagnosticReferral','UpdateDiagnosticReferral','CancelDiagnosticReferral','ApplyToothFindings',
  'UpdateTooth','UpdateDentalChart','GenerateDailyReport',
]);

// Fail closed for write-like model action names, while deliberately excluding Open*/Navigate navigation actions.
const MUTATION_VERBS = /^(create|update|delete|remove|cancel|book|reschedule|assign|unassign|add|apply|write|record|pay|charge|refund|issue|send|submit|approve|reject|archive|restore|complete|close)/i;

export function isMutatingActionType(type: string): boolean {
  const normalized = String(type || '').trim();
  return Boolean(normalized) && (MUTATING_ACTIONS.has(normalized) || MUTATION_VERBS.test(normalized));
}

export function isNavigationActionType(type: string): boolean {
  const normalized = String(type || '').trim();
  return /^open_/i.test(normalized) || /^navigate$/i.test(normalized) || /^Open[A-Z]/.test(normalized);
}

export function requiresExplicitConfirmation(params: { type: string; requiresConfirmation?: boolean; confidence?: number }): boolean {
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
