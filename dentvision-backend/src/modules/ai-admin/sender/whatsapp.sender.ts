interface SendParams { externalUserId: string; text: string; accessToken: string; phoneNumberId?: string | null }

export async function sendWhatsApp({ externalUserId, text, accessToken, phoneNumberId }: SendParams): Promise<void> {
  if (!phoneNumberId) {
    throw new Error('WhatsApp send failed: missing phoneNumberId. Reconnect the integration.')
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: externalUserId,
        type: 'text',
        text: { body: text, preview_url: false },
      }),
    },
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`WhatsApp send failed: ${response.status} ${err}`)
  }
}
