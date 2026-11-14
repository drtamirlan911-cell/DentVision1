import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptField } from '../../../lib/phi.js';
import {
  decodeQueuedAiAdminMessage,
  decryptAiAdminJson,
  decryptAiAdminText,
  encryptAiAdminJson,
  encryptAiAdminText,
  hashAiAdminExternalUserId,
  getAiAdminExternalUserIdHashes,
  isAiAdminTextEncryptedWithActiveKey,
} from './phi.js';

const envNames = ['NODE_ENV', 'ENCRYPTION_KEY', 'AI_ADMIN_PHI_KEYRING_JSON', 'AI_ADMIN_PHI_ACTIVE_KEY_ID', 'AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON', 'AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID'];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-test-encryption-key-at-least-32-chars';
  for (const name of envNames.slice(2)) delete process.env[name];
});

afterEach(() => {
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('AI Admin external identity blind index', () => {
  it('is deterministic and scoped to clinic and channel', () => {
    const identity = { clinicId: 'clinic-a', channel: 'WHATSAPP', externalUserId: '77010000000' };
    const hash = hashAiAdminExternalUserId(identity);
    expect(hash).toMatch(/^v2:legacy:[a-f0-9]{64}$/);
    expect(hashAiAdminExternalUserId({ ...identity, externalUserId: ' 77010000000 ' })).toBe(hash);
    expect(hashAiAdminExternalUserId({ ...identity, clinicId: 'clinic-b' })).not.toBe(hash);
    expect(hashAiAdminExternalUserId({ ...identity, channel: 'INSTAGRAM' })).not.toBe(hash);
  });
  it('fails closed in production without the index key', () => {
    const previous = process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => hashAiAdminExternalUserId({ clinicId: 'clinic-a', channel: 'WHATSAPP', externalUserId: '77010000000' })).toThrow(/keyring or ENCRYPTION_KEY is required/);
    } finally {
      if (previous === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = previous;
      process.env.NODE_ENV = 'test';
    }
  });
});

describe('AI Admin at-rest encryption', () => {
  it('retains old blind-index versions while writing with the active key', () => {
    const identity = { clinicId: 'clinic-a', channel: 'WHATSAPP', externalUserId: '77010000000' };
    const oldHash = getAiAdminExternalUserIdHashes(identity).find((value) => value.startsWith('v1:'));
    process.env.AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON = JSON.stringify({
      legacy: process.env.ENCRYPTION_KEY,
      current: 'new-ai-admin-index-key-with-at-least-32-chars',
    });
    process.env.AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID = 'current';
    expect(getAiAdminExternalUserIdHashes(identity)).toContain(oldHash);
    expect(hashAiAdminExternalUserId(identity)).toMatch(/^v2:current:/);
  });

  it('preserves the exact historic development fallback for legacy ciphertext and blind indexes', () => {
    const previous = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    const identity = { clinicId: 'clinic-dev', channel: 'WHATSAPP', externalUserId: '77010000000' };
    try {
      const legacyCiphertext = encryptField('old development payload');
      expect(decryptAiAdminText(legacyCiphertext)).toBe('old development payload');
      const oldMaster = 'dev-only-ai-admin-index-key-not-for-production';
      const oldIndexKey = createHmac('sha256', oldMaster)
        .update('dentvision:ai-admin:external-user-id:index-key:v1')
        .digest();
      const oldHash = 'v1:' + createHmac('sha256', oldIndexKey)
        .update(JSON.stringify([identity.channel, identity.clinicId, identity.externalUserId]))
        .digest('hex');
      expect(getAiAdminExternalUserIdHashes(identity)).toContain(oldHash);
    } finally {
      if (previous === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = previous;
    }
  });

  it('reads old unversioned ciphertext and supports active-key rotation', () => {
    const oldSecret = process.env.ENCRYPTION_KEY!;
    const legacy = encryptField('legacy encrypted message');
    expect(decryptAiAdminText(legacy)).toBe('legacy encrypted message');
    const oldVersion = encryptAiAdminText('old version');
    process.env.AI_ADMIN_PHI_KEYRING_JSON = JSON.stringify({
      legacy: oldSecret,
      current: 'new-ai-admin-phi-key-with-at-least-32-chars',
    });
    process.env.AI_ADMIN_PHI_ACTIVE_KEY_ID = 'current';
    expect(decryptAiAdminText(oldVersion)).toBe('old version');
    const current = encryptAiAdminText('current version');
    expect(current).toMatch(/^ENC:v2:current:/);
    expect(isAiAdminTextEncryptedWithActiveKey(current)).toBe(true);
    expect(isAiAdminTextEncryptedWithActiveKey(oldVersion)).toBe(false);
  });

  it('encrypts patient messages and round-trips them', () => {
    const source = 'Patient Ivan Petrov: private diagnosis alpha';
    const stored = encryptAiAdminText(source);
    expect(stored).toMatch(/^ENC:v2:legacy:/);
    expect(stored).not.toContain('Ivan Petrov');
    expect(stored).not.toContain('private diagnosis alpha');
    expect(decryptAiAdminText(stored)).toBe(source);
  });

  it('encrypts JSONB values as a ciphertext scalar and preserves the object shape on read', () => {
    const source = { patientName: 'Ivan Petrov', diagnosis: 'private diagnosis beta', tooth: '36' };
    const stored = encryptAiAdminJson(source);
    expect(stored).toMatch(/^ENC:v2:/);
    expect(stored).not.toContain('Ivan Petrov');
    expect(decryptAiAdminJson(stored)).toEqual(source);
  });

  it('keeps legacy plaintext text and JSONB object rows readable', () => {
    expect(decryptAiAdminText('Legacy patient message')).toBe('Legacy patient message');
    expect(decryptAiAdminJson({ legacy: true, patientName: 'Legacy Patient' })).toEqual({
      legacy: true,
      patientName: 'Legacy Patient',
    });
  });

  it('fails closed when a ciphertext is read with a different key', () => {
    const stored = encryptAiAdminText('private');
    process.env.ENCRYPTION_KEY = 'a-different-ai-admin-encryption-key-32-chars';
    expect(() => decryptAiAdminText(stored)).toThrow(/ciphertext authentication failed/);
  });

  it('decrypts queue rows and restores receivedAt as a Date', () => {
    const message = {
      channel: 'WHATSAPP' as const,
      channelAccountId: 'account-1',
      externalUserId: 'user-1',
      text: 'patient message',
      externalMessageId: 'message-1',
      receivedAt: new Date('2026-11-08T08:00:00.000Z'),
    };
    const stored = encryptAiAdminJson(message);
    const decoded = decodeQueuedAiAdminMessage(stored);
    expect(decoded).toEqual(message);
    expect(decoded.receivedAt).toBeInstanceOf(Date);
  });

  it('rejects incomplete or invalid queue payloads', () => {
    expect(() => decodeQueuedAiAdminMessage({ text: 'missing fields' })).toThrow(/incomplete/);
    expect(() => decodeQueuedAiAdminMessage({ channel: 'WHATSAPP', channelAccountId: 'a', externalUserId: 'u', text: 'x', externalMessageId: 'm', receivedAt: 'not-a-date' })).toThrow(/invalid timestamp/);
  });
});
