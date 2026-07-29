import { createHmac, timingSafeEqual } from 'node:crypto'
import { Request } from 'express'
import { env } from '../../../config.js'

export function validateWhatsAppSignature(req: Request): boolean {
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  if (!signature) return false

  const appSecret = env.META_APP_SECRET
  if (!appSecret) {
    console.error('[validator] META_APP_SECRET not configured — rejecting all webhooks')
    return false
  }

  const body = JSON.stringify(req.body)
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
