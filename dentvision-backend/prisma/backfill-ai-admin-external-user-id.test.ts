import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseAiAdminExternalIdBackfillOptions, prepareAiAdminExternalIdBackfillRow } from './backfill-ai-admin-external-user-id.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-external-id-backfill-test-key-32-chars';
});
afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalEncryptionKey;
});
const row = {
  id: 'session-1', clinicId: 'clinic-1', channel: 'WHATSAPP', externalUserId: '77010000000',
  externalUserIdCiphertext: null, externalUserIdHash: null, patientName: 'Test Patient', patientPhone: '77010000000',
  patientNameCiphertext: null, patientPhoneCiphertext: null,
};

describe('AI Admin external-identity backfill safeguards', () => {
  it('defaults to a read-only dry run', () => {
    expect(parseAiAdminExternalIdBackfillOptions([], { AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'production' })).toEqual({ apply: false, target: null, batchSize: 250 });
  });
  it('requires explicit target and environment confirmation for writes', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(['--apply', '--target=staging'], { AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'staging' })).toThrow(/--confirm-target/);
    expect(() => parseAiAdminExternalIdBackfillOptions(['--apply', '--target=staging', '--confirm-target=staging'], { AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'production' })).toThrow(/must match/);
  });
  it('allows staging writes only when command, environment, and actual Prisma datasource agree', () => {
    const stagingUrl = 'postgresql://staging.example.test/dentvision';
    expect(parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=staging', '--confirm-target=staging'],
      {
        AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'staging',
        DATABASE_URL: stagingUrl,
        AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL: stagingUrl,
      },
    )).toMatchObject({ apply: true, target: 'staging' });
  });
  it('rejects a staging confirmation when DATABASE_URL points to another database', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=staging', '--confirm-target=staging'],
      {
        AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'staging',
        DATABASE_URL: 'postgresql://production.example.test/dentvision',
        AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL: 'postgresql://staging.example.test/dentvision',
      },
    )).toThrow(/does not match the configured staging backfill database/);
  });
  it('requires a target-specific expected datasource URL before any write', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=staging', '--confirm-target=staging'],
      { AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'staging', DATABASE_URL: 'postgresql://staging.example.test/dentvision' },
    )).toThrow(/AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL/);
  });
  it('requires additional confirmation for production writes', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(['--apply', '--target=production', '--confirm-target=production'], { AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'production' })).toThrow(/--allow-production/);
    const productionUrl = 'postgresql://production.example.test/dentvision';
    expect(parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=production', '--confirm-target=production', '--allow-production', '--confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL'],
      {
        AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'production',
        DATABASE_URL: productionUrl,
        AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL: productionUrl,
      },
    )).toMatchObject({ apply: true, target: 'production' });
  });
  it('rejects invalid batch sizes', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(['--batch-size=0'], {})).toThrow(/batch-size/);
    expect(() => parseAiAdminExternalIdBackfillOptions(['--batch-size=1001'], {})).toThrow(/batch-size/);
  });
  it('encrypts external IDs and patient metadata without exposing plaintext', () => {
    const prepared = prepareAiAdminExternalIdBackfillRow(row);
    expect(prepared.externalUserIdCiphertext).toMatch(/^ENC:/);
    expect(prepared.externalUserIdHash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(prepared.patientNameCiphertext).toMatch(/^ENC:/);
    expect(prepared.patientPhoneCiphertext).toMatch(/^ENC:/);
    expect(prepared.patientNameCiphertext).not.toContain(row.patientName);
    expect(prepared.patientPhoneCiphertext).not.toContain(row.patientPhone);
  });
  it('handles legacy patient metadata when external ID is absent', () => {
    const prepared = prepareAiAdminExternalIdBackfillRow({ ...row, externalUserId: null });
    expect(prepared.externalUserIdHash).toBeNull();
    expect(prepared.patientNameCiphertext).toMatch(/^ENC:/);
  });
  it('rejects mismatched existing blind indexes', () => {
    expect(() => prepareAiAdminExternalIdBackfillRow({ ...row, externalUserIdHash: 'v1:wrong' })).toThrow(/does not match/);
  });
  it('rejects ciphertext that decrypts to a different identity', () => {
    const other = prepareAiAdminExternalIdBackfillRow({ ...row, externalUserId: '77010000001' });
    expect(() => prepareAiAdminExternalIdBackfillRow({ ...row, externalUserIdCiphertext: other.externalUserIdCiphertext })).toThrow(/round-trip/);
  });
});
