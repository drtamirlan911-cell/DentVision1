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
