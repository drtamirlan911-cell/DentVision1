import { describe, expect, it } from 'vitest';

import {
  CONCIERGE_DEFAULTS,
  MAX_FINANCING_MONTHS,
  MIN_FINANCING_MONTHS,
  monthlyFigure,
  readConciergeSettings,
} from './conciergeSettings.js';

/**
 * The figure this file produces goes on a screen next to a price, so the tests
 * are about refusing to produce one: an unset clinic, a zero, a string, a
 * nonsense term. Every one of those has to come back as "no financing block"
 * rather than as a number the clinic never offered.
 */

describe('reading a clinic that configured nothing', () => {
  it.each([
    ['no settings at all', null],
    ['settings that are not an object', 'nope'],
    ['settings with no concierge block', { timezone: 'Asia/Almaty' }],
    ['a concierge block that is not an object', { concierge: 42 }],
  ])('%s → nothing enabled', (_label, raw) => {
    expect(readConciergeSettings(raw)).toEqual(CONCIERGE_DEFAULTS);
  });
});

describe('the financing term is only what the clinic actually typed', () => {
  const read = (financingMonths: unknown) =>
    readConciergeSettings({ concierge: { financingMonths } }).financingMonths;

  it('accepts a sane whole number of months', () => {
    expect(read(12)).toBe(12);
    expect(read(MIN_FINANCING_MONTHS)).toBe(MIN_FINANCING_MONTHS);
    expect(read(MAX_FINANCING_MONTHS)).toBe(MAX_FINANCING_MONTHS);
  });

  it.each([
    ['zero — a division by zero on a price the patient is reading', 0],
    ['one month, which is not an instalment plan', 1],
    ['a negative term', -6],
    ['a fractional term', 7.5],
    ['a term nobody types on purpose', MAX_FINANCING_MONTHS + 1],
    ['words instead of a number', 'двенадцать'],
    ['a number with a unit stuck to it', '12 месяцев'],
    ['an empty string', ''],
    ['nothing', undefined],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(read(value)).toBeNull();
  });

  it('accepts an unambiguous numeric string, because settings forms produce them', () => {
    // Rejecting "12" would silently hide a financing block the clinic really
    // did configure — a worse outcome than reading a value that can only mean
    // one thing. Anything genuinely ambiguous is rejected above.
    expect(read('12')).toBe(12);
  });
});

describe('the note never appears without a figure to sit next to', () => {
  it('is kept when a term is configured', () => {
    const s = readConciergeSettings({ concierge: { financingMonths: 6, financingNote: 'Рассрочка от партнёра' } });
    expect(s.financingNote).toBe('Рассрочка от партнёра');
  });

  it('is dropped when the term is not', () => {
    const s = readConciergeSettings({ concierge: { financingNote: 'Рассрочка от партнёра' } });
    expect(s.financingNote).toBeNull();
  });

  it('is dropped when the term was rejected', () => {
    const s = readConciergeSettings({ concierge: { financingMonths: 0, financingNote: 'Рассрочка' } });
    expect(s.financingNote).toBeNull();
  });
});

describe('persona and locale', () => {
  it('takes a clinic persona name', () => {
    expect(readConciergeSettings({ concierge: { personaName: '  Аружан  ' } }).personaName).toBe('Аружан');
  });

  it('ignores a locale the presentation cannot render', () => {
    expect(readConciergeSettings({ concierge: { defaultLocale: 'fr' } }).defaultLocale).toBeNull();
    expect(readConciergeSettings({ concierge: { defaultLocale: 'kk' } }).defaultLocale).toBe('kk');
  });
});

describe('the monthly figure is plain division and nothing else', () => {
  it('divides the total by the term', () => {
    expect(monthlyFigure(1_200_000, 12)).toBe(100_000);
  });

  it('rounds up, so the parts never add to less than the whole', () => {
    // 700 000 / 3 = 233 333.33 — rounding down would quote a number that does
    // not reach the total, and the patient would be right to call that
    // misleading.
    expect(monthlyFigure(700_000, 3)).toBe(233_334);
    expect(monthlyFigure(700_000, 3) * 3).toBeGreaterThanOrEqual(700_000);
  });

  it('adds no interest — the figure times the term is never more than a rounding away', () => {
    const total = 480_000;
    const months = 7;
    const monthly = monthlyFigure(total, months);
    expect(monthly * months - total).toBeLessThan(months);
  });

  it.each([
    ['a zero total', 0, 12],
    ['a negative total', -100, 12],
    ['a term of one', 100_000, 1],
    ['a fractional term', 100_000, 2.5],
  ])('returns 0 for %s, so no beat is emitted', (_label, total, months) => {
    expect(monthlyFigure(total, months)).toBe(0);
  });
});
