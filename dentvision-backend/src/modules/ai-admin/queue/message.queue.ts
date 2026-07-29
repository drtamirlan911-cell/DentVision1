import { Queue } from 'bullmq'
import { redis } from '../../../lib/redis.js'
import type { NormalizedMessage } from '../webhook/types.js'

export const messageQueue = new Queue<NormalizedMessage>('ai-admin-messages', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 500,
  },
})

export async function enqueueMessage(msg: NormalizedMessage): Promise<void> {
  const jobId = `${msg.channel}:${msg.externalMessageId}`
  await messageQueue.add('process', msg, { jobId })
}
