import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decodeQueuedAiAdminMessage,
  decryptAiAdminJson,
  decryptAiAdminText,
  encryptAiAdminJson,
  encryptAiAdminText,
  hashAiAdminExternalUserId,
} from './phi.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-test-encryption-key-at-least-32-chars';
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalEncryptionKey;
});

describe('AI Admin external identity blind index', () => {
  it('is deterministic and scoped to clinic and channel', () => {
    const identity = { clinicId: 'clinic-a', channel: 'WHATSAPP', externalUserId: '77010000000' };
    const hash = hashAiAdminExternalUserId(identity);
    expect(hash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(hashAiAdminExternalUserId({ ...identity, externalUserId: ' 77010000000 ' })).toBe(hash);
    expect(hashAiAdminExternalUserId({ ...identity, clinicId: 'clinic-b' })).not.toBe(hash);
    expect(hashAiAdminExternalUserId({ ...identity, channel: 'INSTAGRAM' })).not.toBe(hash);
  });
  it('fails closed in production without the index key', () => {
    const previous = process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => hashAiAdminExternalUserId({ clinicId: 'clinic-a', channel: 'WHATSAPP', externalUserId: '77010000000' })).toThrow(/ENCRYPTION_KEY is required/);
    } finally {
      if (previous === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = previous;
      process.env.NODE_ENV = 'test';
    }
  });
});

describe('AI Admin at-rest encryption', () => {
  it('encrypts patient messages and round-trips them', () => {
    const source = 'Patient Ivan Petrov: private diagnosis alpha';
    const stored = encryptAiAdminText(source);
    expect(stored).toMatch(/^ENC:/);
    expect(stored).not.toContain('Ivan Petrov');
    expect(stored).not.toContain('private diagnosis alpha');
    expect(decryptAiAdminText(stored)).toBe(source);
  });

  it('encrypts JSONB values as a ciphertext scalar and preserves the object shape on read', () => {
    const source = { patientName: 'Ivan Petrov', diagnosis: 'private diagnosis beta', tooth: '36' };
    const stored = encryptAiAdminJson(source);
    expect(stored).toMatch(/^ENC:/);
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
    expect(() => decryptAiAdminText(stored)).toThrow(/Unable to decrypt encrypted field/);
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
