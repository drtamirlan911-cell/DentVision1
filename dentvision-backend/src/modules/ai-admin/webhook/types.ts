export type Channel = 'WHATSAPP' | 'INSTAGRAM'

export interface NormalizedMessage {
  channel: Channel
  channelAccountId: string
  externalUserId: string
  text: string
  externalMessageId: string
  receivedAt: Date
}
