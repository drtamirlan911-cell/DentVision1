import { describe, expect, it } from 'vitest';
import { classifyMedicalHistory, parseBackfillOptions } from './backfill-medical-history.js';

describe('medical-history backfill safeguards', () => {
  it('defaults to a read-only dry run', () => {
    expect(parseBackfillOptions([], { MEDICAL_HISTORY_BACKFILL_TARGET: 'production' }))
      .toEqual({ apply: false, target: null, batchSize: 250 });
  });

  it('requires explicit matching target confirmations for writes', () => {
    expect(() => parseBackfillOptions(['--apply', '--target=staging'], {
      MEDICAL_HISTORY_BACKFILL_TARGET: 'staging',
    })).toThrow(/--confirm-target/);
    expect(() => parseBackfillOptions([
      '--apply', '--target=staging', '--confirm-target=staging',
    ], { MEDICAL_HISTORY_BACKFILL_TARGET: 'production' }))
      .toThrow(/must match the confirmed target/);
  });

  it('allows staging writes only when command and environment agree', () => {
    expect(parseBackfillOptions([
      '--apply', '--target=staging', '--confirm-target=staging',
    ], { MEDICAL_HISTORY_BACKFILL_TARGET: 'staging' }))
      .toMatchObject({ apply: true, target: 'staging' });
  });

  it('requires additional explicit confirmation for production writes', () => {
    expect(() => parseBackfillOptions([
      '--apply', '--target=production', '--confirm-target=production',
    ], { MEDICAL_HISTORY_BACKFILL_TARGET: 'production' })).toThrow(/--allow-production/);
    expect(parseBackfillOptions([
      '--apply', '--target=production', '--confirm-target=production',
      '--allow-production', '--confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL',
    ], { MEDICAL_HISTORY_BACKFILL_TARGET: 'production' }))
      .toMatchObject({ apply: true, target: 'production' });
  });

  it('rejects invalid batch sizes', () => {
    expect(() => parseBackfillOptions(['--batch-size=0'], {})).toThrow(/--batch-size/);
    expect(() => parseBackfillOptions(['--batch-size=1001'], {})).toThrow(/--batch-size/);
  });

  it('distinguishes plaintext JSON, new envelopes, legacy ciphertext, and null', () => {
    expect(classifyMedicalHistory({ allergies: 'penicillin' })).toBe('plaintext');
    expect(classifyMedicalHistory({ __dentvisionEncryptedV1: 'ENC:payload' })).toBe('envelope');
    expect(classifyMedicalHistory('ENC:legacy')).toBe('legacy-ciphertext');
    expect(classifyMedicalHistory(null)).toBe('null');
  });
});
