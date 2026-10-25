import { describe, expect, it } from 'vitest';
import {
  containsSensitivePatientData,
  isPatientScopedDraftKey,
  sanitizeForLocalStorage,
} from './localStoragePrivacy';

describe('localStorage patient-data privacy guard', () => {
  it('detects direct and nested PHI fields', () => {
    expect(containsSensitivePatientData({ patient: { iin: '000000000000' } })).toBe(true);
    expect(containsSensitivePatientData({ contact: { patientPhone: '+7 000 000 00 00' } })).toBe(true);
    expect(containsSensitivePatientData({ medicalHistory: 'HISTORY_PLACEHOLDER' })).toBe(true);
  });

  it('redacts patient contact and clinical fields from offline cache payloads', () => {
    const safe = sanitizeForLocalStorage({
      id: 'appointment-test',
      patientId: 'opaque-patient-reference',
      patientName: 'NAME_PLACEHOLDER',
      patientPhone: 'PHONE_PLACEHOLDER',
      diagnosis: 'DIAGNOSIS_PLACEHOLDER',
      notes: 'CLINICAL_NOTES_PLACEHOLDER',
      date: '2026-10-17',
      time: '10:30',
      nested: { iin: '000000000000', medicalCard: 'MEDICAL_CARD_PLACEHOLDER', phone: '+7 000 000 00 00' },
      displayLabel: 'reference 000000000000',
    });
    expect(safe).toEqual({
      id: 'appointment-test',
      patientId: 'opaque-patient-reference',
      date: '2026-10-17',
      time: '10:30',
      nested: {},
    });
    expect(containsSensitivePatientData(safe)).toBe(false);
  });

  it('recognizes patient-scoped autosave keys', () => {
    expect(isPatientScopedDraftKey('patient-intake')).toBe(true);
    expect(isPatientScopedDraftKey('medical-card-draft')).toBe(true);
    expect(isPatientScopedDraftKey('clinic-settings')).toBe(false);
  });

  it('detects likely identifiers inside otherwise generic text fields', () => {
    expect(containsSensitivePatientData({ displayLabel: 'contact 000000000000' })).toBe(true);
    expect(containsSensitivePatientData({ displayLabel: 'call +7 000 000 00 00' })).toBe(true);
  });
  it('redacts identifier-like scalar strings in arrays while preserving opaque identifiers', () => {
    const safe = sanitizeForLocalStorage({
      patientId: 'opaque-patient-reference',
      labels: [
        'General consultation',
        'call +7 777 123 45 67',
        'record IIN 000000000000',
      ],
    });
    expect(safe).toEqual({
      patientId: 'opaque-patient-reference',
      labels: ['General consultation'],
    });
  });

});
