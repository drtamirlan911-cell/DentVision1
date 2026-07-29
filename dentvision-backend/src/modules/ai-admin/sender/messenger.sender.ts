import { sendWhatsApp } from './whatsapp.sender.js'
import { sendInstagram } from './instagram.sender.js'
import type { Channel } from '../webhook/types.js'

interface SendParams {
  channel: Channel
  externalUserId: string
  text: string
  accessToken: string
}

export async function sendMessage(params: SendParams): Promise<void> {
  if (params.channel === 'WHATSAPP') {
    await sendWhatsApp(params)
  } else if (params.channel === 'INSTAGRAM') {
    await sendInstagram(params)
  }
}
