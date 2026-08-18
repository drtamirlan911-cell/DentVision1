import { describe, expect, it } from 'vitest';

import {
  completeIin,
  iinBirthDate,
  iinSex,
  isValidIin,
  normalizeIin,
  parseIin,
} from './iin.js';

// The browser copy. Every assertion about behaviour below is also run against
// this one in the parity block at the bottom, so the two cannot drift.
import {
  isValidIin as feIsValidIin,
  iinBirthDate as feIinBirthDate,
  iinSex as feIinSex,
  normalizeIin as feNormalizeIin,
} from '../../../src/lib/iin';

/**
 * Every IIN in this file is synthetic: an 11-digit prefix chosen here, closed
 * with `completeIin`. No real person's identification number belongs in a
 * repository, and none is needed to test the arithmetic.
 */
function synthetic(prefix: string): string {
  const iin = completeIin(prefix);
  if (!iin) throw new Error(`no valid check digit exists for prefix ${prefix}`);
  return iin;
}

describe('normalizeIin', () => {
  it('keeps digits and drops the separators people paste', () => {
    expect(normalizeIin(' 900101 350 123 ')).toBe('900101350123');
    expect(normalizeIin('900101-350-123')).toBe('900101350123');
  });

  it('is empty for null, undefined and text', () => {
    expect(normalizeIin(null)).toBe('');
    expect(normalizeIin(undefined)).toBe('');
    expect(normalizeIin('нет ИИН')).toBe('');
  });
});

describe('isValidIin', () => {
  it('accepts a well-formed number', () => {
    expect(isValidIin(synthetic('90010135012'))).toBe(true);
  });

  it('rejects anything that is not exactly twelve digits', () => {
    const valid = synthetic('90010135012');
    expect(isValidIin(valid.slice(0, 11))).toBe(false);
    expect(isValidIin(`${valid}4`)).toBe(false);
    expect(isValidIin('')).toBe(false);
    expect(isValidIin('abcdefghijkl')).toBe(false);
  });

  it('rejects a wrong check digit', () => {
    const valid = synthetic('90010135012');
    const wrongCheck = Number(valid[11]) === 9 ? '0' : String(Number(valid[11]) + 1);
    expect(isValidIin(valid.slice(0, 11) + wrongCheck)).toBe(false);
  });

  it('catches a transposition, which a length check cannot', () => {
    const valid = synthetic('90010135012');
    const swapped = valid.slice(0, 7) + valid[8] + valid[7] + valid.slice(9);
    // Guard the fixture itself: if the swap produced the same string the test
    // would pass without testing anything.
    expect(swapped).not.toBe(valid);
    expect(isValidIin(swapped)).toBe(false);
  });

  it('rejects an impossible birth date even when the checksum is right', () => {
    // 31 February. The checksum says nothing about the date, so without the
    // explicit calendar check this passes.
    const iin = synthetic('99023135012');
    expect(completeIin('99023135012')).not.toBeNull();
    expect(isValidIin(iin)).toBe(false);
  });

  it('rejects 29 February in a common year and accepts it in a leap year', () => {
    // 1999 was not a leap year; 2000 was. Century comes from digit 7:
    // 3 → 19xx, 5 → 20xx.
    expect(isValidIin(synthetic('99022935012'))).toBe(false);
    expect(isValidIin(synthetic('00022955012'))).toBe(true);
  });

  it('rejects month 00 and month 13', () => {
    expect(isValidIin(synthetic('90000135012'))).toBe(false);
    expect(isValidIin(synthetic('90130135012'))).toBe(false);
  });

  it('rejects day 00 and day 32', () => {
    expect(isValidIin(synthetic('90010035012'))).toBe(false);
    expect(isValidIin(synthetic('90013235012'))).toBe(false);
  });

  it('rejects century/sex digits outside 1-6', () => {
    // 0 and 7-9 are not assigned. These are exactly the values a hand-typed
    // number drifts into, and none of them is caught by the checksum.
    for (const centurySex of ['0', '7', '8', '9']) {
      const iin = synthetic(`900101${centurySex}5012`);
      expect(isValidIin(iin)).toBe(false);
    }
  });

  it('accepts all six assigned century/sex digits', () => {
    for (const centurySex of ['1', '2', '3', '4', '5', '6']) {
      expect(isValidIin(synthetic(`900101${centurySex}5012`))).toBe(true);
    }
  });

  it('exercises the second weight set', () => {
    // A prefix whose first pass lands on 10 must fall through to the rotated
    // weights. Search for one rather than hardcoding, so the test still means
    // something if the fixture ever changes.
    let covered = false;
    for (let serial = 0; serial < 10_000 && !covered; serial += 1) {
      const prefix = `9001013${String(serial).padStart(4, '0')}`;
      const primary =
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce(
          (sum, weight, i) => sum + weight * Number(prefix[i]),
          0,
        ) % 11;
      if (primary !== 10) continue;
      covered = true;
      const completed = completeIin(prefix);
      // Either a valid number via the secondary weights, or genuinely
      // unissuable — both are correct outcomes, silently returning the
      // impossible digit 10 is not.
      if (completed !== null) {
        expect(completed).toHaveLength(12);
        expect(Number(completed[11])).toBeLessThan(10);
        expect(isValidIin(completed)).toBe(true);
      }
    }
    expect(covered).toBe(true);
  });
});

describe('what the checksum does and does not protect', () => {
  // Measured, not assumed. These two tests exist so that nobody later
  // "tightens" the algorithm: a stricter rule would start rejecting real,
  // issued IINs, which is far worse than the gap it would close.

  it('catches a single-digit typo everywhere except the eleventh digit', () => {
    const iin = synthetic('90010135012');
    for (let pos = 0; pos < 12; pos += 1) {
      if (pos === 10) continue; // the eleventh digit — see below
      const other = String((Number(iin[pos]) + 1) % 10);
      const mutated = iin.slice(0, pos) + other + iin.slice(pos + 1);
      // Skip mutations that break the encoded date instead of the checksum,
      // otherwise this asserts the calendar check rather than the arithmetic.
      if (iinBirthDate(mutated) === null) continue;
      expect(isValidIin(mutated)).toBe(false);
    }
  });

  it('is blind to the eleventh digit, because its weight is 11 ≡ 0 (mod 11)', () => {
    const iin = synthetic('90010135012');
    let alsoValid = 0;
    for (let digit = 0; digit <= 9; digit += 1) {
      if (String(digit) === iin[10]) continue;
      const mutated = `${iin.slice(0, 10)}${digit}${iin[11]}`;
      if (isValidIin(mutated)) alsoValid += 1;
    }
    // All nine alternatives keep the same check digit. This is the standard's
    // behaviour: a valid checksum is not proof of the right person, which is
    // why callers cross-check the encoded birth date as well.
    expect(alsoValid).toBe(9);
  });
});

describe('iinBirthDate', () => {
  it('reads the century from digit 7', () => {
    expect(iinBirthDate(synthetic('90010115012'))).toBe('1890-01-01');
    expect(iinBirthDate(synthetic('90010135012'))).toBe('1990-01-01');
    expect(iinBirthDate(synthetic('90010155012'))).toBe('2090-01-01');
    expect(iinBirthDate(synthetic('00010155012'))).toBe('2000-01-01');
  });

  it('is null for a malformed number', () => {
    expect(iinBirthDate('123')).toBeNull();
    expect(iinBirthDate(synthetic('99023135012'))).toBeNull();
    expect(iinBirthDate(null)).toBeNull();
  });
});

describe('iinSex', () => {
  it('reads sex from the parity of digit 7', () => {
    expect(iinSex(synthetic('90010135012'))).toBe('male');
    expect(iinSex(synthetic('90010145012'))).toBe('female');
  });

  it('is null outside the assigned range', () => {
    expect(iinSex(synthetic('90010175012'))).toBeNull();
    expect(iinSex('123')).toBeNull();
  });
});

describe('parseIin', () => {
  it('returns everything the number encodes', () => {
    const iin = synthetic('90010145012');
    expect(parseIin(iin)).toEqual({ iin, birthDate: '1990-01-01', sex: 'female' });
  });

  it('normalises before parsing, so a pasted number with spaces works', () => {
    const iin = synthetic('90010145012');
    const spaced = `${iin.slice(0, 6)} ${iin.slice(6, 9)} ${iin.slice(9)}`;
    expect(parseIin(spaced)?.iin).toBe(iin);
  });

  it('is null for an invalid number', () => {
    expect(parseIin('900101350129')).toBeNull();
    expect(parseIin('')).toBeNull();
  });
});

describe('completeIin', () => {
  it('closes an eleven-digit prefix into a valid number', () => {
    const iin = completeIin('90010135012');
    expect(iin).toHaveLength(12);
    expect(isValidIin(iin!)).toBe(true);
  });

  it('refuses a prefix that is not eleven digits', () => {
    expect(completeIin('9001013501')).toBeNull();
    expect(completeIin('900101350123')).toBeNull();
  });
});

describe('parity with the browser copy in src/lib/iin.ts', () => {
  // A corpus rather than a fixture: valid numbers, wrong check digits,
  // impossible dates, every century/sex digit, and junk. Any behavioural drift
  // between the two implementations shows up here, not in production.
  const corpus: string[] = ['', '123', 'abcdefghijkl', '000000000000', '999999999999'];

  for (let centurySex = 0; centurySex <= 9; centurySex += 1) {
    for (const date of ['900101', '000229', '990229', '990231', '901301', '900100', '900132']) {
      const prefix = `${date}${centurySex}5012`;
      const completed = completeIin(prefix);
      if (completed) {
        corpus.push(completed);
        // The same number with a deliberately broken check digit.
        corpus.push(completed.slice(0, 11) + String((Number(completed[11]) + 1) % 10));
      }
      corpus.push(`${prefix}0`);
    }
  }

  it('covers a corpus worth checking', () => {
    expect(corpus.length).toBeGreaterThan(100);
    expect(corpus.filter((c) => isValidIin(c)).length).toBeGreaterThan(0);
    expect(corpus.filter((c) => !isValidIin(c)).length).toBeGreaterThan(0);
  });

  it('agrees on validity for every candidate', () => {
    for (const candidate of corpus) {
      expect(feIsValidIin(candidate)).toBe(isValidIin(candidate));
    }
  });

  it('agrees on the birth date for every candidate', () => {
    for (const candidate of corpus) {
      expect(feIinBirthDate(candidate)).toBe(iinBirthDate(candidate));
    }
  });

  it('agrees on sex and normalisation for every candidate', () => {
    for (const candidate of corpus) {
      expect(feIinSex(candidate)).toBe(iinSex(candidate));
      expect(feNormalizeIin(candidate)).toBe(normalizeIin(candidate));
    }
  });
});
