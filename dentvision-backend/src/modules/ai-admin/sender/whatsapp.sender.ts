interface SendParams { externalUserId: string; text: string; accessToken: string }

export async function sendWhatsApp({ externalUserId, text, accessToken }: SendParams): Promise<void> {
  const parts = accessToken.split(':')
  const phoneNumberId = parts[0]
  const token = parts.slice(1).join(':') || accessToken

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
