import { afterEach, describe, expect, it, vi } from 'vitest';

const TEST_KEY = 'test-encryption-key-that-is-long-enough-123';

describe('field encryption', () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.ENCRYPTION_KEY;
    delete process.env.NODE_ENV;
  });

  it('round-trips encrypted values without changing the persisted format', async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const { encrypt, decrypt } = await import('./fieldEncryption.js');
    const encrypted = encrypt('patient-sensitive-value');
    expect(encrypted).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(decrypt(encrypted)).toBe('patient-sensitive-value');
  });

  it('decrypts ciphertext produced by the existing scrypt salt and AES-GCM format', async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const { decrypt } = await import('./fieldEncryption.js');
    const legacyCiphertext = '000102030405060708090a0b0c0d0e0f:3e596e8761df19feca547bad0c2de411:04c65131cdb2eda8442c863071eaf52aa8f873c0';
    expect(decrypt(legacyCiphertext)).toBe('legacy patient value');
  });

  it('fails closed in production when the encryption key is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    const { encrypt } = await import('./fieldEncryption.js');
    expect(() => encrypt('patient-sensitive-value')).toThrow(/ENCRYPTION_KEY/);
  });

  it('reuses the cached derived key while preserving decryption compatibility', async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const { encrypt, decrypt } = await import('./fieldEncryption.js');
    const one = encrypt('same value');
    const two = encrypt('same value');
    expect(one).not.toBe(two);
    expect(decrypt(one)).toBe('same value');
    expect(decrypt(two)).toBe('same value');
  });
});
