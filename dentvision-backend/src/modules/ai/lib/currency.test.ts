import { describe, it, expect } from 'vitest'
import { preferTengeCurrency } from './currency'

describe('preferTengeCurrency', () => {
  it('replaces ruble symbol and RUB', () => {
    expect(preferTengeCurrency('Выручка 2.4М ₽')).toBe('Выручка 2.4М ₸')
    expect(preferTengeCurrency('долг 450000 RUB')).toBe('долг 450000 ₸')
  })
  it('replaces рубль words', () => {
    expect(preferTengeCurrency('сумма 12 000 рублей')).toContain('₸')
    expect(preferTengeCurrency('оплата в рублях')).toBe('оплата в тенге')
  })
  it('keeps tenge unchanged', () => {
    expect(preferTengeCurrency('касса 15 000 ₸')).toBe('касса 15 000 ₸')
  })
})
