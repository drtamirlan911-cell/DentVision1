/** Pull Kaspi/pay QR URL from any payment payload shape the API may return. */
export function extractPaymentQrUrl(payment: unknown): string | null {
  if (!payment || typeof payment !== 'object') return null
  const p = payment as Record<string, unknown>
  const meta =
    p.meta && typeof p.meta === 'object'
      ? (p.meta as Record<string, unknown>)
      : typeof p.meta === 'string'
        ? (() => {
            try {
              return JSON.parse(p.meta) as Record<string, unknown>
            } catch {
              return null
            }
          })()
        : null

  const candidates = [
    p.qr,
    p.qrUrl,
    p.qr_url,
    p.paymentUrl,
    p.payUrl,
    meta?.qr,
    meta?.qrUrl,
    meta?.qr_url,
    meta?.paymentUrl,
  ]

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }

  // Rebuild mock Kaspi URL when API forgot top-level qr but has externalId
  const externalId = typeof p.externalId === 'string' ? p.externalId : null
  if (externalId) {
    const amount = p.amount != null ? String(p.amount) : null
    const ref = typeof p.refId === 'string' ? p.refId : null
    const qs = new URLSearchParams()
    if (amount) qs.set('amount', amount)
    if (ref) qs.set('ref', ref)
    const q = qs.toString()
    return `https://pay.dentvision.app/qr/${externalId}${q ? `?${q}` : ''}`
  }
  return null
}

/** Public QR image for a pay URL (no extra npm dependency). */
export function paymentQrImageSrc(qrUrl: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=14&data=${encodeURIComponent(qrUrl)}`
}

export function formatPayAmount(price?: number | string | null, currency = 'KZT'): string | null {
  if (price == null || price === '') return null
  const n = typeof price === 'string' ? Number(price) : price
  if (!Number.isFinite(n)) return null
  return `${n.toLocaleString('ru-RU')} ${currency === 'KZT' ? '₸' : currency}`
}
