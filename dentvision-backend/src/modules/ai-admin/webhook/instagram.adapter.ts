import type { NormalizedMessage } from './types.js'

interface IGEntry {
  id: string
  messaging?: Array<{
    sender: { id: string }
    recipient: { id: string }
    timestamp: number
    message: { mid: string; text?: string }
  }>
}

export function normalizeInstagram(body: { entry?: IGEntry[] }): NormalizedMessage[] {
  const results: NormalizedMessage[] = []
  if (!body.entry) return results

  for (const entry of body.entry) {
    if (!entry.messaging) continue
    for (const event of entry.messaging) {
      if (!event.message?.text) continue

      results.push({
        channel: 'INSTAGRAM',
        channelAccountId: entry.id,
        externalUserId: event.sender.id,
        text: event.message.text.trim(),
        externalMessageId: event.message.mid,
        receivedAt: new Date(event.timestamp),
      })
    }
  }

  return results
}
