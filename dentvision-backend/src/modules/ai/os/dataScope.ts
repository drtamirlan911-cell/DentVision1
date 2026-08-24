/**
 * Surface/tool table for the governance kernel.
 *
 * `SURFACE_TOOLS` answers a structural question the permission graph cannot:
 * even a caller with every clinic permission in the world must never reach a
 * staff-only tool from the patient surface — the surfaces are different
 * front doors onto different tool registries, not different views of one.
 * Each surface's set is derived from that surface's own registry, so it
 * cannot silently drift out of sync with what actually exists there.
 */

import { listToolNames } from './tools.js';
import { FORBIDDEN_PARAM_NAMES, listPatientToolNames } from '../../ai-patient/patientTools.js';
import { toolsRegistry as adminToolsRegistry } from '../../ai-admin/llm/tools/tools.registry.js';
import type { AiSurface } from './kernel.types.js';

export { FORBIDDEN_PARAM_NAMES };

const STAFF_TOOLS = new Set(listToolNames());
const PATIENT_TOOLS_SET = new Set(listPatientToolNames());
const ADMIN_TOOLS_SET = new Set(adminToolsRegistry.map((t) => t.name));

export const SURFACE_TOOLS: Record<AiSurface, ReadonlySet<string>> = {
  staff: STAFF_TOOLS,
  admin: ADMIN_TOOLS_SET,
  patient: PATIENT_TOOLS_SET,
};

const ALL_TOOLS = new Set([...STAFF_TOOLS, ...ADMIN_TOOLS_SET, ...PATIENT_TOOLS_SET]);

export function assertSurfaceTool(surface: AiSurface, tool: string): boolean {
  return SURFACE_TOOLS[surface]?.has(tool) ?? false;
}

/** Whether a tool exists on *any* surface — distinguishes "no such tool" from "wrong surface". */
export function toolExistsAnywhere(tool: string): boolean {
  return ALL_TOOLS.has(tool);
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
 * Staff tools whose `patientId` argument is *required* — an unambiguous
 * single target — mapped to that argument's key. These are what the
 * kernel's patient-scope check (step 5, `env.AI_PATIENT_SCOPE`) verifies a
 * DOCTOR/ASSISTANT is actually assigned to.
 *
 * Tools where `patientId` is optional (`getVisits`, `getTreatmentPlans` —
 * omitting it means "the whole clinic") are deliberately excluded: gating
 * only the single-patient case while leaving the clinic-wide list case wide
 * open would be a false sense of scope, not real scope. Closing that gap is
 * future work, not this flag's job.
 */
export const TOOL_PATIENT_ARG: Record<string, string> = {
  getPatientCard: 'patientId',
  createTreatmentPlan: 'patientId',
  createAppointment: 'patientId',
  createInvoice: 'patientId',
};

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
 * On admin/patient there is no equivalent protected call site upstream, so
 * `confirmed` is stripped here, along with any argument name that could
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
