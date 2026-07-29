import prisma from '../../../lib/prisma.js'
import type { AiAdminSession, AiAdminMessage } from '@prisma/client'
import type { Channel } from '../webhook/types.js'

interface GetOrCreateSessionParams {
  clinicId: string
  configId: string
  channel: Channel
  externalUserId: string
}

export async function getOrCreateSession(
  params: GetOrCreateSessionParams,
): Promise<AiAdminSession> {
  const existing = await prisma.aiAdminSession.findFirst({
    where: {
      channel: params.channel,
      externalUserId: params.externalUserId,
      clinicId: params.clinicId,
    },
  })

  if (existing) {
    return prisma.aiAdminSession.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', lastMessageAt: new Date() },
    })
  }

  return prisma.aiAdminSession.create({
    data: {
      clinicId: params.clinicId,
      configId: params.configId,
      channel: params.channel,
      externalUserId: params.externalUserId,
      status: 'ACTIVE',
    },
  })
}

export async function getRecentMessages(
  sessionId: string,
  limit = 20,
): Promise<AiAdminMessage[]> {
  return prisma.aiAdminMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  }).then((msgs) => msgs.reverse())
}

export async function saveMessage(params: {
  sessionId: string
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: string
  toolName?: string
  toolResult?: object
  tokensUsed?: number
  latencyMs?: number
}): Promise<void> {
  await prisma.aiAdminMessage.create({ data: params as any })
}

export async function markEscalated(
  sessionId: string,
  reason: string,
  lastUserMessage: string,
): Promise<void> {
  const session = await prisma.aiAdminSession.update({
    where: { id: sessionId },
    data: { status: 'ESCALATED' },
  })

  await prisma.aiAdminEscalation.create({
    data: {
      sessionId,
      clinicId: session.clinicId,
      reason,
      lastUserMessage,
    },
  })

  const { notifyClinicOwners } = await import('../../billing/clinicSubscription.service.js')
  await notifyClinicOwners(
    session.clinicId,
    'Требуется помощь администратора',
    `Пациент в ${session.channel} ожидает ответа. Причина: ${reason}`,
  )
}
