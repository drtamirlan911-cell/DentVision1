import { describe, it, expect } from 'vitest'
import { cn, formatMoney, formatDate, formatTime, getInitials, timeAgo, clamp, debounce } from '../lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })
  it('deduplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
  it('handles falsy values', () => {
    expect(cn('foo', false, null, undefined, '')).toBe('foo')
  })
})

describe('formatMoney', () => {
  it('formats number with currency', () => {
    expect(formatMoney(1234)).toContain('1')
    expect(formatMoney(1234)).toContain('₸')
  })
  it('handles zero', () => {
    expect(formatMoney(0)).toContain('0')
  })
})

describe('getInitials', () => {
  it('returns first letters of name parts', () => {
    expect(getInitials('Иван Петров')).toBe('ИП')
  })
  it('limits to 2 characters', () => {
    expect(getInitials('Иван Сергеевич Петров')).toBe('ИС')
  })
  it('handles single name', () => {
    expect(getInitials('Иван')).toBe('И')
  })
})

describe('clamp', () => {
  it('clamps to min', () => { expect(clamp(-5, 0, 100)).toBe(0) })
  it('clamps to max', () => { expect(clamp(150, 0, 100)).toBe(100) })
  it('passes through in range', () => { expect(clamp(50, 0, 100)).toBe(50) })
})

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2026-01-15')
    expect(result).toContain('2026')
  })
})

describe('formatTime', () => {
  it('formats time from a date string', () => {
    const result = formatTime('2026-01-15T14:30:00')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })
})

describe('timeAgo', () => {
  it('returns "только что" for recent dates', () => {
    expect(timeAgo(new Date())).toBe('только что')
  })
})

describe('debounce', () => {
  it('delays execution', async () => {
    let called = false
    const fn = debounce(() => { called = true }, 50)
    fn()
    expect(called).toBe(false)
    await new Promise(r => setTimeout(r, 60))
    expect(called).toBe(true)
  })
  it('cancel prevents execution', async () => {
    let called = false
    const fn = debounce(() => { called = true }, 50)
    fn()
    fn.cancel()
    await new Promise(r => setTimeout(r, 60))
    expect(called).toBe(false)
  })
})
