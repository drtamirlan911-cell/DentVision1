interface SendParams { externalUserId: string; text: string; accessToken: string }

export async function sendInstagram({ externalUserId, text, accessToken }: SendParams): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v20.0/me/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: externalUserId },
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    },
  )

  if (!response.ok) {
    // Provider error bodies may echo recipient IDs or message content.
    throw new Error(`Instagram send failed with HTTP ${response.status}`)
  }
}
