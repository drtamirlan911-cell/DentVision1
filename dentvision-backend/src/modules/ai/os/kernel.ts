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
 * Fixed 8-step sequence (Agentic OS spec §8), on all three surfaces:
 *   1. surface/tool exists       → NO_TOOL / NOT_ON_SURFACE
 *   2. sanitize args             → strip what a model must never set
 *   3. resolve identity          → staff: resolveAiToolAccess (DB-verified).
 *                                   admin/patient: identity is already
 *                                   verified by the caller before reaching
 *                                   the kernel (webhook session lookup /
 *                                   portal session → patientId) — there is no
 *                                   role/permission model to check for either,
 *                                   so step 1's surface gate is their full
 *                                   authorization, exactly as before this stage.
 *   4. permission check          → staff only; NOT_ALLOWED (access.allowed
 *                                   already folds TOOL_PERMISSIONS +
 *                                   permissionsSatisfy in)
 *   5. patient scope             → staff DOCTOR/ASSISTANT only, and only on
 *                                   tools with a required patientId, behind
 *                                   env.AI_PATIENT_SCOPE (default off)
 *   6. approval requirement      → HIGH_RISK_TOOLS only (staff tool names,
 *                                   so this never matches on admin/patient)
 *   7. execute                   → dispatches to the surface's own registry:
 *                                   TOOLS (staff) / executePatientTool
 *                                   (patient) / executeToolCall (admin, the
 *                                   same function Stage 1 hardened)
 *   8. record activity + evidence → always, including on denial
 */

import prisma from '../../../lib/prisma.js';
import { env } from '../../../config.js';
import { uid } from '../../../lib/helpers.js';
import { resolveOrganizationIdForClinic } from '../../../lib/orgContext.js';
import { resolveAiToolAccess } from './access.js';
import { TOOLS, type ToolContext } from './tools.js';
import { TOOL_PERMISSIONS } from './toolPermissions.js';
import { SURFACE_TOOLS, HIGH_RISK_TOOLS, TOOL_PATIENT_ARG, sanitizeArgs, toolExistsAnywhere } from './dataScope.js';
import { SKILLS, skillPermissionSatisfied } from './skills.js';
import { executePatientTool } from '../../ai-patient/patientTools.js';
import { executeToolCall as executeAdminToolCall } from '../../ai-admin/llm/tools/tools.registry.js';
import type { AiPrincipal, AiInvocation, KernelResult, AiDenyReason } from './kernel.types.js';

/** The three tool registries return different shapes; every surface adapter below normalizes into this one before steps 7-8 look at it. */
interface ExecResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  navigate?: string;
}

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

function isPhiTool(tool: string): boolean {
  return (TOOL_PERMISSIONS[tool] || '').startsWith('medical.');
}

/**
 * A tool's own `needsConfirmation.summary` (built with a DB-resolved patient
 * name) never survives into the confirm round-trip's `params` — only the raw
 * arguments do. Good enough for an approval to be actioned from without a
 * second DB round-trip here; the Approval Center can resolve names for
 * display when it needs to.
 */
function buildApprovalSummary(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'createInvoice':
      return `Счёт на ${args.amount ?? '?'} для пациента ${args.patientId ?? '?'}`;
    case 'createTreatmentPlan':
      return `План лечения «${args.title ?? '?'}» для пациента ${args.patientId ?? '?'}`;
    case 'cancelAppointment':
      return `Отмена записи ${args.appointmentId ?? '?'}${args.reason ? ` — ${args.reason}` : ''}`;
    default:
      return tool;
  }
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
  patientId?: string | null;
  status: 'ok' | 'tool_error' | 'denied' | 'pending_approval';
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
        patientId: row.patientId || null,
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
  // Step 1 — the tool must exist, and this surface must own it.
  if (!toolExistsAnywhere(inv.tool)) {
    const activityId = await recordActivity({
      traceId: inv.traceId,
      surface: p.surface,
      agentId: p.agentId,
      tool: inv.tool,
      actorUserId: p.userId,
      actorRole: p.isGuest ? 'GUEST' : 'unknown',
      clinicId: null,
      organizationId: null,
      patientId: p.patientId,
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
      patientId: p.patientId,
      status: 'denied',
      denyReason: 'NOT_ON_SURFACE',
    });
    return { status: 'denied', reason: 'NOT_ON_SURFACE', error: `Инструмент ${inv.tool} недоступен на этой поверхности`, activityId };
  }

  // Step 2 — strip what a model must never set.
  const args = sanitizeArgs(p.surface, inv.args);

  // Step 3 — resolve identity. Staff: DB-verified role + clinic + permission
  // via resolveAiToolAccess, exactly as before. Admin/patient: the surface
  // adapter already verified identity before reaching the kernel (webhook
  // session lookup / portal session → patientId) — there is no role or
  // permission model to resolve for either, so `allowedTools` stays null and
  // step 4 below is skipped, matching their pre-kernel trust boundary exactly.
  let role: string;
  let clinicId: string | null;
  let allowedTools: Set<string> | null = null;
  if (p.surface === 'staff') {
    const access = await resolveAiToolAccess({
      userId: p.userId,
      clinicId: p.requestedClinicId,
      isGuest: p.isGuest,
    });
    role = access.role;
    clinicId = access.clinicId;
    allowedTools = access.allowed;
  } else if (p.surface === 'patient') {
    role = 'PATIENT';
    clinicId = p.requestedClinicId;
  } else {
    role = 'SYSTEM';
    clinicId = p.requestedClinicId;
  }
  const organizationId = clinicId ? await resolveOrganizationIdForClinic(clinicId) : null;

  // Step 4 — staff only. `access.allowed` already folds the agent registry
  // and TOOL_PERMISSIONS/permissionsSatisfy together (see access.ts); a
  // second, independent re-derivation would need the raw permission set
  // access.ts deliberately keeps internal, so this is the single source of
  // truth for "may this caller invoke this tool" rather than a duplicate of it.
  if (allowedTools && !allowedTools.has(inv.tool)) {
    const activityId = await recordActivity({
      traceId: inv.traceId,
      surface: p.surface,
      agentId: p.agentId,
      tool: inv.tool,
      actorUserId: p.userId,
      actorRole: role,
      clinicId,
      organizationId,
      patientId: p.patientId,
      status: 'denied',
      denyReason: 'NOT_ALLOWED',
      argsRedacted: redactArgs(args),
    });
    return { status: 'denied', reason: 'NOT_ALLOWED', error: 'Действие недоступно для вашей роли', activityId };
  }

  // Step 4b — named skill boundary (optional). A narrower gate on top of the
  // per-tool check above, not instead of it: `inv.skillId` restricts this
  // call to one named composition of tools (os/skills.ts) and that skill's
  // own declared permission — real authorization, not prompt-level framing.
  if (inv.skillId) {
    const skill = SKILLS[inv.skillId];
    const skillOk =
      !!skill &&
      skill.surfaces.includes(p.surface) &&
      skill.tools.includes(inv.tool) &&
      skillPermissionSatisfied(allowedTools, skill.requiredPermission);
    if (!skillOk) {
      const activityId = await recordActivity({
        traceId: inv.traceId,
        surface: p.surface,
        agentId: p.agentId,
        tool: inv.tool,
        actorUserId: p.userId,
        actorRole: role,
        clinicId,
        organizationId,
        patientId: p.patientId,
        status: 'denied',
        denyReason: 'NOT_IN_SKILL',
        argsRedacted: redactArgs(args),
      });
      return { status: 'denied', reason: 'NOT_IN_SKILL', error: 'Действие недоступно в рамках этого skill', activityId };
    }
  }

  // Step 5 — patient scope. AI-only (human REST/UI is unaffected); off
  // unless env.AI_PATIENT_SCOPE === 'on', and only for the tools in
  // TOOL_PATIENT_ARG where the target patient is unambiguous.
  if (env.AI_PATIENT_SCOPE === 'on' && p.surface === 'staff' && (role === 'DOCTOR' || role === 'ASSISTANT')) {
    const patientArg = TOOL_PATIENT_ARG[inv.tool];
    const targetPatientId = patientArg ? args[patientArg] : undefined;
    if (targetPatientId) {
      const assignment = await prisma.patientAssignment.findFirst({
        where: { patientId: String(targetPatientId), userId: p.userId, active: true },
        select: { id: true },
      });
      if (!assignment) {
        const activityId = await recordActivity({
          traceId: inv.traceId,
          surface: p.surface,
          agentId: p.agentId,
          tool: inv.tool,
          actorUserId: p.userId,
          actorRole: role,
          clinicId,
          organizationId,
          patientId: p.patientId,
          status: 'denied',
          denyReason: 'OUT_OF_PATIENT_SCOPE',
          argsRedacted: redactArgs(args),
        });
        return { status: 'denied', reason: 'OUT_OF_PATIENT_SCOPE', error: 'Этот пациент не в вашей зоне ответственности', activityId };
      }
    }
  }

  // Step 6 — approval requirement, high-risk tools only.
  //
  // A tool call only reaches this point with `args.confirmed === true` on the
  // *second* leg of its own propose/confirm round-trip (`sanitizeArgs` no
  // longer strips `confirmed` on the staff surface — see its docstring). The
  // first leg (`confirmed` absent) still falls straight through to step 7:
  // the tool itself returns its own soft `needsConfirmation` preview without
  // this gate ever running, exactly as before this stage. Only the moment a
  // high-risk tool is about to *actually* mutate does the kernel intercept it.
  if (HIGH_RISK_TOOLS.has(inv.tool) && args.confirmed === true) {
    if (inv.approvalId) {
      const approval = await prisma.aiApproval.findUnique({ where: { id: inv.approvalId } });
      const valid =
        approval &&
        approval.status === 'approved' &&
        approval.tool === inv.tool &&
        approval.clinicId === clinicId;
      if (!valid) {
        const activityId = await recordActivity({
          traceId: inv.traceId,
          surface: p.surface,
          agentId: p.agentId,
          tool: inv.tool,
          actorUserId: p.userId,
          actorRole: role,
          clinicId,
          organizationId,
          patientId: p.patientId,
          status: 'denied',
          denyReason: 'INVALID_APPROVAL',
          argsRedacted: redactArgs(args),
        });
        return { status: 'denied', reason: 'INVALID_APPROVAL', error: 'Подтверждение недействительно или уже использовано', activityId };
      }
      // Valid, approved reference — fall through to step 7.
    } else {
      const approvalId = uid();
      const summary = buildApprovalSummary(inv.tool, args);
      try {
        await prisma.aiApproval.create({
          data: {
            id: approvalId,
            clinicId,
            organizationId,
            requestedByUserId: p.userId,
            surface: p.surface,
            agentId: p.agentId || null,
            tool: inv.tool,
            params: args as never,
            summary,
            requiredPermission: TOOL_PERMISSIONS[inv.tool] || null,
            riskLevel: 'high',
            status: 'pending',
            expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
          },
        });
        if (clinicId) {
          const { createNotificationForClinic } = await import('../../../services/notification.service.js');
          await createNotificationForClinic(
            clinicId,
            {
              type: 'ai_approval_requested',
              title: 'Требуется подтверждение действия ИИ',
              message: summary,
              link: '/agent-activity',
            },
            { roles: ['OWNER', 'DIRECTOR', 'ADMIN'] },
          );
        }
      } catch (err) {
        console.error('[ai kernel] failed to create approval:', err);
      }
      const activityId = await recordActivity({
        traceId: inv.traceId,
        surface: p.surface,
        agentId: p.agentId,
        tool: inv.tool,
        actorUserId: p.userId,
        actorRole: role,
        clinicId,
        organizationId,
        patientId: p.patientId,
        status: 'pending_approval',
        argsRedacted: redactArgs(args),
        resultSummary: summary,
        approvalId,
      });
      return { status: 'pending_approval', approvalId, summary, action: inv.tool, params: args, activityId };
    }
  }

  // Step 7 — execute, dispatching to the surface's own tool registry. Each
  // branch normalizes into `ExecResult` before steps 7-8 look at it; only the
  // staff branch's own `TOOLS[tool].execute` already speaks that shape
  // natively (it's `ToolResult`, structurally identical).
  const startedAt = Date.now();
  let toolResult: ExecResult;
  try {
    if (p.surface === 'staff') {
      const ctx: ToolContext = { userId: p.userId, clinicId, role };
      toolResult = await TOOLS[inv.tool].execute(args, ctx);
    } else if (p.surface === 'patient') {
      const data = await executePatientTool(inv.tool, args, {
        userId: p.userId,
        patientId: p.patientId || '',
        clinicId,
      });
      toolResult = { ok: true, data };
    } else {
      // admin: `p.sessionId` is the `AiAdminSession.id` the webhook resolved.
      // `executeToolCall` is the exact function Stage 1 hardened against a
      // model-supplied `clinic_id` — reused as-is, not reimplemented here.
      const session = p.sessionId ? await prisma.aiAdminSession.findUnique({ where: { id: p.sessionId } }) : null;
      if (!session) throw new Error('NO_CLINIC');
      const data = await executeAdminToolCall(inv.tool, args, session);
      toolResult = { ok: true, data };
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof Error && error.message === 'NO_CLINIC') {
      const activityId = await recordActivity({
        traceId: inv.traceId,
        surface: p.surface,
        agentId: p.agentId,
        tool: inv.tool,
        actorUserId: p.userId,
        actorRole: role,
        clinicId,
        organizationId,
        patientId: p.patientId,
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
      actorRole: role,
      clinicId,
      organizationId,
      patientId: p.patientId,
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
    actorRole: role,
    clinicId,
    organizationId,
    patientId: p.patientId,
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
      clinicId,
      snapshot: { ok: toolResult.ok, error: toolResult.error, navigate: toolResult.navigate },
    },
  ]);

  return { status: 'ok', data: toolResult, navigate: toolResult.navigate, activityId };
}
