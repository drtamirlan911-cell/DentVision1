import { describe, expect, it } from 'vitest'
import { extractPaymentQrUrl, formatPayAmount, paymentQrImageSrc } from './paymentQr'

describe('extractPaymentQrUrl', () => {
  it('reads top-level qr', () => {
    expect(extractPaymentQrUrl({ qr: 'https://pay.example/q/1' })).toBe('https://pay.example/q/1')
  })

  it('reads meta.qr when top-level missing', () => {
    expect(extractPaymentQrUrl({ id: 'p1', meta: { qr: 'https://pay.example/q/2' } })).toBe(
      'https://pay.example/q/2',
    )
  })

  it('rebuilds from externalId', () => {
    expect(extractPaymentQrUrl({ externalId: 'kaspi_abc', amount: '10000', refId: 'w1' })).toBe(
      'https://pay.dentvision.app/qr/kaspi_abc?amount=10000&ref=w1',
    )
  })

  it('returns null for empty payload', () => {
    expect(extractPaymentQrUrl(null)).toBeNull()
    expect(extractPaymentQrUrl({})).toBeNull()
  })
})

describe('paymentQr helpers', () => {
  it('builds image src', () => {
    expect(paymentQrImageSrc('https://pay.example/q', 120)).toContain('size=120x120')
    expect(paymentQrImageSrc('https://pay.example/q', 120)).toContain(encodeURIComponent('https://pay.example/q'))
  })

  it('formats amount', () => {
    expect(formatPayAmount(25000)).toMatch(/25/)
    expect(formatPayAmount(null)).toBeNull()
  })
})
