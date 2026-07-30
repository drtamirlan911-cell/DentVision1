import { Redis } from 'ioredis'
import { env } from '../config.js'

let _redis: Redis | null = null

export function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = env.REDIS_URL || ''
  // Only connect if there's a real Redis URL (not localhost default)
  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
    return null
  }

  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null // stop retrying after 3 attempts
        return Math.min(times * 1000, 3000)
      },
    })

    _redis.on('error', () => {
      // silently ignore — production may not have Redis
    })

    return _redis
  } catch {
    return null
  }
}
