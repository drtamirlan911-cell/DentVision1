import { claimMessages, completeMessage, failMessage, recoverStaleMessages } from './message.queue.js'
import { resolveClinic } from '../resolver/clinic.resolver.js'
import { getOrCreateSession } from '../conversation/conversation.manager.js'
import { buildContext } from '../context/context.builder.js'
import { runLLMOrchestrator } from '../llm/llm.orchestrator.js'
import { sendMessage } from '../sender/messenger.sender.js'
import { logAudit } from '../audit/audit.logger.js'
import type { NormalizedMessage } from '../webhook/types.js'

const POLL_INTERVAL_MS = 1_000
const RECOVERY_INTERVAL_MS = 30_000
const BATCH_SIZE = 3

let polling = false
let stopped = false
let lastRecoveryAt = 0
let pollTimer: ReturnType<typeof setInterval> | null = null

async function processMessage(msg: NormalizedMessage): Promise<void> {
  const startedAt = Date.now()
  const clinicCtx = await resolveClinic(msg.channel, msg.channelAccountId)
  if (!clinicCtx) {
    throw new Error(`Clinic not found: ${msg.channel}:${msg.channelAccountId}`)
  }

  try {
    const { refreshTokenIfNeeded } = await import('../../meta-oauth/meta.service.js')
    await refreshTokenIfNeeded(clinicCtx.clinicId)
  } catch {
    // Token refresh is best-effort; message processing remains available.
  }

  const session = await getOrCreateSession({
    clinicId: clinicCtx.clinicId,
    configId: clinicCtx.configId,
    channel: msg.channel,
    externalUserId: msg.externalUserId,
  })

  const context = await buildContext(clinicCtx.clinicId)
  const result = await runLLMOrchestrator({
    session,
    userMessage: msg.text,
    clinicContext: context,
    clinicId: clinicCtx.clinicId,
  })

  await sendMessage({
    channel: msg.channel,
    externalUserId: msg.externalUserId,
    text: result.responseText,
    accessToken: clinicCtx.accessToken,
    phoneNumberId: clinicCtx.phoneNumberId,
  })

  await logAudit({
    sessionId: session.id,
    clinicId: clinicCtx.clinicId,
    userMessage: msg.text,
    assistantMessage: result.responseText,
    toolsCalled: result.toolsCalled,
    tokensUsed: result.tokensUsed,
    latencyMs: Date.now() - startedAt,
    escalated: result.escalated,
  })
}

async function poll(): Promise<void> {
  if (polling || stopped) return
  polling = true
  try {
    const now = Date.now()
    if (now - lastRecoveryAt >= RECOVERY_INTERVAL_MS) {
      await recoverStaleMessages()
      lastRecoveryAt = now
    }

    const messages = await claimMessages(BATCH_SIZE)
    await Promise.allSettled(messages.map(async (message) => {
      try {
        await processMessage(message.payload)
        await completeMessage(message.id)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        console.error(`[ai-admin] Message ${message.id} failed:`, detail)
        await failMessage(message.id, detail.slice(0, 2000))
      }
    }))
  } catch (error) {
    console.error('[ai-admin] Durable worker poll failed:', error)
  } finally {
    polling = false
  }
}

export async function startMessageWorker(): Promise<void> {
  if (!stopped) {
    stopped = false
    console.log('[ai-admin] Durable PostgreSQL message worker started')
    void poll()
    if (!pollTimer) {
      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS)
    }
  }
}
