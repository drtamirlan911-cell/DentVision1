import { env } from '../../config.js'

const META_GRAPH_URL = 'https://graph.facebook.com/v20.0'
const META_OAUTH_URL = 'https://www.facebook.com/v20.0/dialog/oauth'

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID || '',
    redirect_uri: `${env.FRONTEND_URL || env.CORS_ORIGIN || 'http://localhost:5173'}/integrations/messaging/callback`,
    state,
    scope: [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'instagram_basic',
      'instagram_manage_messages',
      'business_management',
      'pages_show_list',
      'pages_messaging',
      'pages_read_engagement',
    ].join(','),
    response_type: 'code',
  })
  return `${META_OAUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  const response = await fetch(`${META_GRAPH_URL}/oauth/access_token`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  const url = `${META_GRAPH_URL}/oauth/access_token?client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&redirect_uri=${encodeURIComponent(`${env.FRONTEND_URL || env.CORS_ORIGIN || 'http://localhost:5173'}/integrations/messaging/callback`)}&code=${code}`

  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta token exchange failed: ${res.status} ${err}`)
  }
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>
}

export async function getLongLivedToken(shortLivedToken: string): Promise<string> {
  const url = `${META_GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`

  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`Meta long-lived token failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function getWhatsAppBusinessAccounts(token: string): Promise<Array<{
  id: string; name: string
}>> {
  const url = `${META_GRAPH_URL}/me/businesses?access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json() as { data?: Array<{ id: string; name: string }> }
  return data.data || []
}

export async function getWABAInfo(
  wabaId: string,
  token: string,
): Promise<{ id: string; name: string; phoneNumbers: Array<{ id: string; display_phone_number: string }> } | null> {
  const url = `${META_GRAPH_URL}/${wabaId}?fields=name,phone_numbers{id,display_phone_number}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; name: string; phoneNumbers: Array<{ id: string; display_phone_number: string }> }>
}

export async function getInstagramAccount(
  pageId: string,
  token: string,
): Promise<{ id: string; username: string } | null> {
  const url = `${META_GRAPH_URL}/${pageId}?fields=instagram_business_account{id,username}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as { instagram_business_account?: { id: string; username: string } }
  return data.instagram_business_account || null
}

export async function subscribeAppToWABA(
  wabaId: string,
  token: string,
): Promise<boolean> {
  const url = `${META_GRAPH_URL}/${wabaId}/subscribed_apps`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token }),
  })
  return res.ok
}

export async function getPages(token: string): Promise<Array<{
  id: string; name: string
}>> {
  const url = `${META_GRAPH_URL}/me/accounts?access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json() as { data?: Array<{ id: string; name: string }> }
  return data.data || []
}

export async function refreshAccessToken(currentToken: string): Promise<{
  access_token: string; expires_in: number
} | null> {
  try {
    const url = `${META_GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${currentToken}`
    const res = await fetch(url)
    if (!res.ok) return null
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
  } catch {
    return null
  }
}
