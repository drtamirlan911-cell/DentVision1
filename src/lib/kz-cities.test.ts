/**
 * Kazakhstan cities catalog tests.
 */
import { describe, expect, it } from 'vitest'
import { KZ_CITIES, KZ_POPULAR_CITIES, inferKzCity, isKzCity } from './kz-cities'

describe('kz-cities', () => {
  it('includes republican cities and popular hubs', () => {
    expect(KZ_CITIES).toContain('Алматы')
    expect(KZ_CITIES).toContain('Астана')
    expect(KZ_CITIES).toContain('Шымкент')
    expect(KZ_POPULAR_CITIES.length).toBeGreaterThan(10)
  })

  it('infers city from address strings', () => {
    expect(inferKzCity('Алматы, ул. Абая 10')).toBe('Алматы')
    expect(inferKzCity('г. Караганда, пр. Бухар жырау')).toBe('Караганда')
    expect(inferKzCity('')).toBeNull()
  })

  it('validates known cities', () => {
    expect(isKzCity('Павлодар')).toBe(true)
    expect(isKzCity('Москва')).toBe(false)
  })
})
