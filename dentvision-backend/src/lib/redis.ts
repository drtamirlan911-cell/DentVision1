import { Redis } from 'ioredis'
import { env } from '../config.js'

let _redis: Redis | null = null

export function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = env.REDIS_URL || ''
  const forced = env.REDIS_ENABLED === 'true'
  // Connect only when there's a real Redis URL. localhost/127.0.0.1 counts as
  // "no Redis" unless REDIS_ENABLED=true (e.g. a sidecar on the same instance).
  if (!url || (!forced && (url.includes('localhost') || url.includes('127.0.0.1')))) {
    return null
  }

  try {
    _redis = new Redis(url, {
      // BullMQ (Queue + Worker, the only consumers of this connection today)
      // requires maxRetriesPerRequest: null on any connection used for
      // blocking commands — the Worker throws "must be null" at construction
      // otherwise.
      maxRetriesPerRequest: null,
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
