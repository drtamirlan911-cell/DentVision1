import { Worker } from 'bullmq'
import { getRedis } from '../../../lib/redis.js'
import { resolveClinic } from '../resolver/clinic.resolver.js'
import { getOrCreateSession } from '../conversation/conversation.manager.js'
import { buildContext } from '../context/context.builder.js'
import { runLLMOrchestrator } from '../llm/llm.orchestrator.js'
import { sendMessage } from '../sender/messenger.sender.js'
import { logAudit } from '../audit/audit.logger.js'
import type { NormalizedMessage } from '../webhook/types.js'

export function startMessageWorker(): void {
  const redis = getRedis()
  if (!redis) {
    console.log('[ai-admin] Redis unavailable — worker skipped (webhooks will be accepted but not processed)')
    return
  }

  const worker = new Worker<NormalizedMessage>(
    'ai-admin-messages',
    async (job) => {
      const msg = job.data
      const startedAt = Date.now()

      const clinicCtx = await resolveClinic(msg.channel, msg.channelAccountId)
      if (!clinicCtx) {
        console.warn(`[worker] Clinic not found: ${msg.channel}:${msg.channelAccountId}`)
        return
      }

      // Auto-refresh token if nearing expiry before processing message
      try {
        const { refreshTokenIfNeeded } = await import('../../meta-oauth/meta.service.js')
        await refreshTokenIfNeeded(clinicCtx.clinicId)
      } catch { /* non-fatal */ }

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
    },
    {
      connection: redis,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err)
  })

  console.log('[ai-admin] Message worker started')
}
