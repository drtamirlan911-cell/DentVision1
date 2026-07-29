import { z } from 'zod'

export const metaConnectQuery = z.object({
  channel: z.enum(['WHATSAPP', 'INSTAGRAM']),
  clinicId: z.string().min(1),
})

export const metaCallbackBody = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export const metaDisconnectParams = z.object({
  channel: z.enum(['WHATSAPP', 'INSTAGRAM']),
})

export const metaStatusQuery = z.object({
  clinicId: z.string().min(1),
})
