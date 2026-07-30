import { Router, Request, Response } from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { authenticate } from '../../middleware/auth.js'
import type { AuthRequest } from '../../types/index.js'
import prisma from '../../lib/prisma.js'
import { buildOAuthUrl } from './meta.client.js'
import { handleMetaCallback, disconnectChannel, getClinicStatus, getMessageCountToday, refreshTokenIfNeeded } from './meta.service.js'
import { metaConnectQuery, metaCallbackBody, metaDisconnectParams, metaStatusQuery } from './meta.schemas.js'
import { env } from '../../config.js'

export const metaRouter = Router()

function signState(clinicId: string, channel: string): string {
  const raw = `${clinicId}:${channel}`
  const sig = createHmac('sha256', env.JWT_SECRET).update(raw).digest('hex').slice(0, 16)
  return `${raw}:${sig}`
}

function verifyState(state: string): { clinicId: string; channel: string } | null {
  const parts = state.split(':')
  if (parts.length !== 3) return null
  const [clinicId, channel, sig] = parts
  const expected = createHmac('sha256', env.JWT_SECRET).update(`${clinicId}:${channel}`).digest('hex').slice(0, 16)
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return { clinicId, channel }
}

// GET /api/meta/connect — возвращает OAuth URL для Embedded Signup
metaRouter.get('/connect', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = metaConnectQuery.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid query', details: parsed.error.issues })
  }

  const { channel, clinicId } = parsed.data

  const membership = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId: req.user!.id, clinicId } },
  })
  if (!membership) {
    return res.status(403).json({ ok: false, error: 'Access denied' })
  }

  const state = signState(clinicId, channel)
  const url = buildOAuthUrl(state)

  return res.json({ ok: true, data: { url, state } })
})

// GET /api/meta/callback — обработка callback от Meta после авторизации
metaRouter.get('/callback', async (req: Request, res: Response) => {
  const parsed = metaCallbackBody.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Missing code or state' })
  }

  const { code, state } = parsed.data
  const verified = verifyState(state)
  if (!verified) {
    return res.status(400).json({ ok: false, error: 'Invalid state parameter' })
  }
  const { clinicId, channel } = verified

  try {
    const result = await handleMetaCallback(code, clinicId, channel as 'WHATSAPP' | 'INSTAGRAM')

    // Редирект на фронтенд с результатом
    const frontendUrl = env.FRONTEND_URL || env.CORS_ORIGIN || 'http://localhost:5173'
    return res.redirect(`${frontendUrl}/integrations/messaging?connected=${channel}&success=true`)
  } catch (err) {
    console.error('[meta] Callback error:', err)
    const frontendUrl = env.FRONTEND_URL || env.CORS_ORIGIN || 'http://localhost:5173'
    return res.redirect(`${frontendUrl}/integrations/messaging?connected=${channel}&success=false`)
  }
})

// DELETE /api/meta/disconnect/:channel — отключение интеграции
metaRouter.delete('/disconnect/:channel', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = metaDisconnectParams.safeParse(req.params)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid channel' })
  }

  const clinicId = req.user?.clinicId
  if (!clinicId) {
    return res.status(400).json({ ok: false, error: 'Missing clinicId' })
  }

  const membership = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId: req.user!.id, clinicId } },
  })
  if (!membership) {
    return res.status(403).json({ ok: false, error: 'Access denied' })
  }

  const result = await disconnectChannel(clinicId, parsed.data.channel)
  return res.json({ ok: result.success })
})

// GET /api/meta/status — статус подключения
metaRouter.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = metaStatusQuery.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Missing clinicId' })
  }

  const { clinicId } = parsed.data
  const membership = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId: req.user!.id, clinicId } },
  })
  if (!membership) {
    return res.status(403).json({ ok: false, error: 'Access denied' })
  }

  try {
    const status = await getClinicStatus(clinicId)
    const messages = await getMessageCountToday(clinicId)
    return res.json({ ok: true, data: { ...status, messagesToday: messages } })
  } catch (err) {
    console.error('[meta] Status error:', err)
    return res.status(500).json({ ok: false, error: 'Failed to get status' })
  }
})

// POST /api/meta/refresh — ручное обновление токенов
metaRouter.post('/refresh', authenticate, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId
  if (!clinicId) {
    return res.status(400).json({ ok: false, error: 'Missing clinicId' })
  }

  const membership = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId: req.user!.id, clinicId } },
  })
  if (!membership) {
    return res.status(403).json({ ok: false, error: 'Access denied' })
  }

  try {
    await refreshTokenIfNeeded(clinicId)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Token refresh failed' })
  }
})
