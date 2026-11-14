import prisma from '../../../lib/prisma.js'
import type { AiAdminSession, AiAdminMessage } from '@prisma/client'
import type { Channel } from '../webhook/types.js'
import { decryptAiAdminJson, decryptAiAdminText, encryptAiAdminJson, encryptAiAdminText, getAiAdminExternalUserIdHashes, hashAiAdminExternalUserId } from './phi.js'

interface GetOrCreateSessionParams {
  clinicId: string
  configId: string
  channel: Channel
  externalUserId: string
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

const LEGACY_WORKERS_DRAINED_ACK = 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS';

function strictExternalIdWriteMode(): boolean {
  if (process.env.AI_ADMIN_EXTERNAL_ID_STRICT_WRITE !== 'true') return false;
  if (process.env.AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED !== LEGACY_WORKERS_DRAINED_ACK) {
    throw new Error('[phi] Strict AI Admin external-ID writes require explicit confirmation that all legacy workers are drained');
  }
  return true;
}

async function activateSession(row: AiAdminSession, hash: string, now: Date, strict: boolean): Promise<AiAdminSession> {
  if (row.externalUserIdHash !== hash || !row.externalUserIdCiphertext) {
    throw new Error('[phi] AI Admin external identity row is incomplete; guarded backfill is required');
  }
  if (strict && row.externalUserId !== null) {
    const cleared = await prisma.aiAdminSession.updateMany({
      where: { id: row.id, externalUserId: row.externalUserId, externalUserIdHash: hash },
      data: { externalUserId: null },
    });
    if (cleared.count !== 1) {
      const latest = await prisma.aiAdminSession.findUnique({ where: { id: row.id } });
      if (!latest || latest.externalUserId !== null || latest.externalUserIdHash !== hash || !latest.externalUserIdCiphertext) {
        throw new Error('[phi] AI Admin legacy identifier could not be cleared safely');
      }
    }
  }
  return prisma.aiAdminSession.update({ where: { id: row.id }, data: { status: 'ACTIVE', lastMessageAt: now } });
}

async function activateWithCurrentIndex(
  row: AiAdminSession,
  hash: string,
  readableHashes: string[],
  now: Date,
  strict: boolean,
): Promise<AiAdminSession> {
  let indexedRow = row;
  if (row.externalUserIdHash !== hash) {
    if (!row.externalUserIdHash || !readableHashes.includes(row.externalUserIdHash)) {
      throw new Error('[phi] AI Admin external identity index uses an unavailable key');
    }
    try {
      const changed = await prisma.aiAdminSession.updateMany({
        where: { id: row.id, externalUserIdHash: row.externalUserIdHash },
        data: { externalUserIdHash: hash },
      });
      if (changed.count === 1) {
        indexedRow = { ...row, externalUserIdHash: hash };
      } else {
        const latest = await prisma.aiAdminSession.findUnique({ where: { id: row.id } });
        if (!latest || latest.externalUserIdHash !== hash || !latest.externalUserIdCiphertext) {
          throw new Error('[phi] AI Admin external identity index changed concurrently');
        }
        indexedRow = latest;
      }
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const winner = await prisma.aiAdminSession.findFirst({
        where: { channel: row.channel, clinicId: row.clinicId, externalUserIdHash: hash },
      });
      if (!winner) throw error;
      indexedRow = winner;
    }
  }
  return activateSession(indexedRow, hash, now, strict);
}

async function migrateLegacySession(
  legacy: AiAdminSession, externalUserId: string, hash: string, now: Date, strict: boolean,
): Promise<AiAdminSession | null> {
  const result = await prisma.aiAdminSession.updateMany({
    where: { id: legacy.id, externalUserId, externalUserIdHash: null },
    data: {
      externalUserId: strict ? null : externalUserId,
      externalUserIdCiphertext: encryptAiAdminText(externalUserId),
      externalUserIdHash: hash,
      status: 'ACTIVE',
      lastMessageAt: now,
    },
  });
  if (result.count === 1) {
    const row = await prisma.aiAdminSession.findUnique({ where: { id: legacy.id } });
    if (row) return activateSession(row, hash, now, strict);
  }
  const winner = await prisma.aiAdminSession.findFirst({
    where: { channel: legacy.channel, clinicId: legacy.clinicId, externalUserIdHash: hash },
  });
  return winner ? activateSession(winner, hash, now, strict) : null;
}

export async function getOrCreateSession(params: GetOrCreateSessionParams): Promise<AiAdminSession> {
  const externalUserId = params.externalUserId.trim();
  if (!externalUserId || externalUserId.length > 256) throw new Error('[phi] AI Admin external identity is invalid');
  const strict = strictExternalIdWriteMode();
  const identity = { clinicId: params.clinicId, channel: params.channel, externalUserId };
  const hash = hashAiAdminExternalUserId(identity);
  const readableHashes = getAiAdminExternalUserIdHashes(identity);
  const now = new Date();
  const byHash = { channel: params.channel, externalUserIdHash: { in: readableHashes }, clinicId: params.clinicId };

  const existing = await prisma.aiAdminSession.findFirst({ where: byHash });
  if (existing) return activateWithCurrentIndex(existing, hash, readableHashes, now, strict);

  const legacyWhere = { channel: params.channel, externalUserId, externalUserIdHash: null, clinicId: params.clinicId };
  const legacy = await prisma.aiAdminSession.findFirst({ where: legacyWhere });
  if (legacy) {
    const migrated = await migrateLegacySession(legacy, externalUserId, hash, now, strict);
    if (migrated) return migrated;
  }

  try {
    return await prisma.aiAdminSession.create({
      data: {
        clinicId: params.clinicId,
        configId: params.configId,
        channel: params.channel,
        // Dual-write by default so old workers still resolve the same session.
        externalUserId: strict ? null : externalUserId,
        externalUserIdCiphertext: encryptAiAdminText(externalUserId),
        externalUserIdHash: hash,
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await prisma.aiAdminSession.findFirst({ where: byHash });
    if (winner) return activateWithCurrentIndex(winner, hash, readableHashes, now, strict);
    const legacyWinner = await prisma.aiAdminSession.findFirst({ where: legacyWhere });
    if (legacyWinner) {
      const migrated = await migrateLegacySession(legacyWinner, externalUserId, hash, now, strict);
      if (migrated) return migrated;
    }
    throw error;
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
