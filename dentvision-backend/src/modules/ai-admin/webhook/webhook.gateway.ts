import { Router, Request, Response } from 'express'
import { validateWhatsAppSignature } from './webhook.validator.js'
import { normalizeWhatsApp } from './whatsapp.adapter.js'
import { normalizeInstagram } from './instagram.adapter.js'
import { enqueueMessage } from '../queue/message.queue.js'

export const webhookGatewayRouter = Router()

// ─── WhatsApp ───

webhookGatewayRouter.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token) {
    console.log('[webhook] WhatsApp verification request received')
    return res.status(200).send(challenge)
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

webhookGatewayRouter.get('/instagram', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token) {
    return res.status(200).send(challenge)
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
