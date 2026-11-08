import prisma from '../../../lib/prisma.js'
import { uid } from '../../../lib/helpers.js'

interface AuditParams {
  sessionId: string
  clinicId: string
  /** Used only to record presence; message text may contain PHI. */
  userMessage: string
  /** Used only to record presence; response text may contain PHI. */
  assistantMessage: string
  toolsCalled: string[]
  tokensUsed: number
  latencyMs: number
  escalated: boolean
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        clinicId: params.clinicId,
        action: params.escalated ? 'AI_ADMIN_ESCALATED' : 'AI_ADMIN_CONVERSATION',
        entityType: 'ai_admin_session',
        entityId: params.sessionId,
        // Keep operational telemetry, never duplicate patient conversation text
        // into the general-purpose audit log JSONB column.
        details: {
          userMessagePresent: params.userMessage.length > 0,
          assistantResponsePresent: params.assistantMessage.length > 0,
          toolsCalled: params.toolsCalled,
          tokensUsed: params.tokensUsed,
          latencyMs: params.latencyMs,
        },
      },
    })
  } catch (err) {
    console.error('[audit] Failed to log AI admin event:', err)
  }
}
