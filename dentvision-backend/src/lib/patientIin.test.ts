import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeIin } from './iin.js';

/**
 * What has to hold: a malformed IIN is refused before any DB call happens;
 * a birth-date or sex mismatch is refused even when the checksum is
 * perfectly valid (the whole point of the cross-check, per `iin.ts`'s own
 * documented weak spot); uniqueness is scoped to one clinic, never global,
 * and never trips over the record being updated.
 */

const { patientFindFirst } = vi.hoisted(() => ({ patientFindFirst: vi.fn() }));
vi.mock('./prisma.js', () => ({ default: { patient: { findFirst: patientFindFirst } } }));

const {
  IinValidationError,
  assertValidIinFormat,
  checkIinCrossFields,
  assertUniquePatientIin,
  assertValidPatientIin,
} = await import('./patientIin.js');

// 1990-01-01, century/sex digit 3 → 1900s, odd → male.
const MALE_IIN = completeIin('90010135012')!;
// Same date, century/sex digit 4 → 1900s, even → female.
const FEMALE_IIN = completeIin('90010145012')!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertValidIinFormat', () => {
  it('returns the normalized digits for a valid IIN', () => {
    expect(assertValidIinFormat(MALE_IIN)).toBe(MALE_IIN);
  });

  it('strips spaces and dashes before checking', () => {
    const spaced = `${MALE_IIN.slice(0, 6)} ${MALE_IIN.slice(6, 7)}-${MALE_IIN.slice(7)}`;
    expect(assertValidIinFormat(spaced)).toBe(MALE_IIN);
  });

  it.each([
    ['too short', '123456789'],
    ['not a real date', '999999999012'],
    ['wrong check digit', `${MALE_IIN.slice(0, 11)}${MALE_IIN[11] === '0' ? '1' : '0'}`],
  ])('throws FORMAT for %s', (_label, bad) => {
    expect(() => assertValidIinFormat(bad)).toThrow(IinValidationError);
    try {
      assertValidIinFormat(bad);
    } catch (e) {
      expect((e as InstanceType<typeof IinValidationError>).code).toBe('FORMAT');
    }
  });
});

describe('checkIinCrossFields', () => {
  it('passes when the birth date matches what the IIN encodes', () => {
    expect(() => checkIinCrossFields(MALE_IIN, '1990-01-01', undefined)).not.toThrow();
  });

  it('throws BIRTHDATE_MISMATCH when the recorded birth date disagrees', () => {
    expect(() => checkIinCrossFields(MALE_IIN, '1985-05-05', undefined)).toThrow(IinValidationError);
    try {
      checkIinCrossFields(MALE_IIN, '1985-05-05', undefined);
    } catch (e) {
      expect((e as InstanceType<typeof IinValidationError>).code).toBe('BIRTHDATE_MISMATCH');
    }
  });

  it('passes when sex matches, recognising common ru/en spellings', () => {
    expect(() => checkIinCrossFields(MALE_IIN, undefined, 'male')).not.toThrow();
    expect(() => checkIinCrossFields(MALE_IIN, undefined, 'М')).not.toThrow();
    expect(() => checkIinCrossFields(FEMALE_IIN, undefined, 'женский')).not.toThrow();
  });

  it('throws SEX_MISMATCH when the recorded sex disagrees', () => {
    expect(() => checkIinCrossFields(MALE_IIN, undefined, 'female')).toThrow(IinValidationError);
    try {
      checkIinCrossFields(MALE_IIN, undefined, 'female');
    } catch (e) {
      expect((e as InstanceType<typeof IinValidationError>).code).toBe('SEX_MISMATCH');
    }
  });

  it('is silent when gender is an unrecognised free-text value', () => {
    expect(() => checkIinCrossFields(MALE_IIN, undefined, 'other')).not.toThrow();
    expect(() => checkIinCrossFields(MALE_IIN, undefined, '')).not.toThrow();
  });

  it('is silent when no birth date or gender is given at all', () => {
    expect(() => checkIinCrossFields(MALE_IIN)).not.toThrow();
  });
});

describe('assertUniquePatientIin', () => {
  it('passes when no other patient in the clinic carries this IIN', async () => {
    patientFindFirst.mockResolvedValue(null);
    await expect(assertUniquePatientIin('clinic-1', 'hash-1')).resolves.toBeUndefined();
  });

  it('throws DUPLICATE when another patient in the same clinic already has it', async () => {
    patientFindFirst.mockResolvedValue({ id: 'other-patient' });
    await expect(assertUniquePatientIin('clinic-1', 'hash-1')).rejects.toMatchObject({ code: 'DUPLICATE' });
  });

  it('excludes the patient being updated from the duplicate check', async () => {
    patientFindFirst.mockResolvedValue(null);
    await assertUniquePatientIin('clinic-1', 'hash-1', 'patient-being-edited');
    const where = patientFindFirst.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: 'patient-being-edited' });
  });

  it('scopes the lookup to clinicId — a shared IIN across clinics is not a duplicate here', async () => {
    patientFindFirst.mockResolvedValue(null);
    await assertUniquePatientIin('clinic-1', 'hash-1');
    const where = patientFindFirst.mock.calls[0][0].where;
    expect(where.clinicId).toBe('clinic-1');
  });

  it('never matches a soft-deleted patient', async () => {
    patientFindFirst.mockResolvedValue(null);
    await assertUniquePatientIin('clinic-1', 'hash-1');
    const where = patientFindFirst.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
  });
});

describe('assertValidPatientIin', () => {
  it('composes format, cross-field and uniqueness checks and returns the hash', async () => {
    patientFindFirst.mockResolvedValue(null);
    const result = await assertValidPatientIin({
      iin: MALE_IIN,
      clinicId: 'clinic-1',
      birthDate: '1990-01-01',
      gender: 'male',
    });
    expect(result.iin).toBe(MALE_IIN);
    expect(result.iinHash).toEqual(expect.any(String));
  });

  it('fails on format before ever touching the database', async () => {
    await expect(
      assertValidPatientIin({ iin: 'not-an-iin', clinicId: 'clinic-1' }),
    ).rejects.toMatchObject({ code: 'FORMAT' });
    expect(patientFindFirst).not.toHaveBeenCalled();
  });

  it('fails on a cross-field mismatch before the uniqueness check', async () => {
    await expect(
      assertValidPatientIin({ iin: MALE_IIN, clinicId: 'clinic-1', birthDate: '2000-01-01' }),
    ).rejects.toMatchObject({ code: 'BIRTHDATE_MISMATCH' });
    expect(patientFindFirst).not.toHaveBeenCalled();
  });

  it('fails DUPLICATE only after format and cross-fields both pass', async () => {
    patientFindFirst.mockResolvedValue({ id: 'other-patient' });
    await expect(
      assertValidPatientIin({ iin: MALE_IIN, clinicId: 'clinic-1' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE' });
  });
});
