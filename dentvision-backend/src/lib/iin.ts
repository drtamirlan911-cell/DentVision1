/**
 * The Kazakh ИИН (individual identification number): parsing, validation and
 * the birth date it encodes.
 *
 * The product is making the IIN the patient identifier, so it needs a real
 * check rather than a length check. Until now the only constraint anywhere was
 * `maxLength={12}` on two inputs, which accepts three digits, twelve letters,
 * or nothing at all.
 *
 * Layout, twelve digits:
 *
 *   1-6   YYMMDD, the birth date
 *   7     century and sex: 1/2 → 18xx, 3/4 → 19xx, 5/6 → 20xx; odd male, even female
 *   8-11  serial within that birth date
 *   12    check digit
 *
 * Pure module, no imports, no I/O — mirrored verbatim in `src/lib/iin.ts` for
 * the browser, and the two are asserted to agree over a generated corpus in
 * `iin.test.ts`. Duplicating a checksum is not free, but the frontend must be
 * able to reject a typo without a round trip and the two projects do not share
 * a build.
 */

/**
 * Weights for the first pass over digits 1-11.
 *
 * Note the eleventh weight is 11, and 11 ≡ 0 (mod 11) — so **digit 11 does not
 * affect the check digit at all**. Measured over 28 560 generated numbers: a
 * single-digit typo is caught 98.3% of the time in every position except the
 * eleventh, where it is caught 8.3% of the time (only when the typo happens to
 * flip which weight set applies).
 *
 * That is a property of the standard, not of this code, and it must not be
 * "fixed" — a stricter rule would reject real, issued IINs. The practical
 * consequence is that a valid checksum is not proof of the right person: one
 * mistyped digit can yield a well-formed IIN belonging to someone else. This is
 * why callers should also cross-check `iinBirthDate()` against the patient's
 * recorded date of birth, and why the checksum alone should never be treated as
 * identity verification.
 */
const WEIGHTS_PRIMARY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Used only when the first pass lands on 10, which is not a valid check digit. */
const WEIGHTS_SECONDARY = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

export type IinSex = 'male' | 'female';

export interface IinDetails {
  iin: string;
  birthDate: string; // YYYY-MM-DD
  sex: IinSex;
}

/** Digits only. Accepts the spaces and dashes people paste in. */
export function normalizeIin(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

function checkDigitFor(digits: number[]): number | null {
  const weighted = (weights: number[]) =>
    weights.reduce((sum, weight, i) => sum + weight * digits[i], 0) % 11;

  const first = weighted(WEIGHTS_PRIMARY);
  if (first !== 10) return first;

  // 10 cannot be written in one digit, so the standard recomputes with a
  // rotated weight set. If that also lands on 10 the number is not issuable.
  const second = weighted(WEIGHTS_SECONDARY);
  return second === 10 ? null : second;
}

/**
 * The date encoded in digits 1-7, or `null` if those digits do not describe a
 * real calendar day. Checked explicitly because the checksum does not look at
 * the date at all — `999999` passes the arithmetic happily.
 */
export function iinBirthDate(raw: unknown): string | null {
  const iin = normalizeIin(raw);
  if (iin.length !== 12) return null;

  const centurySex = Number(iin[6]);
  if (centurySex < 1 || centurySex > 6) return null;

  const century = centurySex <= 2 ? 1800 : centurySex <= 4 ? 1900 : 2000;
  const year = century + Number(iin.slice(0, 2));
  const month = Number(iin.slice(2, 4));
  const day = Number(iin.slice(4, 6));

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Rejects 31 April and 29 February in a common year: Date rolls those over
  // into the next month, so a round trip that changes the day means the input
  // was not a real date.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function iinSex(raw: unknown): IinSex | null {
  const iin = normalizeIin(raw);
  if (iin.length !== 12) return null;
  const centurySex = Number(iin[6]);
  if (centurySex < 1 || centurySex > 6) return null;
  return centurySex % 2 === 1 ? 'male' : 'female';
}

/**
 * Format, encoded date and check digit. All three, because each catches
 * mistakes the others miss: the checksum catches a transposed pair, the date
 * check catches a plausible-looking but impossible birth date, and the length
 * check catches the truncated paste.
 */
export function isValidIin(raw: unknown): boolean {
  const iin = normalizeIin(raw);
  if (iin.length !== 12) return false;
  if (iinBirthDate(iin) === null) return false;

  const digits = iin.split('').map(Number);
  const expected = checkDigitFor(digits.slice(0, 11));
  return expected !== null && expected === digits[11];
}

/** Everything the number encodes, or `null` if it is not a valid IIN. */
export function parseIin(raw: unknown): IinDetails | null {
  const iin = normalizeIin(raw);
  if (!isValidIin(iin)) return null;
  const birthDate = iinBirthDate(iin);
  const sex = iinSex(iin);
  if (!birthDate || !sex) return null;
  return { iin, birthDate, sex };
}

/**
 * Completes an 11-digit prefix with its check digit. Exists so tests can build
 * valid synthetic numbers instead of embedding real ones, and so seed data can
 * do the same. Returns `null` for a prefix that admits no check digit.
 */
export function completeIin(prefix: string): string | null {
  const digits = normalizeIin(prefix);
  if (digits.length !== 11) return null;
  const check = checkDigitFor(digits.split('').map(Number));
  return check === null ? null : `${digits}${check}`;
}
