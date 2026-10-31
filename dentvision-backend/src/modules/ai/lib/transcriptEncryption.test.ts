import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptAiTranscriptText, encryptAiTranscriptText } from './transcriptEncryption.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'dentvision-transcript-test-key-2026-10-31';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ENCRYPTION_KEY = originalKey;
});

describe('AI transcript encryption', () => {
  it('encrypts message content and round-trips it without plaintext leakage', () => {
    const plaintext = 'Пациент сообщает о боли и аллергии на препарат.';
    const stored = encryptAiTranscriptText(plaintext);

    expect(stored).toMatch(/^ENC:/);
    expect(stored).not.toContain('боли');
    expect(decryptAiTranscriptText(stored)).toBe(plaintext);
  });

  it('keeps valid ciphertext idempotent across transcript mirrors', () => {
    const stored = encryptAiTranscriptText('private conversation');
    expect(encryptAiTranscriptText(stored)).toBe(stored);
  });

  it('keeps historical plaintext readable during rollout', () => {
    expect(decryptAiTranscriptText('legacy assistant reply')).toBe('legacy assistant reply');
  });

  it('fails closed for a malformed encrypted marker', () => {
    expect(() => encryptAiTranscriptText('ENC:not-a-valid-ciphertext')).toThrow(/Unable to decrypt encrypted field/);
    expect(() => decryptAiTranscriptText('ENC:not-a-valid-ciphertext')).toThrow(/Unable to decrypt encrypted field/);
  });

  it('fails closed in production when encryption is unavailable', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptAiTranscriptText('clinical transcript')).toThrow(/Encryption unavailable in production/);
  });
});
