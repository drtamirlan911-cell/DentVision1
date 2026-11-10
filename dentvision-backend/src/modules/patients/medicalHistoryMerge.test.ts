import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptMedicalHistory } from '../../lib/phi.js';
import { mergePatientMedicalHistory } from './medicalHistoryMerge.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'patient-history-merge-test-key-2026-11';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ENCRYPTION_KEY = originalKey;
});

describe('mergePatientMedicalHistory', () => {
  it('preserves unrelated history when a teeth-only upsert is received', () => {
    const original = {
      allergies: 'penicillin',
      complaints: 'pain when chewing',
      chronicDiseases: ['diabetes'],
      teeth: { '11': { status: 'healthy' } },
      tags: ['follow-up'],
    };
    const stored = encryptMedicalHistory(original);

    const merged = mergePatientMedicalHistory(stored, {
      id: 'patient-1',
      name: 'Patient Name',
      teeth: { '11': { status: 'caries', surfaces: { M: 'caries' } } },
    });

    expect(merged).toEqual({
      allergies: 'penicillin',
      complaints: 'pain when chewing',
      chronicDiseases: ['diabetes'],
      teeth: { '11': { status: 'caries', surfaces: { M: 'caries' } } },
      tags: ['follow-up'],
    });
  });

  it('merges partial medicalHistory objects without dropping existing keys', () => {
    const merged = mergePatientMedicalHistory({
      allergies: 'penicillin',
      source: 'referral',
      complaints: 'pain',
    }, {
      medicalHistory: { allergies: ['latex'] },
    });

    expect(merged).toEqual({
      allergies: ['latex'],
      source: 'referral',
      complaints: 'pain',
    });
  });

  it('honours explicit empty top-level values so fields can be cleared', () => {
    const merged = mergePatientMedicalHistory({
      allergies: 'penicillin',
      tags: ['urgent'],
      source: 'referral',
    }, {
      allergies: '',
      tags: [],
      source: null,
    });

    expect(merged).toEqual({
      allergies: '',
      tags: [],
      source: null,
    });
  });

  it('clears history only when medicalHistory is explicitly null', () => {
    const merged = mergePatientMedicalHistory({
      allergies: 'penicillin',
      complaints: 'pain',
    }, {
      medicalHistory: null,
      category: 'regular',
    });

    expect(merged).toEqual({ category: 'regular' });
  });

  it('does not silently discard a legacy scalar value on a partial upsert', () => {
    expect(() => mergePatientMedicalHistory('legacy portal text', {
      id: 'patient-legacy',
      teeth: { '11': { status: 'healthy' } },
    })).toThrow('PATIENT_HISTORY_LEGACY_SCALAR');
  });

  it('allows explicit replacement or explicit clearing of a legacy scalar value', () => {
    expect(mergePatientMedicalHistory('legacy portal text', {
      medicalHistory: { allergies: 'penicillin' },
    })).toEqual({ allergies: 'penicillin' });

    expect(mergePatientMedicalHistory('legacy portal text', {
      medicalHistory: null,
    })).toEqual({});
  });

  it('rejects array and scalar medicalHistory input', () => {
    expect(() => mergePatientMedicalHistory({}, { medicalHistory: [] }))
      .toThrow('PATIENT_HISTORY_INVALID_INPUT');
    expect(() => mergePatientMedicalHistory({}, { medicalHistory: 'text' }))
      .toThrow('PATIENT_HISTORY_INVALID_INPUT');
  });

  it('fails closed when the stored encrypted envelope cannot be decrypted', () => {
    expect(() => mergePatientMedicalHistory({
      __dentvisionEncryptedV1: 'ENC:not-valid-ciphertext',
    }, { teeth: { '11': { status: 'healthy' } } })).toThrow(/Unable to decrypt|Invalid medical-history/);
  });
});
