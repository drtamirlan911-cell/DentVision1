import { describe, expect, it } from 'vitest'
import {
  buildClinicRestockSuggestions,
  findShopMatches,
  isClinicLowStock,
} from './inventory-shop-match'

describe('inventory-shop-match', () => {
  it('detects clinic low stock vs minimum', () => {
    expect(isClinicLowStock({ quantity: 2, minQuantity: 5 })).toBe(true)
    expect(isClinicLowStock({ quantity: 6, min: 5 })).toBe(false)
    expect(isClinicLowStock({ quantity: 0, minQuantity: 0 })).toBe(false)
  })

  it('matches exact and analog shop products', () => {
    const item = { id: '1', name: 'Имплант Nobel Active', quantity: 1, minQuantity: 3, category: 'Импланты' }
    const products = [
      { id: 'a', name: 'Имплант Nobel Active 4.3', brand: 'Nobel', category: 'Импланты', stock: 12, price: 100 },
      { id: 'b', name: 'Имплант Straumann BLX', brand: 'Straumann', category: 'Импланты', stock: 8, price: 110 },
      { id: 'c', name: 'Перчатки нитрил', brand: 'Med', category: 'Расходники', stock: 50, price: 5 },
    ]
    const matches = findShopMatches(item, products, 3)
    expect(matches[0]?.id).toBe('a')
    expect(matches[0]?.kind).toBe('exact')
    expect(matches.some((m) => m.id === 'b')).toBe(true)
    expect(matches.some((m) => m.id === 'c')).toBe(false)
  })

  it('builds restock suggestions only with marketplace hits when asked', () => {
    const inventory = [
      { id: '1', name: 'Композит Filtek', quantity: 1, minQuantity: 4 },
      { id: '2', name: 'Редкая паста XYZ', quantity: 0, minQuantity: 2 },
    ]
    const products = [
      { id: 'p1', name: 'Filtek Ultimate', brand: '3M', category: 'Реставрация', stock: 20, price: 50 },
    ]
    const withHits = buildClinicRestockSuggestions(inventory, products, { onlyWithMatches: true })
    expect(withHits).toHaveLength(1)
    expect(withHits[0].item.id).toBe('1')
    expect(withHits[0].matches.length).toBeGreaterThan(0)
  })
})
