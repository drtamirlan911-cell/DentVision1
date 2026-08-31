/**
 * Valid, unique IINs for tests.
 *
 * The IIN became required when a patient is created, so a fixture that omits
 * one is refused — correctly. Giving tests a real number rather than blanket
 * "no IIN" waivers keeps them faithful: the requirement is exercised on the
 * normal path, and the waiver is tested where it is actually the subject.
 *
 * Uniqueness matters because the IIN is unique per clinic: two fixtures
 * sharing a number would collide as a duplicate, not as whatever the test is
 * really about.
 */

const WEIGHTS_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const WEIGHTS_2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

function checkDigit(digits: number[]): number | null {
  const sum1 = digits.reduce((acc, d, i) => acc + d * WEIGHTS_1[i], 0) % 11;
  if (sum1 !== 10) return sum1;
  const sum2 = digits.reduce((acc, d, i) => acc + d * WEIGHTS_2[i], 0) % 11;
  return sum2 === 10 ? null : sum2;
}

let counter = 0;

/**
 * A fresh valid IIN, optionally agreeing with a fixture's own birth date and
 * sex.
 *
 * The backend cross-checks the date and sex encoded in the IIN against the
 * fields submitted with it (`checkIinCrossFields`) — a fixture that says
 * 1990-05-15 and sends a number encoding 1990-01-01 is refused, correctly.
 * Passing the same date here keeps the fixture self-consistent instead of
 * silently weakening the check.
 *
 * Twelve digits exactly: YYMMDD (6) + century/sex digit (1) + sequence (4) +
 * check digit (1). Getting that arithmetic wrong produces a thirteen-digit
 * string every validator rejects — which is how this helper failed the first
 * time it ran.
 */
export function makeIin(birthDate = '1990-01-01', sex: 'male' | 'female' = 'male'): string {
  const [year, month, day] = birthDate.split('-');
  const yymmdd = `${year.slice(2)}${month}${day}`;
  // 1900s: 3 for male, 4 for female (2000s would be 5 and 6).
  const centurySex = sex === 'male' ? '3' : '4';

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    counter += 1;
    const seq = String((counter + Date.now()) % 10_000).padStart(4, '0');
    const digits = `${yymmdd}${centurySex}${seq}`.split('').map(Number);
    const check = checkDigit(digits);
    if (check !== null) return `${yymmdd}${centurySex}${seq}${check}`;
  }
  throw new Error('makeIin: could not build a valid IIN');
}
