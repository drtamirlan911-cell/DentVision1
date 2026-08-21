/**
 * The checks an IIN write site has to run beyond the pure format+checksum in
 * `iin.ts` — cross-referencing the date and sex it encodes against what the
 * record already says, and, where the record is a `Patient`, that no other
 * patient in the same clinic already carries it.
 *
 * Two patients at different clinics may legitimately share an IIN — that is
 * the exact scenario `crossClinicAccess.ts` exists for — so uniqueness here
 * is scoped to `clinicId`, never global.
 */

import prisma from './prisma.js';
import { hmacIin } from './phi.js';
import { normalizeIin, isValidIin, iinBirthDate, iinSex } from './iin.js';

export class IinValidationError extends Error {
  constructor(
    public code: 'FORMAT' | 'DUPLICATE' | 'BIRTHDATE_MISMATCH' | 'SEX_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'IinValidationError';
  }
}

/** Digits-only, format- and checksum-valid, or throws. */
export function assertValidIinFormat(raw: unknown): string {
  const iin = normalizeIin(raw);
  if (!isValidIin(iin)) {
    throw new IinValidationError('FORMAT', 'Указан некорректный ИИН');
  }
  return iin;
}

const GENDER_MALE = new Set(['male', 'm', 'м', 'муж', 'мужской']);
const GENDER_FEMALE = new Set(['female', 'f', 'ж', 'жен', 'женский']);

function normalizeGenderForCheck(raw: unknown): 'male' | 'female' | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (GENDER_MALE.has(value)) return 'male';
  if (GENDER_FEMALE.has(value)) return 'female';
  return null;
}

/**
 * The checksum's eleventh weight cancels to zero (see `iin.ts`), so a valid
 * checksum alone is not proof of the right IIN — a single mistyped digit can
 * still land on someone else's number. Cross-checking the date and sex the
 * IIN encodes against what was actually entered catches most of what the
 * checksum cannot. Silently skipped when the field being compared against
 * (`birthDate`, `gender`) is absent or not in a recognised shape — this is a
 * safety net, not a requirement to fill in every field.
 */
export function checkIinCrossFields(iin: string, birthDate?: unknown, gender?: unknown): void {
  if (birthDate) {
    const encoded = iinBirthDate(iin);
    const provided = new Date(birthDate as string | number | Date);
    if (encoded && !Number.isNaN(provided.getTime())) {
      const providedIso = provided.toISOString().slice(0, 10);
      if (providedIso !== encoded) {
        throw new IinValidationError(
          'BIRTHDATE_MISMATCH',
          `ИИН кодирует дату рождения ${encoded}, а указана ${providedIso}`,
        );
      }
    }
  }

  const encodedSex = iinSex(iin);
  const normalizedGender = normalizeGenderForCheck(gender);
  if (encodedSex && normalizedGender && normalizedGender !== encodedSex) {
    throw new IinValidationError('SEX_MISMATCH', 'Пол не совпадает с полом, закодированным в ИИН');
  }
}

/**
 * No other patient in this clinic may already carry this IIN. Scoped to
 * `clinicId`, never global, and blind to soft-deleted rows — a removed
 * patient's IIN does not permanently squat the number.
 */
export async function assertUniquePatientIin(
  clinicId: string,
  iinHash: string,
  excludePatientId?: string,
): Promise<void> {
  const duplicate = await prisma.patient.findFirst({
    where: {
      clinicId,
      iinHash,
      deletedAt: null,
      ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new IinValidationError('DUPLICATE', 'Пациент с таким ИИН уже есть в этой клинике');
  }
}

/** The full guard for a `Patient` write: format, cross-fields, then uniqueness. */
export async function assertValidPatientIin(input: {
  iin: unknown;
  clinicId: string;
  excludePatientId?: string;
  birthDate?: unknown;
  gender?: unknown;
}): Promise<{ iin: string; iinHash: string }> {
  const iin = assertValidIinFormat(input.iin);
  checkIinCrossFields(iin, input.birthDate, input.gender);
  const iinHash = hmacIin(iin);
  await assertUniquePatientIin(input.clinicId, iinHash, input.excludePatientId);
  return { iin, iinHash };
}
