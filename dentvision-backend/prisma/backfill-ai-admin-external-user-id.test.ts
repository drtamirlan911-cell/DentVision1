import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeQueuedAiAdminMessage, decryptAiAdminJson, decryptAiAdminText, encryptAiAdminJson, encryptAiAdminText } from '../src/modules/ai-admin/conversation/phi.js';
import { buildAiAdminMessageBackfillWhere, parseAiAdminExternalIdBackfillOptions, prepareAiAdminEscalationBackfillRow, prepareAiAdminExternalIdBackfillRow, prepareAiAdminMessageBackfillRow, prepareAiAdminQueueBackfillRow } from './backfill-ai-admin-external-user-id.js';

const envNames = ['NODE_ENV', 'ENCRYPTION_KEY', 'AI_ADMIN_PHI_KEYRING_JSON', 'AI_ADMIN_PHI_ACTIVE_KEY_ID', 'AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON', 'AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID', 'AI_ADMIN_EXTERNAL_ID_STRICT_WRITE', 'AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED', 'AI_ADMIN_PHI_V2_WRITE_ENABLED', 'AI_ADMIN_PHI_V2_READERS_DEPLOYED', 'AI_ADMIN_QUEUE_PHI_ENCRYPTION_ENABLED', 'AI_ADMIN_QUEUE_LEGACY_WORKERS_DRAINED'];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-external-id-backfill-test-key-32-chars';
  for (const name of envNames.slice(2)) delete process.env[name];
  process.env.AI_ADMIN_PHI_V2_WRITE_ENABLED = 'true';
  process.env.AI_ADMIN_PHI_V2_READERS_DEPLOYED = 'I_HAVE_DEPLOYED_ALL_V2_READERS';
  process.env.AI_ADMIN_QUEUE_PHI_ENCRYPTION_ENABLED = 'true';
  process.env.AI_ADMIN_QUEUE_LEGACY_WORKERS_DRAINED = 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS';
});
afterEach(() => {
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
const rolloutAcknowledgements = {
  AI_ADMIN_PHI_V2_WRITE_ENABLED: 'true',
  AI_ADMIN_PHI_V2_READERS_DEPLOYED: 'I_HAVE_DEPLOYED_ALL_V2_READERS',
  AI_ADMIN_QUEUE_PHI_ENCRYPTION_ENABLED: 'true',
  AI_ADMIN_QUEUE_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS',
};
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
        ...rolloutAcknowledgements,
        AI_ADMIN_EXTERNAL_ID_STRICT_WRITE: 'true',
        AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS',
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
        ...rolloutAcknowledgements,
        AI_ADMIN_EXTERNAL_ID_STRICT_WRITE: 'true',
        AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS',
        DATABASE_URL: 'postgresql://production.example.test/dentvision',
        AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL: 'postgresql://staging.example.test/dentvision',
      },
    )).toThrow(/does not match the configured staging backfill database/);
  });
  it('requires a target-specific expected datasource URL before any write', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=staging', '--confirm-target=staging'],
      { AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'staging', ...rolloutAcknowledgements, AI_ADMIN_EXTERNAL_ID_STRICT_WRITE: 'true', AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS', DATABASE_URL: 'postgresql://staging.example.test/dentvision' },
    )).toThrow(/AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL/);
  });
  it('requires additional confirmation for production writes', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=production', '--confirm-target=production'],
      {
        AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'production',
        ...rolloutAcknowledgements,
        AI_ADMIN_EXTERNAL_ID_STRICT_WRITE: 'true',
        AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS',
      },
    )).toThrow(/--allow-production/);
    const productionUrl = 'postgresql://production.example.test/dentvision';
    expect(parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=production', '--confirm-target=production', '--allow-production', '--confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL'],
      {
        AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'production',
        ...rolloutAcknowledgements,
        AI_ADMIN_EXTERNAL_ID_STRICT_WRITE: 'true',
        AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS',
        DATABASE_URL: productionUrl,
        AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL: productionUrl,
      },
    )).toMatchObject({ apply: true, target: 'production' });
  });
  it('refuses backfill writes until strict mode is enabled and legacy workers are drained', () => {
    const stagingUrl = 'postgresql://staging.example.test/dentvision';
    const baseEnv = {
      AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET: 'staging',
      DATABASE_URL: stagingUrl,
      AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL: stagingUrl,
      AI_ADMIN_PHI_V2_WRITE_ENABLED: 'true',
      AI_ADMIN_PHI_V2_READERS_DEPLOYED: 'I_HAVE_DEPLOYED_ALL_V2_READERS',
      AI_ADMIN_QUEUE_PHI_ENCRYPTION_ENABLED: 'true',
      AI_ADMIN_QUEUE_LEGACY_WORKERS_DRAINED: 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS',
    };
    expect(() => parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=staging', '--confirm-target=staging'],
      baseEnv,
    )).toThrow(/AI_ADMIN_EXTERNAL_ID_STRICT_WRITE/);
    expect(() => parseAiAdminExternalIdBackfillOptions(
      ['--apply', '--target=staging', '--confirm-target=staging'],
      { ...baseEnv, AI_ADMIN_EXTERNAL_ID_STRICT_WRITE: 'true' },
    )).toThrow(/all legacy webhook workers are drained/);
  });
  it('rejects invalid batch sizes', () => {
    expect(() => parseAiAdminExternalIdBackfillOptions(['--batch-size=0'], {})).toThrow(/batch-size/);
    expect(() => parseAiAdminExternalIdBackfillOptions(['--batch-size=1001'], {})).toThrow(/batch-size/);
  });
  it('encrypts external IDs and patient metadata without exposing plaintext', () => {
    const prepared = prepareAiAdminExternalIdBackfillRow(row);
    expect(prepared.externalUserIdCiphertext).toMatch(/^ENC:v2:/);
    expect(prepared.externalUserIdHash).toMatch(/^v2:legacy:[a-f0-9]{64}$/);
    expect(prepared.patientNameCiphertext).toMatch(/^ENC:v2:/);
    expect(prepared.patientPhoneCiphertext).toMatch(/^ENC:v2:/);
    expect(prepared.patientNameCiphertext).not.toContain(row.patientName);
    expect(prepared.patientPhoneCiphertext).not.toContain(row.patientPhone);
  });
  it('rejects a ciphertext that disagrees with an explicitly empty legacy value', () => {

    expect(() => prepareAiAdminExternalIdBackfillRow({
      ...row,
      patientName: '',
      patientNameCiphertext: encryptAiAdminText('unexpected stored value'),
    })).toThrow(/ciphertext does not match the legacy value/);
  });

  it('handles legacy patient metadata when external ID is absent', () => {
    const prepared = prepareAiAdminExternalIdBackfillRow({ ...row, externalUserId: null });
    expect(prepared.externalUserIdHash).toBeNull();
    expect(prepared.patientNameCiphertext).toMatch(/^ENC:v2:/);
  });

  it('uses content and toolResult together as the message backfill compare-and-set guard', () => {
    const row = {
      id: 'message-compare-set',
      content: 'previous encrypted text',
      toolResult: { status: 'old result', patientName: 'Test Person' },
    };
    expect(buildAiAdminMessageBackfillWhere(row)).toEqual({
      id: row.id,
      content: row.content,
      toolResult: { equals: row.toolResult },
    });
    expect(buildAiAdminMessageBackfillWhere({ ...row, toolResult: null })).toEqual({
      id: row.id,
      content: row.content,
      toolResult: Prisma.DbNull,
    });
  });

  it('backfills historical AI Admin message content and PHI-bearing tool results', () => {
    const content = 'Patient Test Person asks about diagnosis alpha';
    const toolResult = { patientName: 'Test Person', patientPhone: '77010000000', diagnosis: 'private diagnosis' };
    const prepared = prepareAiAdminMessageBackfillRow({
      id: 'message-1',
      content,
      toolResult,
    });
    expect(prepared.content).toMatch(/^ENC:v2:/);
    expect(decryptAiAdminText(prepared.content)).toBe(content);
    expect(prepared.toolResult).toMatch(/^ENC:v2:/);
    expect(decryptAiAdminJson(prepared.toolResult)).toEqual(toolResult);
    expect(JSON.stringify(prepared)).not.toContain('Test Person');
    expect(JSON.stringify(prepared)).not.toContain('private diagnosis');
  });

  it('backfills historical AI Admin escalation messages', () => {
    const reason = 'patient requested a clinician call';
    const lastUserMessage = 'My name is Test Person and I have diagnosis alpha';
    const prepared = prepareAiAdminEscalationBackfillRow({
      id: 'escalation-1',
      reason,
      lastUserMessage: encryptAiAdminText(lastUserMessage),
    });
    expect(prepared.reason).toMatch(/^ENC:v2:/);
    expect(prepared.lastUserMessage).toMatch(/^ENC:v2:/);
    expect(decryptAiAdminText(prepared.reason)).toBe(reason);
    expect(decryptAiAdminText(prepared.lastUserMessage)).toBe(lastUserMessage);
    expect(JSON.stringify(prepared)).not.toContain('Test Person');
  });

  it('backfills retained queue payloads and errors, including completed rows', () => {
    const legacyPayload = {
      channel: 'WHATSAPP' as const,
      channelAccountId: 'account-1',
      externalUserId: '77010000000',
      text: 'Patient Queue Person reports diagnosis beta',
      externalMessageId: 'wamid-legacy-1',
      receivedAt: new Date('2026-11-08T08:00:00.000Z'),
    };
    const prepared = prepareAiAdminQueueBackfillRow({
      id: 'queue-row-1',
      payload: legacyPayload,
      error: 'Provider error includes Patient Queue Person',
    });
    expect(prepared.payload).toMatch(/^ENC:v2:/);
    expect(decodeQueuedAiAdminMessage(prepared.payload)).toEqual(legacyPayload);
    expect(prepared.error).toMatch(/^ENC:v2:/);
    expect(decryptAiAdminText(prepared.error)).toBe('Provider error includes Patient Queue Person');
    expect(JSON.stringify(prepared)).not.toContain('Queue Person');
    expect(JSON.stringify(prepared)).not.toContain('diagnosis beta');
  });

  it('keeps null queue errors null while encrypting retained payloads', () => {
    const prepared = prepareAiAdminQueueBackfillRow({
      id: 'queue-row-2',
      payload: {
        channel: 'INSTAGRAM',
        channelAccountId: 'account-2',
        externalUserId: 'ig-user-1',
        text: 'private queue message',
        externalMessageId: 'ig-message-1',
        receivedAt: '2026-11-08T08:00:00.000Z',
      },
      error: null,
    });
    expect(prepared.payload).toMatch(/^ENC:v2:/);
    expect(prepared.error).toBeNull();
  });

  it('rejects mismatched existing blind indexes', () => {
    expect(() => prepareAiAdminExternalIdBackfillRow({ ...row, externalUserIdHash: 'v1:wrong' })).toThrow(/does not match/);
  });
  it('re-encrypts and reindexes existing encrypted rows after key rotation', () => {
    const previous = prepareAiAdminExternalIdBackfillRow(row);
    const oldSecret = process.env.ENCRYPTION_KEY!;
    process.env.AI_ADMIN_PHI_KEYRING_JSON = JSON.stringify({
      legacy: oldSecret,
      current: 'rotated-ai-admin-phi-key-with-32-chars',
    });
    process.env.AI_ADMIN_PHI_ACTIVE_KEY_ID = 'current';
    process.env.AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON = JSON.stringify({
      legacy: oldSecret,
      current: 'rotated-ai-admin-index-key-with-32-chars',
    });
    process.env.AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID = 'current';
    const rotated = prepareAiAdminExternalIdBackfillRow({
      ...row,
      externalUserId: null,
      patientName: null,
      patientPhone: null,
      externalUserIdCiphertext: previous.externalUserIdCiphertext,
      externalUserIdHash: previous.externalUserIdHash,
      patientNameCiphertext: previous.patientNameCiphertext,
      patientPhoneCiphertext: previous.patientPhoneCiphertext,
    });
    expect(rotated.externalUserIdCiphertext).toMatch(/^ENC:v2:current:/);
    expect(rotated.externalUserIdHash).toMatch(/^v2:current:/);
    expect(decryptAiAdminText(rotated.externalUserIdCiphertext)).toBe(row.externalUserId);
    expect(decryptAiAdminText(rotated.patientNameCiphertext)).toBe(row.patientName);
    expect(decryptAiAdminText(rotated.patientPhoneCiphertext)).toBe(row.patientPhone);
  });

  it('rejects ciphertext that decrypts to a different identity', () => {
    const other = prepareAiAdminExternalIdBackfillRow({ ...row, externalUserId: '77010000001' });
    expect(() => prepareAiAdminExternalIdBackfillRow({ ...row, externalUserIdCiphertext: other.externalUserIdCiphertext })).toThrow(/does not match the legacy value/);
  });
});
