import { Router, Request, Response } from 'express'
import prisma from '../../../lib/prisma.js'
import { env } from '../../../config.js'
import { validateWhatsAppSignature } from './webhook.validator.js'
import { normalizeWhatsApp } from './whatsapp.adapter.js'
import { normalizeInstagram } from './instagram.adapter.js'
import { enqueueMessage } from '../queue/message.queue.js'

export const webhookGatewayRouter = Router()

async function verifyWebhookToken(token: string, channel: string): Promise<boolean> {
  // Shared token overrides per-clinic tokens (simpler for Meta app setup)
  if (env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return true
  }
  const config = await prisma.clinicMessengerConfig.findFirst({
    where: { channel: channel as any, verifyToken: token, isActive: true },
    select: { id: true },
  })
  return config !== null
}

// ─── WhatsApp ───

webhookGatewayRouter.get('/whatsapp', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token'] as string | undefined
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token) {
    const valid = await verifyWebhookToken(token, 'WHATSAPP')
    if (valid) {
      console.log('[webhook] WhatsApp verification successful')
      return res.status(200).send(challenge)
    }
    console.warn('[webhook] WhatsApp verification failed: invalid token')
    return res.status(403).json({ error: 'Verification failed' })
  }
  return res.status(403).json({ error: 'Verification failed' })
})

webhookGatewayRouter.post('/whatsapp', async (req: Request, res: Response) => {
  res.status(200).send('OK')

  try {
    const isValid = validateWhatsAppSignature(req)
    if (!isValid) {
      console.warn('[webhook/wa] Invalid signature — ignoring')
      return
    }

    const messages = normalizeWhatsApp(req.body)
    if (!messages.length) return

    for (const msg of messages) {
      await enqueueMessage(msg)
    }
  } catch (err) {
    console.error('[webhook/wa] Error processing webhook:', err)
  }
})

// ─── Instagram ───

webhookGatewayRouter.get('/instagram', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token'] as string | undefined
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token) {
    const valid = await verifyWebhookToken(token, 'INSTAGRAM')
    if (valid) {
      console.log('[webhook] Instagram verification successful')
      return res.status(200).send(challenge)
    }
    console.warn('[webhook] Instagram verification failed: invalid token')
    return res.status(403).json({ error: 'Verification failed' })
  }
  return res.status(403).json({ error: 'Verification failed' })
})

webhookGatewayRouter.post('/instagram', async (req: Request, res: Response) => {
  res.status(200).send('OK')

  try {
    const isValid = validateWhatsAppSignature(req)
    if (!isValid) {
      console.warn('[webhook/ig] Invalid signature — ignoring')
      return
    }

    const messages = normalizeInstagram(req.body)
    if (!messages.length) return

    for (const msg of messages) {
      await enqueueMessage(msg)
    }
  } catch (err) {
    console.error('[webhook/ig] Error processing webhook:', err)
  }
})
