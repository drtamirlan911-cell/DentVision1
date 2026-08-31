/**
 * PHI field encryption helpers.
 *
 * Encrypts the most sensitive patient fields (IIN, medical history) at the
 * application layer.  Phone/email are left searchable — encrypt those with
 * a deterministic scheme when tokenization/hashing is added.
 *
 * In dev (no ENCRYPTION_KEY) the functions pass through plaintext so nothing
 * breaks locally.
 */
import crypto from 'crypto';

import { encrypt as rawEncrypt, decrypt as rawDecrypt } from './fieldEncryption.js';
import { normalizeIin } from './iin.js';

let encryptionAvailable: boolean | null = null;

function canEncrypt(): boolean {
  if (encryptionAvailable !== null) return encryptionAvailable;
  try {
    const test = rawEncrypt('phi-test');
    const back = rawDecrypt(test);
    encryptionAvailable = back === 'phi-test';
  } catch {
    encryptionAvailable = false;
  }
  return encryptionAvailable;
}

const MARKER = 'ENC:';

export function encryptField(plain: string | null): string | null {
  if (plain == null) return null;
  if (!canEncrypt()) return plain;
  const cipher = rawEncrypt(plain);
  return `${MARKER}${cipher}`;
}

export function decryptField(value: string | null): string | null {
  if (value == null) return null;
  // Backward-compat: plaintext data saved before encryption was enabled.
  if (!value.startsWith(MARKER)) return value;
  if (!canEncrypt()) return value;
  try {
    return rawDecrypt(value.slice(MARKER.length));
  } catch {
    // Corrupted or key-rotated — return the raw value so the app doesn't crash.
    return value;
  }
}

/**
 * Deterministic blind index for IIN lookups.
 *
 * `iin` is stored via `encryptField`, which uses a random IV per call — two
 * encryptions of the identical IIN produce different ciphertext, so nothing
 * can ever `WHERE iin = $1` across rows. This HMAC is what makes "does this
 * person already have records at another clinic" a queryable equality
 * lookup: same normalized input always produces the same hash, but the hash
 * alone doesn't reveal the IIN (unlike storing it in plaintext for search).
 *
 * The pepper reuses ENCRYPTION_KEY rather than requiring a second secret —
 * derived with a fixed, distinct salt so it is not the same key material as
 * field encryption itself. Same production-required guard as fieldEncryption.ts.
 */
function iinHashPepper(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[phi] ENCRYPTION_KEY must be set in production (min 32 chars)');
    }
    return crypto.scryptSync('dev-only-key-not-for-production', 'iin-hash-pepper', 32);
  }
  return crypto.scryptSync(raw, 'iin-hash-pepper', 32);
}

/**
 * `normalizeIin` rather than a bare `trim()`: the search path now hashes a
 * string a human just typed, and "123 456 789 012" must land on the same row
 * as "123456789012". Every existing caller already passed a normalized value
 * (`assertValidPatientIin` normalizes before hashing, `cross-clinic.service`
 * hashes a stored one), so no hash that exists today changes.
 */
export function hmacIin(iin: string | null | undefined): string | null {
  const normalized = normalizeIin(iin);
  if (!normalized) return null;
  return crypto.createHmac('sha256', iinHashPepper()).update(normalized).digest('hex');
}

/** Encrypt sensitive patient fields in place (mutates the data object). */
export function encryptPatientFields<T extends Record<string, unknown>>(
  data: T,
): T {
  if (!canEncrypt()) return data;
  if (typeof data.iin === 'string') (data as Record<string, unknown>).iin = encryptField(data.iin as string);
  if (typeof data.medicalHistory === 'string') (data as Record<string, unknown>).medicalHistory = encryptField(data.medicalHistory as string);
  return data;
}

/** Decrypt sensitive patient fields in place (mutates the result object). */
export function decryptPatientFields<T extends Record<string, unknown> | null>(
  data: T,
): T {
  if (!data || !canEncrypt()) return data;
  if (typeof (data as Record<string, unknown>).iin === 'string') {
    (data as Record<string, unknown>).iin = decryptField((data as Record<string, unknown>).iin as string);
  }
  if (typeof (data as Record<string, unknown>).medicalHistory === 'string') {
    (data as Record<string, unknown>).medicalHistory = decryptField((data as Record<string, unknown>).medicalHistory as string);
  }
  return data;
}
