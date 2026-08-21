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
 * Strips what a model must never control: the `confirmed` self-approval flag
 * on every surface, plus (on admin/patient) any argument name that could
 * carry an identity the caller didn't actually verify — clinic id, patient
 * id, contact details. Staff tools never accept those as arguments in the
 * first place (they read `ToolContext`, not `args`), so nothing extra needs
 * stripping there.
 */
export function sanitizeArgs(surface: AiSurface, args: Record<string, unknown>): Record<string, unknown> {
  const { confirmed: _confirmed, ...rest } = args;
  if (surface === 'staff') return rest;
  const cleaned: Record<string, unknown> = { ...rest };
  for (const key of FORBIDDEN_PARAM_NAMES) delete cleaned[key];
  return cleaned;
}
