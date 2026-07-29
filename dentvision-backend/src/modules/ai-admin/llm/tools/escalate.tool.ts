import { markEscalated } from '../../conversation/conversation.manager.js'
import type { AiAdminSession } from '@prisma/client'

interface EscalateArgs {
  reason: string
}

export async function escalateToHuman(
  args: EscalateArgs,
  session: AiAdminSession,
): Promise<{ escalated: boolean; message: string }> {
  await markEscalated(session.id, args.reason, '')

  return {
    escalated: true,
    message: 'Передаю вас живому администратору. Он ответит в ближайшее время в рабочие часы.',
  }
}
