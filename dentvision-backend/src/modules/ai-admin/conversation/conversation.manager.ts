import prisma from '../../../lib/prisma.js'
import type { AiAdminSession, AiAdminMessage } from '@prisma/client'
import type { Channel } from '../webhook/types.js'
import { decryptAiAdminJson, decryptAiAdminText, encryptAiAdminJson, encryptAiAdminText, hashAiAdminExternalUserId } from './phi.js'

interface GetOrCreateSessionParams {
  clinicId: string
  configId: string
  channel: Channel
  externalUserId: string
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

export async function getOrCreateSession(params: GetOrCreateSessionParams): Promise<AiAdminSession> {
  const externalUserId = params.externalUserId.trim();
  if (!externalUserId || externalUserId.length > 256) throw new Error('[phi] AI Admin external identity is invalid');
  const externalUserIdHash = hashAiAdminExternalUserId({ ...params, externalUserId });
  const now = new Date();
  const byHash = { channel: params.channel, externalUserIdHash, clinicId: params.clinicId };

  const existing = await prisma.aiAdminSession.findFirst({ where: byHash });
  if (existing) {
    if (existing.externalUserId != null || !existing.externalUserIdCiphertext) {
      throw new Error('[phi] AI Admin external identity row is incomplete; guarded backfill is required');
    }
    return prisma.aiAdminSession.update({
      where: { id: existing.id }, data: { status: 'ACTIVE', lastMessageAt: now },
    });
  }

  const legacy = await prisma.aiAdminSession.findFirst({
    where: { channel: params.channel, externalUserId, externalUserIdHash: null, clinicId: params.clinicId },
  });
  if (legacy) {
    const migrated = await prisma.aiAdminSession.updateMany({
      where: { id: legacy.id, externalUserId, externalUserIdHash: null },
      data: {
        externalUserId: null,
        externalUserIdCiphertext: encryptAiAdminText(externalUserId),
        externalUserIdHash,
        status: 'ACTIVE',
        lastMessageAt: now,
      },
    });
    if (migrated.count === 1) {
      const row = await prisma.aiAdminSession.findUnique({ where: { id: legacy.id } });
      if (row) return row;
    }
    const winner = await prisma.aiAdminSession.findFirst({ where: byHash });
    if (winner) return prisma.aiAdminSession.update({
      where: { id: winner.id }, data: { status: 'ACTIVE', lastMessageAt: now },
    });
  }

  try {
    return await prisma.aiAdminSession.create({
      data: {
        clinicId: params.clinicId,
        configId: params.configId,
        channel: params.channel,
        externalUserId: null,
        externalUserIdCiphertext: encryptAiAdminText(externalUserId),
        externalUserIdHash,
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await prisma.aiAdminSession.findFirst({ where: byHash });
    if (!winner) throw error;
    return prisma.aiAdminSession.update({
      where: { id: winner.id }, data: { status: 'ACTIVE', lastMessageAt: now },
    });
  }
}

export async function getRecentMessages(
  sessionId: string,
  limit = 20,
): Promise<AiAdminMessage[]> {
  const messages = await prisma.aiAdminMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return messages.reverse().map((message) => ({
    ...message,
    content: decryptAiAdminText(message.content),
    toolResult: message.toolResult == null
      ? message.toolResult
      : decryptAiAdminJson(message.toolResult) as any,
  }))
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
  await prisma.aiAdminMessage.create({
    data: {
      ...params,
      content: encryptAiAdminText(params.content),
      toolResult: params.toolResult == null
        ? undefined
        : encryptAiAdminJson(params.toolResult) as any,
    } as any,
  })
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
      reason: encryptAiAdminText(reason),
      lastUserMessage: encryptAiAdminText(lastUserMessage),
    },
  })

  const { notifyClinicOwners } = await import('../../billing/clinicSubscription.service.js')
  await notifyClinicOwners(
    session.clinicId,
    'Требуется помощь администратора',
    `Пациент в ${session.channel} ожидает ответа. Откройте очередь эскалаций для подробностей.`,
  )
}
