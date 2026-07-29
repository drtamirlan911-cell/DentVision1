import prisma from '../../../lib/prisma.js'
import type { Channel } from '../webhook/types.js'

interface ClinicContext {
  clinicId: string
  configId: string
  accessToken: string
}

const cache = new Map<string, { data: ClinicContext; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function resolveClinic(
  channel: Channel,
  channelAccountId: string,
): Promise<ClinicContext | null> {
  const cacheKey = `${channel}:${channelAccountId}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const config = await prisma.clinicMessengerConfig.findFirst({
    where: {
      channel,
      channelAccountId,
      isActive: true,
    },
    select: {
      id: true,
      clinicId: true,
      accessToken: true,
    },
  })

  if (!config) return null

  const data: ClinicContext = {
    clinicId: config.clinicId,
    configId: config.id,
    accessToken: config.accessToken,
  }

  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL })
  return data
}

export function invalidateClinicCache(channel: Channel, channelAccountId: string): void {
  cache.delete(`${channel}:${channelAccountId}`)
}
