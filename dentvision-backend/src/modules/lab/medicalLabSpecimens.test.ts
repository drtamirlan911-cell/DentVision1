import { describe, expect, it } from 'vitest';
import { buildMedicalLabBarcode, isMedicalLabSpecimenTransitionAllowed, normalizeMedicalLabBarcode } from './medicalLabSpecimens.js';

describe('medical laboratory accession barcode', () => {
  it('normalizes scanner input but keeps the canonical accession format', () => {
    expect(normalizeMedicalLabBarcode('  dvl-ab12 34cd56  ')).toBe('DVL-AB1234CD56');
  });

  it('rejects unsafe or malformed barcode input', () => {
    expect(normalizeMedicalLabBarcode('abc')).toBeNull();
    expect(normalizeMedicalLabBarcode('DVL-123456;DROP')).toBeNull();
    expect(normalizeMedicalLabBarcode('DVL-123456789012345678901234567890123456789')).toBeNull();
  });

  it('generates deterministic accession ids from the specimen id', () => {
    expect(buildMedicalLabBarcode('12345678-1234-1234-1234-123456789abc')).toBe('DVL-1234567812341234');
    expect(() => buildMedicalLabBarcode('short')).toThrow();
  });

  it('allows only forward specimen custody transitions', () => {
    expect(isMedicalLabSpecimenTransitionAllowed('collected', 'received')).toBe(true);
    expect(isMedicalLabSpecimenTransitionAllowed('collected', 'rejected')).toBe(true);
    expect(isMedicalLabSpecimenTransitionAllowed('received', 'processing')).toBe(true);
    expect(isMedicalLabSpecimenTransitionAllowed('consumed', 'received')).toBe(false);
    expect(isMedicalLabSpecimenTransitionAllowed('rejected', 'processing')).toBe(false);
  });
});