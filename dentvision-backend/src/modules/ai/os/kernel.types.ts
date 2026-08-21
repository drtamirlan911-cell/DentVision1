/**
 * Governance kernel types — DentVision Agentic OS.
 *
 * `AiPrincipal` is who is asking (resolved by a surface adapter, never built
 * from raw request data by a tool). `AiInvocation` is what they're asking
 * for. `KernelResult` is the only shape `runAiAction` ever returns — every
 * outcome (allowed, denied, or awaiting a human) carries an `activityId`
 * because every outcome gets recorded, including denials.
 */

export type AiSurface = 'staff' | 'admin' | 'patient';

export interface AiPrincipal {
  surface: AiSurface;
  /** 'system:ai-admin:<sessionId>' for the ai-admin webhook surface — not a `User.id`. */
  userId: string;
  /** Requested clinic scope — NEVER trusted as-is; re-verified inside the kernel. */
  requestedClinicId: string | null;
  isGuest?: boolean;
  /** Set only on the patient surface. */
  patientId?: string | null;
  /** `AgentDefinition.id` from registry.ts, when a specific agent led the turn. */
  agentId?: string;
  sessionId?: string | null;
  ip?: string | null;
}

export interface AiInvocation {
  tool: string;
  args: Record<string, unknown>;
  /** Set only by the approvals route re-entering the kernel after a human approved. */
  approvalId?: string | null;
  traceId?: string;
}

export type AiDenyReason =
  | 'NO_TOOL'
  | 'NOT_ON_SURFACE'
  | 'NOT_ALLOWED'
  | 'NO_PERMISSION'
  | 'NO_CLINIC'
  | 'CLINIC_MISMATCH'
  | 'OUT_OF_PATIENT_SCOPE'
  | 'EXEC_ERROR'
  /** `approvalId` didn't resolve to an approved row for this exact tool/clinic. */
  | 'INVALID_APPROVAL';

export type KernelResult =
  | { status: 'ok'; data: unknown; navigate?: string; activityId: string }
  | { status: 'denied'; reason: AiDenyReason; error: string; activityId: string }
  | {
      status: 'pending_approval';
      approvalId: string;
      summary: string;
      action: string;
      params: Record<string, unknown>;
      activityId: string;
    };
