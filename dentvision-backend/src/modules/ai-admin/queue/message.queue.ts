import { Queue } from 'bullmq'
import { getRedis } from '../../../lib/redis.js'
import type { NormalizedMessage } from '../webhook/types.js'

let _queue: Queue<NormalizedMessage> | null = null

function getQueue(): Queue<NormalizedMessage> | null {
  if (_queue) return _queue
  const redis = getRedis()
  if (!redis) return null

  _queue = new Queue<NormalizedMessage>('ai-admin-messages', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
  })
  return _queue
}

export async function enqueueMessage(msg: NormalizedMessage): Promise<void> {
  const queue = getQueue()
  if (!queue) {
    console.warn('[queue] Redis unavailable — message dropped:', msg.externalMessageId)
    return
  }
  const jobId = `${msg.channel}:${msg.externalMessageId}`
  await queue.add('process', msg, { jobId })
}
