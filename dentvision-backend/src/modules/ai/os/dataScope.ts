/**
 * Surface/tool table for the governance kernel.
 *
 * `SURFACE_TOOLS` answers a structural question the permission graph cannot:
 * even a caller with every clinic permission in the world must never reach a
 * staff-only tool from the patient surface — the surfaces are different
 * front doors onto different tool registries, not different views of one.
 *
 * Only 'staff' is populated here: `os/tools.ts` is the staff tool registry.
 * 'admin' and 'patient' fill in during Stage 5, when the ai-admin and
 * ai-patient tool surfaces migrate onto this kernel — until then nothing
 * calls `runAiAction` with those surfaces, so an empty set is simply correct
 * (denies everything, which is what "not wired up yet" should do).
 */

import { listToolNames } from './tools.js';
import { FORBIDDEN_PARAM_NAMES } from '../../ai-patient/patientTools.js';
import type { AiSurface } from './kernel.types.js';

export { FORBIDDEN_PARAM_NAMES };

const STAFF_TOOLS = new Set(listToolNames());

export const SURFACE_TOOLS: Record<AiSurface, ReadonlySet<string>> = {
  staff: STAFF_TOOLS,
  admin: new Set(),
  patient: new Set(),
};

export function assertSurfaceTool(surface: AiSurface, tool: string): boolean {
  return SURFACE_TOOLS[surface]?.has(tool) ?? false;
}

/**
 * Tools whose consequence (money committed, a clinical record created, a
 * patient's slot released) is expensive enough to undo that a self-confirm
 * click is no longer enough authority — a second, separately-authorized
 * person must approve before the kernel executes it (`kernel.ts` step 6).
 * Every other mutating tool keeps today's single-click confirm behavior.
 */
export const HIGH_RISK_TOOLS: ReadonlySet<string> = new Set(['createInvoice', 'createTreatmentPlan', 'cancelAppointment']);

/**
 * Strips what a model must never control.
 *
 * On the staff surface this is a deliberate no-op for `confirmed`: the
 * *only* caller that lets a model propose a fresh tool call is
 * `orchestrator.ts`, and it already runs every model-supplied argument
 * through `stripModelConfirmation` at its own call site before reaching the
 * kernel at all. `POST /api/ai/confirm` and `POST /api/ai/action` are the
 * other two callers, and they call the kernel with `confirmed: true` on
 * purpose — that flag *is* the human's explicit confirmation, produced by a
 * tool's own `needsConfirmation.params` echo, and stripping it here would
 * mean no mutating tool could ever move past its own proposal stage.
 *
 * On admin/patient (Stage 5) there is no equivalent protected call site yet,
 * so `confirmed` is stripped here, along with any argument name that could
 * carry an identity the caller didn't actually verify — clinic id, patient
 * id, contact details.
 */
export function sanitizeArgs(surface: AiSurface, args: Record<string, unknown>): Record<string, unknown> {
  if (surface === 'staff') return args;
  const { confirmed: _confirmed, ...rest } = args;
  const cleaned: Record<string, unknown> = { ...rest };
  for (const key of FORBIDDEN_PARAM_NAMES) delete cleaned[key];
  return cleaned;
}
