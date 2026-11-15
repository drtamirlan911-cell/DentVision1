import { describe, expect, it } from 'vitest';
import { classifyMedicalHistory, isStructuredMedicalHistoryRoot, parseBackfillOptions } from './backfill-medical-history.js';

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

  it('allows staging writes only when command, environment and datasource agree', () => {
    const stagingUrl = 'postgresql://staging.example.test/dentvision';
    expect(parseBackfillOptions([
      '--apply', '--target=staging', '--confirm-target=staging',
    ], {
      MEDICAL_HISTORY_BACKFILL_TARGET: 'staging',
      DATABASE_URL: stagingUrl,
      MEDICAL_HISTORY_BACKFILL_STAGING_DATABASE_URL: stagingUrl,
    })).toMatchObject({ apply: true, target: 'staging' });
  });

  it('rejects a staging label when DATABASE_URL points to a different database', () => {
    expect(() => parseBackfillOptions([
      '--apply', '--target=staging', '--confirm-target=staging',
    ], {
      MEDICAL_HISTORY_BACKFILL_TARGET: 'staging',
      DATABASE_URL: 'postgresql://production.example.test/dentvision',
      MEDICAL_HISTORY_BACKFILL_STAGING_DATABASE_URL: 'postgresql://staging.example.test/dentvision',
    })).toThrow(/does not match the configured staging medical-history backfill database/);
  });

  it('requires a target-specific expected datasource before any write', () => {
    expect(() => parseBackfillOptions([
      '--apply', '--target=staging', '--confirm-target=staging',
    ], {
      MEDICAL_HISTORY_BACKFILL_TARGET: 'staging',
      DATABASE_URL: 'postgresql://staging.example.test/dentvision',
    })).toThrow(/MEDICAL_HISTORY_BACKFILL_STAGING_DATABASE_URL/);
  });

  it('requires additional explicit confirmation for production writes', () => {
    expect(() => parseBackfillOptions([
      '--apply', '--target=production', '--confirm-target=production',
    ], { MEDICAL_HISTORY_BACKFILL_TARGET: 'production' })).toThrow(/--allow-production/);
    expect(parseBackfillOptions([
      '--apply', '--target=production', '--confirm-target=production',
      '--allow-production', '--confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL',
    ], {
      MEDICAL_HISTORY_BACKFILL_TARGET: 'production',
      DATABASE_URL: 'postgresql://production.example.test/dentvision',
      MEDICAL_HISTORY_BACKFILL_PRODUCTION_DATABASE_URL: 'postgresql://production.example.test/dentvision',
    })).toMatchObject({ apply: true, target: 'production' });
  });

  it('rejects invalid batch sizes', () => {
    expect(() => parseBackfillOptions(['--batch-size=0'], {})).toThrow(/--batch-size/);
    expect(() => parseBackfillOptions(['--batch-size=1001'], {})).toThrow(/--batch-size/);
  });

  it('only accepts structured object roots for plaintext/envelope history backfill', () => {
    expect(isStructuredMedicalHistoryRoot({ allergies: 'penicillin' })).toBe(true);
    expect(isStructuredMedicalHistoryRoot({})).toBe(true);
    expect(isStructuredMedicalHistoryRoot([])).toBe(false);
    expect(isStructuredMedicalHistoryRoot('legacy plaintext')).toBe(false);
    expect(isStructuredMedicalHistoryRoot(42)).toBe(false);
    expect(isStructuredMedicalHistoryRoot(false)).toBe(false);
    expect(isStructuredMedicalHistoryRoot(null)).toBe(false);
  });

  it('distinguishes plaintext JSON, new envelopes, legacy ciphertext, and null', () => {
    expect(classifyMedicalHistory({ allergies: 'penicillin' })).toBe('plaintext');
    expect(classifyMedicalHistory({ __dentvisionEncryptedV1: 'ENC:payload' })).toBe('envelope');
    expect(classifyMedicalHistory('ENC:legacy')).toBe('legacy-ciphertext');
    expect(classifyMedicalHistory(null)).toBe('null');
  });
});
