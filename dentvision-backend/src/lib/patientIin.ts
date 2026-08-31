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
import { hmacIin, encryptField } from './phi.js';
import { normalizeIin, isValidIin, iinBirthDate, iinSex } from './iin.js';

export class IinValidationError extends Error {
  constructor(
    public code: 'FORMAT' | 'DUPLICATE' | 'BIRTHDATE_MISMATCH' | 'SEX_MISMATCH' | 'REQUIRED',
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

/**
 * Reasons the IIN requirement may be waived, and the only values the API
 * accepts. A free-form string would defeat the point: "no IIN" has to stay a
 * documented decision, not a text box someone types a space into.
 */
export const NO_IIN_REASONS = ['foreign', 'no_document', 'created_without_iin'] as const;
export type NoIinReason = (typeof NO_IIN_REASONS)[number];

export function isNoIinReason(value: unknown): value is NoIinReason {
  return typeof value === 'string' && (NO_IIN_REASONS as readonly string[]).includes(value);
}

/** The three IIN columns of a `Patient`, ready to write. `iin` is already encrypted. */
export interface PatientIinFields {
  iin: string | null;
  iinHash: string | null;
  noIinReason: string | null;
}

/**
 * The single place a Patient's IIN columns are produced.
 *
 * A patient is created in five places — the CRM form, the online-booking
 * confirmation, the ai-admin webhook, the legacy admin agent and the demo
 * seed — and before this each of them decided for itself whether to validate,
 * whether to hash, and whether to encrypt. The result was a directory with
 * holes and a mix of plaintext and ciphertext in one column. Routing all five
 * through here is what makes "the platform gradually collects every IIN" true
 * rather than aspirational.
 *
 * `required` is what separates a desk that can ask for a document from a
 * channel that cannot: the CRM form passes `true`, the booking paths pass
 * `false` with an explicit `noIinReason`.
 */
export async function buildPatientIinFields(input: {
  iin?: unknown;
  noIinReason?: unknown;
  clinicId: string;
  excludePatientId?: string;
  birthDate?: unknown;
  gender?: unknown;
  required?: boolean;
}): Promise<PatientIinFields> {
  const raw = input.iin === undefined || input.iin === null ? '' : String(input.iin).trim();

  if (raw) {
    const validated = await assertValidPatientIin({
      iin: raw,
      clinicId: input.clinicId,
      excludePatientId: input.excludePatientId,
      birthDate: input.birthDate,
      gender: input.gender,
    });
    // Encrypted here rather than at the call site so no write path can forget:
    // the hash is what stays queryable, the value itself does not need to be
    // readable in a database dump.
    return { iin: encryptField(validated.iin), iinHash: validated.iinHash, noIinReason: null };
  }

  if (isNoIinReason(input.noIinReason)) {
    return { iin: null, iinHash: null, noIinReason: input.noIinReason };
  }

  if (input.required) {
    throw new IinValidationError(
      'REQUIRED',
      'Укажите ИИН или отметьте, почему его нет',
    );
  }

  return { iin: null, iinHash: null, noIinReason: null };
}
