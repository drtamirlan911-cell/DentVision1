import type { NormalizedMessage } from './types.js'

interface WAEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      contacts?: Array<{ profile: { name: string }; wa_id: string }>
      messages?: Array<{
        id: string
        from: string
        timestamp: string
        type: string
        text?: { body: string }
      }>
    }
    field: string
  }>
}

export function normalizeWhatsApp(body: { entry?: WAEntry[] }): NormalizedMessage[] {
  const results: NormalizedMessage[] = []
  if (!body.entry) return results

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      const value = change.value
      if (!value.messages) continue

      for (const message of value.messages) {
        if (message.type !== 'text' || !message.text?.body) continue

        results.push({
          channel: 'WHATSAPP',
          channelAccountId: value.metadata.phone_number_id,
          externalUserId: message.from,
          text: message.text.body.trim(),
          externalMessageId: message.id,
          receivedAt: new Date(parseInt(message.timestamp) * 1000),
        })
      }
    }
  }

  return results
}
