/**
 * Governance kernel — DentVision Agentic OS.
 *
 * `runAiAction` is the one path every AI tool call must go through, on every
 * surface. It does not invent authorization — `resolveAiToolAccess` (identity
 * + role + clinic + permission) and `TOOLS` (the tool implementations) already
 * exist and are unchanged here — it makes the four things the spec calls
 * non-negotiable actually happen around them: every call is recorded (allowed
 * or denied), evidence is written instead of assumed, and the surface a
 * caller reached the kernel from cannot exceed the tool set that surface owns
 * regardless of what permissions the caller otherwise holds.
 *
 * Fixed 8-step sequence (Agentic OS spec §8):
 *   1. surface/tool exists       → NO_TOOL / NOT_ON_SURFACE
 *   2. sanitize args             → strip what a model must never set
 *   3. resolve identity          → resolveAiToolAccess (DB-verified, unchanged)
 *   4. permission check          → NOT_ALLOWED (access.allowed already folds
 *                                   TOOL_PERMISSIONS + permissionsSatisfy in)
 *   5. patient scope             → stub until Stage 6 (AI_PATIENT_SCOPE flag)
 *   6. approval requirement      → stub until Stage 4 (AiApproval table)
 *   7. execute                   → TOOLS[tool].execute(args, ctx)
 *   8. record activity + evidence → always, including on denial
 */

import prisma from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';
import { resolveOrganizationIdForClinic } from '../../../lib/orgContext.js';
import { resolveAiToolAccess } from './access.js';
import { TOOLS, type ToolContext, type ToolResult } from './tools.js';
import { TOOL_PERMISSIONS } from './toolPermissions.js';
import { SURFACE_TOOLS, sanitizeArgs } from './dataScope.js';
import type { AiPrincipal, AiInvocation, KernelResult, AiDenyReason } from './kernel.types.js';

function isPhiTool(tool: string): boolean {
  return (TOOL_PERMISSIONS[tool] || '').startsWith('medical.');
}

/** Best-effort, non-throwing: activity recording must never break the caller's action. */
async function recordActivity(row: {
  traceId?: string;
  surface: string;
  agentId?: string | null;
  tool: string;
  actorUserId: string;
  actorRole: string;
  clinicId: string | null;
  organizationId: string | null;
  status: 'ok' | 'tool_error' | 'denied';
  denyReason?: AiDenyReason | null;
  argsRedacted?: Record<string, unknown> | null;
  resultSummary?: string | null;
  durationMs?: number | null;
  approvalId?: string | null;
}): Promise<string> {
  const id = uid();
  try {
    await prisma.agentActivity.create({
      data: {
        id,
        traceId: row.traceId || null,
        surface: row.surface,
        agentId: row.agentId || null,
        tool: row.tool,
        actorUserId: row.actorUserId,
        actorRole: row.actorRole,
        clinicId: row.clinicId,
        organizationId: row.organizationId,
        visibility: row.clinicId ? 'clinic' : 'platform',
        sensitivity: isPhiTool(row.tool) ? 'phi' : 'standard',
        status: row.status,
        denyReason: row.denyReason || null,
        argsRedacted: (row.argsRedacted as never) ?? undefined,
        resultSummary: row.resultSummary || null,
        durationMs: row.durationMs ?? null,
        approvalId: row.approvalId || null,
      },
    });
  } catch (err) {
    console.error('[ai kernel] failed to record activity:', err);
  }
  return id;
}

/** Best-effort, non-throwing, same reasoning as `recordActivity`. */
async function recordEvidence(
  activityId: string,
  entries: Array<{ sourceType: string; sourceId: string; access?: string; clinicId?: string | null; snapshot?: unknown }>,
): Promise<void> {
  if (!entries.length) return;
  try {
    await prisma.actionEvidence.createMany({
      data: entries.map((e) => ({
        id: uid(),
        activityId,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        access: e.access || null,
        clinicId: e.clinicId || null,
        snapshot: (e.snapshot as never) ?? undefined,
      })),
    });
  } catch (err) {
    console.error('[ai kernel] failed to record evidence:', err);
  }
}

/** Redacts nothing structurally sensitive yet (Stage 10 tags context-sourced args) — caps size so a huge payload never bloats the ledger. */
function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(args ?? {});
  if (json.length <= 2000) return args;
  return { _truncated: true, preview: json.slice(0, 2000) };
}

export async function runAiAction(p: AiPrincipal, inv: AiInvocation): Promise<KernelResult> {
  const tool = TOOLS[inv.tool];

  // Step 1 — the tool must exist, and this surface must own it.
  if (!tool) {
    const activityId = await recordActivity({
      traceId: inv.traceId,
      surface: p.surface,
      agentId: p.agentId,
      tool: inv.tool,
      actorUserId: p.userId,
      actorRole: p.isGuest ? 'GUEST' : 'unknown',
      clinicId: null,
      organizationId: null,
      status: 'denied',
      denyReason: 'NO_TOOL',
    });
    return { status: 'denied', reason: 'NO_TOOL', error: `Инструмент ${inv.tool} не существует`, activityId };
  }
  if (!SURFACE_TOOLS[p.surface]?.has(inv.tool)) {
    const activityId = await recordActivity({
      traceId: inv.traceId,
      surface: p.surface,
      agentId: p.agentId,
      tool: inv.tool,
      actorUserId: p.userId,
      actorRole: p.isGuest ? 'GUEST' : 'unknown',
      clinicId: null,
      organizationId: null,
      status: 'denied',
      denyReason: 'NOT_ON_SURFACE',
    });
    return { status: 'denied', reason: 'NOT_ON_SURFACE', error: `Инструмент ${inv.tool} недоступен на этой поверхности`, activityId };
  }

  // Step 2 — strip what a model must never set.
  const args = sanitizeArgs(p.surface, inv.args);

  // Step 3 — resolve identity fresh from the DB. `p.requestedClinicId` is a
  // claim, never used directly below this line.
  const access = await resolveAiToolAccess({
    userId: p.userId,
    clinicId: p.requestedClinicId,
    isGuest: p.isGuest,
  });
  const organizationId = access.clinicId ? await resolveOrganizationIdForClinic(access.clinicId) : null;

  // Step 4 — `access.allowed` already folds the agent registry and
  // TOOL_PERMISSIONS/permissionsSatisfy together (see access.ts); a second,
  // independent re-derivation would need the raw permission set access.ts
  // deliberately keeps internal, so this is the single source of truth for
  // "may this caller invoke this tool" rather than a duplicate of it.
  if (!access.allowed.has(inv.tool)) {
    const activityId = await recordActivity({
      traceId: inv.traceId,
      surface: p.surface,
      agentId: p.agentId,
      tool: inv.tool,
      actorUserId: p.userId,
      actorRole: access.role,
      clinicId: access.clinicId,
      organizationId,
      status: 'denied',
      denyReason: 'NOT_ALLOWED',
      argsRedacted: redactArgs(args),
    });
    return { status: 'denied', reason: 'NOT_ALLOWED', error: 'Действие недоступно для вашей роли', activityId };
  }

  // Step 5 — patient scope. Stub: enforced starting Stage 6, behind
  // env.AI_PATIENT_SCOPE, only for surface === 'staff' and DOCTOR/ASSISTANT.

  // Step 6 — approval requirement. Stub: mutating tools execute immediately
  // until Stage 4 introduces AiApproval; `inv.approvalId` is accepted here
  // (typed) so the approvals route can re-enter the kernel without a
  // signature change once that stage lands.
  void inv.approvalId;

  const ctx: ToolContext = { userId: p.userId, clinicId: access.clinicId, role: access.role };

  // Step 7 — execute.
  const startedAt = Date.now();
  let toolResult: ToolResult;
  try {
    toolResult = await tool.execute(args, ctx);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof Error && error.message === 'NO_CLINIC') {
      const activityId = await recordActivity({
        traceId: inv.traceId,
        surface: p.surface,
        agentId: p.agentId,
        tool: inv.tool,
        actorUserId: p.userId,
        actorRole: access.role,
        clinicId: access.clinicId,
        organizationId,
        status: 'denied',
        denyReason: 'NO_CLINIC',
        argsRedacted: redactArgs(args),
        durationMs,
      });
      return { status: 'denied', reason: 'NO_CLINIC', error: 'Нет активной клиники — выберите рабочее пространство', activityId };
    }
    console.error(`[ai kernel] tool ${inv.tool} failed:`, error);
    const activityId = await recordActivity({
      traceId: inv.traceId,
      surface: p.surface,
      agentId: p.agentId,
      tool: inv.tool,
      actorUserId: p.userId,
      actorRole: access.role,
      clinicId: access.clinicId,
      organizationId,
      status: 'denied',
      denyReason: 'EXEC_ERROR',
      argsRedacted: redactArgs(args),
      durationMs,
    });
    return { status: 'denied', reason: 'EXEC_ERROR', error: 'Ошибка выполнения инструмента', activityId };
  }
  const durationMs = Date.now() - startedAt;

  // Step 8 — record, always.
  const activityId = await recordActivity({
    traceId: inv.traceId,
    surface: p.surface,
    agentId: p.agentId,
    tool: inv.tool,
    actorUserId: p.userId,
    actorRole: access.role,
    clinicId: access.clinicId,
    organizationId,
    status: toolResult.ok ? 'ok' : 'tool_error',
    argsRedacted: redactArgs(args),
    resultSummary: toolResult.ok ? undefined : toolResult.error,
    durationMs,
    approvalId: inv.approvalId || undefined,
  });
  await recordEvidence(activityId, [
    {
      sourceType: 'tool',
      sourceId: inv.tool,
      access: toolResult.ok ? 'verified' : 'rejected',
      clinicId: access.clinicId,
      snapshot: { ok: toolResult.ok, error: toolResult.error, navigate: toolResult.navigate },
    },
  ]);

  return { status: 'ok', data: toolResult, navigate: toolResult.navigate, activityId };
}
