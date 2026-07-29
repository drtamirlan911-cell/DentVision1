import prisma from '../../../lib/prisma.js'
import { uid } from '../../../lib/helpers.js'

interface AuditParams {
  sessionId: string
  clinicId: string
  userMessage: string
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
        details: {
          userMessage: params.userMessage.slice(0, 500),
          assistantMessage: params.assistantMessage.slice(0, 500),
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
