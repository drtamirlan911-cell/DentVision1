import prisma from '../../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import type { NormalizedMessage } from '../webhook/types.js'

const MAX_ATTEMPTS = 3

export async function enqueueMessage(msg: NormalizedMessage): Promise<void> {
  const id = randomUUID()
  const payload = JSON.stringify(msg)

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO ai_admin_messages
      (id, channel, channel_account_id, external_message_id, payload, status, attempts, created_at, updated_at)
    VALUES
      (CAST(${id} AS uuid), ${msg.channel}, ${msg.channelAccountId}, ${msg.externalMessageId}, ${payload}::jsonb, 'pending', 0, NOW(), NOW())
    ON CONFLICT (channel, external_message_id) DO NOTHING
  `)
}

export async function claimMessages(limit = 10): Promise<Array<{ id: string; payload: NormalizedMessage; attempts: number }>> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; payload: NormalizedMessage; attempts: number }>>(Prisma.sql`
      SELECT id, payload, attempts
      FROM ai_admin_messages
      WHERE status = 'pending' AND attempts < ${MAX_ATTEMPTS}
      ORDER BY created_at ASC
      LIMIT ${Math.max(1, Math.min(limit, 50))}
      FOR UPDATE SKIP LOCKED
    `)
    if (!rows.length) return []

    await tx.$executeRaw(Prisma.sql`
      UPDATE ai_admin_messages
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE id IN (${Prisma.join(rows.map((r) => r.id))})
    `)
    return rows
  })
}

export async function completeMessage(id: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE ai_admin_messages SET status = 'completed', updated_at = NOW()
    WHERE id = CAST(${id} AS uuid)
  `)
}

export async function failMessage(id: string, error: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE ai_admin_messages
    SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END,
        error = ${error},
        updated_at = NOW()
    WHERE id = CAST(${id} AS uuid)
  `)
}

export async function recoverStaleMessages(leaseMs = 5 * 60 * 1000): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE ai_admin_messages
    SET status = 'pending', updated_at = NOW()
    WHERE status = 'processing' AND updated_at < ${new Date(Date.now() - leaseMs)}
  `)
}

// queue table binding is intentionally isolated from the conversation model.
