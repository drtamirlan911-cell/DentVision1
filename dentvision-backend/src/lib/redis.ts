import { Redis } from 'ioredis'
import { env } from '../config.js'

export const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
})

redis.on('error', (err: Error) => {
  console.warn('[redis] Connection error (non-fatal):', err.message)
})
