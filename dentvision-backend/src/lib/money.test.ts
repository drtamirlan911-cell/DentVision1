import { describe, expect, it } from 'vitest'
import {
  commissionMinor,
  minorToTenge,
  serializeBigInt,
  tengeToMinor,
} from './money.js'

describe('tengeToMinor / minorToTenge', () => {
  it('converts tenge to minor units (тиын)', () => {
    expect(tengeToMinor(100)).toBe(10000n)
    expect(tengeToMinor(0)).toBe(0n)
    expect(tengeToMinor(49900)).toBe(4990000n)
  })

  it('rounds fractional tenge to the nearest тиын', () => {
    expect(tengeToMinor(0.005)).toBe(1n) // 0.5 тиын → rounds to 1
    expect(tengeToMinor(1.239)).toBe(124n) // 123.9 → 124
  })

  it('round-trips whole and typical amounts', () => {
    for (const t of [0, 1, 100, 49900, 149900]) {
      expect(minorToTenge(tengeToMinor(t))).toBe(t)
    }
  })

  it('minorToTenge divides by 100', () => {
    expect(minorToTenge(10000n)).toBe(100)
    expect(minorToTenge(4990000n)).toBe(49900)
  })
})

describe('commissionMinor (basis points, floor)', () => {
  it('computes commission from bps (1000 = 10%)', () => {
    expect(commissionMinor(10000n, 1000)).toBe(1000n) // 10% of 100.00
    expect(commissionMinor(4990000n, 1000)).toBe(499000n)
  })

  it('supports zero and full commission', () => {
    expect(commissionMinor(12345n, 0)).toBe(0n)
    expect(commissionMinor(12345n, 10000)).toBe(12345n) // 100%
  })

  it('floors (integer division, never rounds up)', () => {
    // 15% of 101 тиын = 15.15 → floors to 15
    expect(commissionMinor(101n, 1500)).toBe(15n)
    // 33% of 1 тиын = 0.33 → floors to 0
    expect(commissionMinor(1n, 3300)).toBe(0n)
    // 1 bps of 9999 тиын = 0.9999 → floors to 0
    expect(commissionMinor(9999n, 1)).toBe(0n)
  })
})

describe('serializeBigInt', () => {
  it('converts BigInt leaves to strings', () => {
    expect(serializeBigInt({ amount: 10000n })).toEqual({ amount: '10000' })
  })

  it('handles nested structures and arrays', () => {
    const input = {
      total: 5000n,
      lines: [{ id: 'x', minor: 1n }, { id: 'y', minor: 2n }],
      meta: { note: 'ok', count: 3 },
    }
    expect(serializeBigInt(input)).toEqual({
      total: '5000',
      lines: [{ id: 'x', minor: '1' }, { id: 'y', minor: '2' }],
      meta: { note: 'ok', count: 3 },
    })
  })

  it('leaves non-bigint values untouched', () => {
    expect(serializeBigInt({ a: 1, b: 'two', c: true, d: null })).toEqual({
      a: 1,
      b: 'two',
      c: true,
      d: null,
    })
  })
})
