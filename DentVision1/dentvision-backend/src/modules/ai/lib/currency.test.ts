import { describe, it, expect } from 'vitest'
import {
  currencySymbol,
  formatClinicMoney,
  preferClinicCurrency,
  normalizeCurrencyCode,
} from './currency'

describe('normalizeCurrencyCode', () => {
  it('defaults unknown to KZT', () => {
    expect(normalizeCurrencyCode(null)).toBe('KZT')
    expect(normalizeCurrencyCode('rub')).toBe('RUB')
  })
})

describe('formatClinicMoney', () => {
  it('formats with clinic currency', () => {
    expect(formatClinicMoney(15000, 'KZT')).toMatch(/15/)
    expect(formatClinicMoney(15000, 'RUB')).toMatch(/15/)
  })
})

describe('preferClinicCurrency', () => {
  it('rewrites rubles to clinic KZT', () => {
    expect(preferClinicCurrency('Выручка 2.4М ₽', 'KZT')).toBe('Выручка 2.4М ₸')
    expect(preferClinicCurrency('долг 450000 RUB', 'KZT')).toBe('долг 450000 ₸')
  })
  it('rewrites tenge to clinic RUB when clinic uses RUB', () => {
    expect(preferClinicCurrency('касса 15 000 ₸', 'RUB')).toBe('касса 15 000 ₽')
    expect(currencySymbol('RUB')).toBe('₽')
  })
  it('rewrites to USD', () => {
    expect(preferClinicCurrency('сумма 1200 ₸', 'USD')).toContain('$')
  })
})
