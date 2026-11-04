import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

describe('durable AI event payload encryption', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'ai-event-payload-test-key-that-is-long-enough-123456';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  it('encrypts patient-linked payloads and round-trips them for the worker', async () => {
    const { encodeDurableEventPayload, decodeDurableEventPayload } = await import('./eventPayloadEncryption.js');
    const payload = { patientName: 'Иван Петров', diagnosis: 'private diagnosis alpha', patientId: 'patient-a' };
    const stored = encodeDurableEventPayload(payload);
    expect(stored).toMatch(/^ENC:/);
    expect(stored).not.toContain('Иван Петров');
    expect(stored).not.toContain('private diagnosis alpha');
    expect(decodeDurableEventPayload(stored)).toEqual(payload);
  });

  it('keeps legacy plaintext JSON object rows readable', async () => {
    const { decodeDurableEventPayload } = await import('./eventPayloadEncryption.js');
    const legacy = { patientName: 'Legacy Patient', studyType: 'CBCT' };
    expect(decodeDurableEventPayload(legacy)).toEqual(legacy);
  });

  it('fails closed on tampered ciphertext and invalid JSON roots', async () => {
    const { decodeDurableEventPayload } = await import('./eventPayloadEncryption.js');
    expect(() => decodeDurableEventPayload('ENC:not-valid-ciphertext')).toThrow();
    expect(() => decodeDurableEventPayload('"scalar-root"')).toThrow(/root must be an object/);
    expect(() => decodeDurableEventPayload('[]')).toThrow(/root must be an object/);
  });

  it('does not decrypt ciphertext in production without the configured key', async () => {
    const { encodeDurableEventPayload, decodeDurableEventPayload } = await import('./eventPayloadEncryption.js');
    const stored = encodeDurableEventPayload({ clinical: 'private' });
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    expect(() => decodeDurableEventPayload(stored)).toThrow(/Decryption unavailable in production/);
  });
});
