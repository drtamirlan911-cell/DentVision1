import { Router, Request, Response } from 'express'
import { authenticate } from '../../middleware/auth.js'
import type { AuthRequest } from '../../types/index.js'
import { buildOAuthUrl } from './meta.client.js'
import { handleMetaCallback, disconnectChannel, getClinicStatus, getMessageCountToday, refreshTokenIfNeeded } from './meta.service.js'
import { metaConnectQuery, metaCallbackBody, metaDisconnectParams, metaStatusQuery } from './meta.schemas.js'
import { env } from '../../config.js'

export const metaRouter = Router()

// GET /api/meta/connect — возвращает OAuth URL для Embedded Signup
metaRouter.get('/connect', authenticate, (req: AuthRequest, res: Response) => {
  const parsed = metaConnectQuery.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid query', details: parsed.error.issues })
  }

  const { channel, clinicId } = parsed.data
  const state = `${clinicId}:${channel}:${Date.now()}`
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
  const [clinicId, channel] = state.split(':')

  if (!clinicId || !channel) {
    return res.status(400).json({ ok: false, error: 'Invalid state parameter' })
  }

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

  const clinicId = (req as any).query.clinicId || req.user?.clinicId
  if (!clinicId) {
    return res.status(400).json({ ok: false, error: 'Missing clinicId' })
  }

  const result = await disconnectChannel(clinicId, parsed.data.channel)
  return res.json({ ok: result.success })
})

// GET /api/meta/status — статус подключения
metaRouter.get('/status', authenticate, (req: AuthRequest, res: Response) => {
  const parsed = metaStatusQuery.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Missing clinicId' })
  }

  const { clinicId } = parsed.data
  getClinicStatus(clinicId).then(async (status) => {
    const messages = await getMessageCountToday(clinicId)
    return res.json({ ok: true, data: { ...status, messagesToday: messages } })
  }).catch((err) => {
    console.error('[meta] Status error:', err)
    return res.status(500).json({ ok: false, error: 'Failed to get status' })
  })
})

// POST /api/meta/refresh — ручное обновление токенов
metaRouter.post('/refresh', authenticate, async (req: AuthRequest, res: Response) => {
  const clinicId = (req as any).query.clinicId || req.user?.clinicId
  if (!clinicId) {
    return res.status(400).json({ ok: false, error: 'Missing clinicId' })
  }

  try {
    await refreshTokenIfNeeded(clinicId)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Token refresh failed' })
  }
})
