import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('hmacIin', () => {
  const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(32);
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('is deterministic — same IIN always hashes to the same value', async () => {
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin('123456789012')).toBe(hmacIin('123456789012'));
  });

  it('produces different hashes for different IINs', async () => {
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin('123456789012')).not.toBe(hmacIin('123456789013'));
  });

  it('normalizes whitespace before hashing', async () => {
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin('123456789012')).toBe(hmacIin('  123456789012  '));
  });

  it('returns null for empty/missing input', async () => {
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin(null)).toBeNull();
    expect(hmacIin(undefined)).toBeNull();
    expect(hmacIin('')).toBeNull();
    expect(hmacIin('   ')).toBeNull();
  });

  it('never leaks the plaintext IIN in the hash', async () => {
    const { hmacIin } = await import('./phi.js');
    const hash = hmacIin('123456789012')!;
    expect(hash).not.toContain('123456789012');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('throws in production without ENCRYPTION_KEY', async () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    const { hmacIin } = await import('./phi.js');
    expect(() => hmacIin('123456789012')).toThrow(/ENCRYPTION_KEY must be set/);
  });

  it('falls back to a dev key outside production without ENCRYPTION_KEY', async () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'development';
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin('123456789012')).toMatch(/^[0-9a-f]{64}$/);
  });
});

/**
 * The blind index is what makes an IIN searchable at all: `iin` is encrypted
 * with a random IV, so equality lives entirely in this hash. That makes
 * normalization part of the contract, not a nicety — the search path now
 * hashes a string a receptionist just typed, and a stray space would send it
 * to a different bucket than the stored row.
 */
describe('hmacIin — normalization', () => {
  it('ignores spaces, dashes and surrounding whitespace', async () => {
    const { hmacIin } = await import('./phi.js');
    const hash = hmacIin('900101350125');

    expect(hmacIin('  900101 350 125 ')).toBe(hash);
    expect(hmacIin('900101-350-125')).toBe(hash);
  });

  it.each([[null], [undefined], [''], ['   ']])('returns null for %s', async (value) => {
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin(value as never)).toBeNull();
  });

  it('never returns the number itself', async () => {
    const { hmacIin } = await import('./phi.js');
    expect(hmacIin('900101350125')).not.toContain('900101350125');
  });
});

describe('encryptField production safety', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('fails closed instead of storing plaintext when production encryption is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    const { encryptField } = await import('./phi.js');
    expect(() => encryptField('sensitive medical data')).toThrow(/Encryption unavailable in production/);
  });
});


describe('patient field batch encryption production safety', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('throws instead of returning unencrypted patient fields in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    const { encryptPatientFields } = await import('./phi.js');
    const patient = { iin: '900101350125', medicalHistory: 'sensitive history' };
    expect(() => encryptPatientFields(patient)).toThrow(/encryption unavailable in production/i);
  });
});


describe('decryptField integrity and availability', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('round-trips encrypted fields while keeping ciphertext marked', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'phi-test-key-that-is-long-enough-123456';
    const { encryptField, decryptField } = await import('./phi.js');
    const encrypted = encryptField('private clinical value');
    expect(encrypted).toMatch(/^ENC:/);
    expect(encrypted).not.toContain('private clinical value');
    expect(decryptField(encrypted)).toBe('private clinical value');
  });

  it('fails closed on tampered or malformed encrypted data', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'phi-test-key-that-is-long-enough-123456';
    const { decryptField } = await import('./phi.js');
    expect(() => decryptField('ENC:not-valid-ciphertext')).toThrow(/Unable to decrypt encrypted field/);
  });

  it('fails closed in production when ciphertext exists but the encryption key is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = 'phi-test-key-that-is-long-enough-123456';
    const { encryptField, decryptField } = await import('./phi.js');
    const encrypted = encryptField('private clinical value');
    delete process.env.ENCRYPTION_KEY;
    expect(() => decryptField(encrypted)).toThrow(/Decryption unavailable in production/);
  });
});


describe('structured medical history encryption', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'phi-test-key-that-is-long-enough-123456';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('stores structured clinical history as ciphertext and round-trips the original JSON', async () => {
    const { encryptMedicalHistory, decryptMedicalHistory } = await import('./phi.js');
    const original = { complaints: 'sensitive complaint', allergies: ['penicillin'], teeth: { '16': { status: 'caries' } } };
    const stored = encryptMedicalHistory(original) as Record<string, unknown>;
    expect(stored.__dentvisionEncryptedV1).toMatch(/^ENC:/);
    expect(JSON.stringify(stored)).not.toContain('sensitive complaint');
    expect(JSON.stringify(stored)).not.toContain('penicillin');
    expect(decryptMedicalHistory(stored)).toEqual(original);
    expect(encryptMedicalHistory(stored)).toEqual(stored);
  });

  it('rejects root-level client-supplied ciphertext/envelopes but permits nested clinical data', async () => {
    const { isClientSuppliedEncryptedMedicalHistory } = await import('./phi.js');
    expect(isClientSuppliedEncryptedMedicalHistory('ENC:untrusted')).toBe(true);
    expect(isClientSuppliedEncryptedMedicalHistory({ __dentvisionEncryptedV1: 'ENC:untrusted' })).toBe(true);
    expect(isClientSuppliedEncryptedMedicalHistory({ complaints: 'pain', detail: { __dentvisionEncryptedV1: 'ENC:data' } })).toBe(false);
    expect(isClientSuppliedEncryptedMedicalHistory({ complaints: 'pain' })).toBe(false);
  });

  it('fails closed on malformed reserved medical-history envelopes', async () => {
    const { encryptMedicalHistory, decryptMedicalHistory } = await import('./phi.js');
    const malformed = { __dentvisionEncryptedV1: 'not-ciphertext' };
    expect(() => decryptMedicalHistory(malformed)).toThrow(/Invalid medical-history encryption envelope/);
    expect(() => encryptMedicalHistory(malformed)).toThrow(/Invalid medical-history encryption envelope/);
    expect(() => decryptMedicalHistory({ __dentvisionEncryptedV1: 123 })).toThrow(/Invalid medical-history encryption envelope/);
  });

  it('fails closed on malformed reserved envelopes when the key is unavailable', async () => {
    const { decryptPatientFields } = await import('./phi.js');
    delete process.env.ENCRYPTION_KEY;
    expect(() => decryptPatientFields({
      medicalHistory: { __dentvisionEncryptedV1: 'not-ciphertext' },
    })).toThrow(/Invalid medical-history encryption envelope/);
  });

  it('leaves legacy plaintext JSON readable until the resumable backfill is run', async () => {
    const { decryptMedicalHistory } = await import('./phi.js');
    const original = { allergies: 'legacy allergy', teeth: { '11': { status: 'healthy' } } };
    expect(decryptMedicalHistory(original)).toEqual(original);
  });

  it('reads legacy scalar ENC values written by the patient portal', async () => {
    const { encryptField, decryptMedicalHistory } = await import('./phi.js');
    const stored = encryptField('patient-entered clinical note');
    expect(decryptMedicalHistory(stored)).toBe('patient-entered clinical note');
  });

  it('fails closed when an encrypted history cannot be decrypted with the configured key', async () => {
    const { encryptMedicalHistory, decryptMedicalHistory } = await import('./phi.js');
    const stored = encryptMedicalHistory({ complaints: 'private' });
    process.env.ENCRYPTION_KEY = 'different-key-that-is-also-long-enough-1234';
    expect(() => decryptMedicalHistory(stored)).toThrow(/Unable to decrypt encrypted field|decryption unavailable/i);
  });

  it('does not store clinical history as plaintext in production when the key is missing', async () => {
    const { encryptMedicalHistory } = await import('./phi.js');
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptMedicalHistory({ complaints: 'private' })).toThrow(/encryption unavailable in production/i);
  });
});
