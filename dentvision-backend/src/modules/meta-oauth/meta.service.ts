import prisma from '../../lib/prisma.js'
import { uid } from '../../lib/helpers.js'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getWhatsAppBusinessAccounts,
  getWABAInfo,
  getInstagramAccount,
  subscribeAppToWABA,
  getPages,
  refreshAccessToken,
} from './meta.client.js'
import type { Channel } from '../ai-admin/webhook/types.js'

interface ConnectResult {
  success: boolean
  config: {
    id: string
    channel: string
    phoneNumber?: string
    businessName?: string
    webhookSubscribed: boolean
  }
}

export async function handleMetaCallback(
  code: string,
  clinicId: string,
  channel: Channel,
): Promise<ConnectResult> {
  // 1. Обменять code на short-lived токен
  const tokenData = await exchangeCodeForToken(code)

  // 2. Получить долгоживущий токен
  const longLivedToken = await getLongLivedToken(tokenData.access_token)

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 60 * 24 * 3600) * 1000)

  // 3. Получить бизнес-аккаунты
  const businesses = await getWhatsAppBusinessAccounts(longLivedToken)
  const businessId = businesses[0]?.id || null

  let phoneNumber: string | undefined
  let wabaId: string | undefined
  let phoneNumberId: string | undefined
  let pageId: string | undefined
  let instagramAccountId: string | undefined
  let businessName: string | undefined
  let webhookSubscribed = false

  if (channel === 'WHATSAPP') {
    // Получить страницы → WABA
    const pages = await getPages(longLivedToken)
    pageId = pages[0]?.id || null

    if (businessId) {
      // Ищем WABA в бизнес-аккаунте
      const wabas = await getWhatsAppBusinessAccounts(longLivedToken)
      for (const b of wabas) {
        const info = await getWABAInfo(b.id, longLivedToken)
        if (info?.phoneNumbers?.length) {
          wabaId = info.id
          phoneNumberId = info.phoneNumbers[0].id
          phoneNumber = info.phoneNumbers[0].display_phone_number
          businessName = info.name
          break
        }
      }
    }

    // Подписать приложение на WABA webhook
    if (wabaId) {
      webhookSubscribed = await subscribeAppToWABA(wabaId, longLivedToken)
    }
  } else {
    // Instagram
    const pagesList = await getPages(longLivedToken)
    for (const p of pagesList) {
      const ig = await getInstagramAccount(p.id, longLivedToken)
      if (ig) {
        pageId = p.id
        instagramAccountId = ig.id
        businessName = ig.username
        break
      }
    }
  }

  const accountId = channel === 'WHATSAPP'
    ? (wabaId || businessId || 'pending')
    : (instagramAccountId || 'pending')

  // Сохранить или обновить конфиг
  const existing = await prisma.clinicMessengerConfig.findFirst({
    where: { clinicId, channel },
  })

  const configData = {
    channel,
    channelAccountId: accountId,
    accessToken: longLivedToken,
    refreshToken: tokenData.refresh_token || null,
    businessId,
    wabaId,
    pageId,
    instagramAccountId,
    phoneNumberId,
    phoneNumber,
    permissions: ['whatsapp_business_management', 'whatsapp_business_messaging', 'instagram_basic', 'instagram_manage_messages'],
    expiresAt,
    webhookSubscribed,
    isActive: true,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || uid(),
  }

  const config = existing
    ? await prisma.clinicMessengerConfig.update({ where: { id: existing.id }, data: configData })
    : await prisma.clinicMessengerConfig.create({ data: { id: uid(), clinicId, ...configData } })

  return {
    success: true,
    config: {
      id: config.id,
      channel: config.channel,
      phoneNumber: config.phoneNumber || undefined,
      businessName,
      webhookSubscribed: config.webhookSubscribed,
    },
  }
}

export async function disconnectChannel(
  clinicId: string,
  channel: Channel,
): Promise<{ success: boolean }> {
  const config = await prisma.clinicMessengerConfig.findFirst({
    where: { clinicId, channel },
  })

  if (!config) return { success: false }

  // Удалить webhook подписки если были
  if (config.wabaId && config.accessToken) {
    try {
      const url = `https://graph.facebook.com/v20.0/${config.wabaId}/subscribed_apps`
      await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
    } catch { /* ignore */ }
  }

  // Сбросить конфиг но не удалять (история сообщений)
  await prisma.clinicMessengerConfig.update({
    where: { id: config.id },
    data: {
      isActive: false,
      accessToken: '',
      refreshToken: null,
      webhookSubscribed: false,
      permissions: {},
    },
  })

  return { success: true }
}

export async function getClinicStatus(clinicId: string): Promise<{
  whatsapp: object | null
  instagram: object | null
}> {
  const configs = await prisma.clinicMessengerConfig.findMany({
    where: { clinicId },
    select: {
      id: true,
      channel: true,
      phoneNumber: true,
      businessId: true,
      wabaId: true,
      instagramAccountId: true,
      webhookSubscribed: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  const wa = configs.find((c) => c.channel === 'WHATSAPP' && c.isActive)
  const ig = configs.find((c) => c.channel === 'INSTAGRAM' && c.isActive)

  return {
    whatsapp: wa ? {
      id: wa.id,
      channel: wa.channel,
      phoneNumber: wa.phoneNumber,
      businessId: wa.businessId,
      webhookSubscribed: wa.webhookSubscribed,
      expiresAt: wa.expiresAt,
      connectedAt: wa.createdAt,
    } : null,
    instagram: ig ? {
      id: ig.id,
      channel: ig.channel,
      instagramAccountId: ig.instagramAccountId,
      webhookSubscribed: ig.webhookSubscribed,
      expiresAt: ig.expiresAt,
      connectedAt: ig.createdAt,
    } : null,
  }
}

export async function getMessageCountToday(clinicId: string): Promise<Record<string, number>> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sessions = await prisma.aiAdminSession.findMany({
    where: { clinicId, lastMessageAt: { gte: today } },
    select: { channel: true, id: true },
  })

  const sessionIds = sessions.map((s) => s.id)
  if (!sessionIds.length) return { WHATSAPP: 0, INSTAGRAM: 0 }

  const messages = await prisma.aiAdminMessage.findMany({
    where: { sessionId: { in: sessionIds }, role: 'USER', createdAt: { gte: today } },
    select: { sessionId: true },
  })

  const byChannel: Record<string, number> = { WHATSAPP: 0, INSTAGRAM: 0 }
  for (const s of sessions) {
    const count = messages.filter((m) => m.sessionId === s.id).length
    byChannel[s.channel] = (byChannel[s.channel] || 0) + count
  }

  return byChannel
}

export async function refreshTokenIfNeeded(clinicId: string): Promise<void> {
  const configs = await prisma.clinicMessengerConfig.findMany({
    where: { clinicId, isActive: true },
  })

  for (const config of configs) {
    if (!config.accessToken) continue
    const expiresAt = config.expiresAt
    if (!expiresAt) continue

    const now = new Date()
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (24 * 3600 * 1000)

    if (daysUntilExpiry < 7) {
      const result = await refreshAccessToken(config.accessToken)
      if (result) {
        await prisma.clinicMessengerConfig.update({
          where: { id: config.id },
          data: {
            accessToken: result.access_token,
            expiresAt: new Date(Date.now() + result.expires_in * 1000),
          },
        })
      }
    }
  }
}
