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
import { encrypt as rawEncrypt, decrypt as rawDecrypt } from './fieldEncryption.js';

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
