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
let encryptionAvailabilityKey: string | null = null;

function canEncrypt(): boolean {
  const keyIdentity = process.env.ENCRYPTION_KEY || '__development_fallback__';
  if (encryptionAvailabilityKey !== keyIdentity) {
    encryptionAvailabilityKey = keyIdentity;
    encryptionAvailable = null;
  }
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
  if (!canEncrypt()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[phi] Encryption unavailable in production');
    }
    return plain;
  }
  const cipher = rawEncrypt(plain);
  return `${MARKER}${cipher}`;
}

export function decryptField(value: string | null): string | null {
  if (value == null) return null;
  // Backward-compat: plaintext data saved before encryption was enabled.
  if (!value.startsWith(MARKER)) return value;
  if (!canEncrypt()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[phi] Decryption unavailable in production');
    }
    return value;
  }
  try {
    return rawDecrypt(value.slice(MARKER.length));
  } catch {
    // Never treat an encrypted payload as valid plaintext when integrity
    // verification fails or the configured key cannot decrypt the value.
    throw new Error('[phi] Unable to decrypt encrypted field');
  }
}

const MEDICAL_HISTORY_ENVELOPE = '__dentvisionEncryptedV1' as const;
type EncryptedMedicalHistoryEnvelope = { __dentvisionEncryptedV1: string };

/**
 * Reject root-level ciphertext/envelope values at untrusted HTTP write boundaries.
 * The codec remains idempotent for trusted internal round-trips, so routes must
 * not let clients replay a ciphertext envelope or poison a Patient JSONB row.
 */
export function isClientSuppliedEncryptedMedicalHistory(value: unknown): boolean {
  if (typeof value === 'string' && value.startsWith(MARKER)) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.prototype.hasOwnProperty.call(value, MEDICAL_HISTORY_ENVELOPE);
}

function hasMedicalHistoryEnvelopeMarker(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, MEDICAL_HISTORY_ENVELOPE),
  );
}

function isEncryptedMedicalHistoryEnvelope(value: unknown): value is EncryptedMedicalHistoryEnvelope {
  if (!hasMedicalHistoryEnvelopeMarker(value)) return false;
  const candidate = value[MEDICAL_HISTORY_ENVELOPE];
  return typeof candidate === 'string' && candidate.startsWith(MARKER);
}

/**
 * Encrypt the complete JSON value stored in Patient.medicalHistory without
 * changing the PostgreSQL JSON column or the API's decoded object shape.
 * Legacy plaintext JSON is read-compatible; already-encrypted values are idempotent.
 */
export function encryptMedicalHistory(value: unknown): unknown {
  if (value == null) return value;
  if (hasMedicalHistoryEnvelopeMarker(value)) {
    if (isEncryptedMedicalHistoryEnvelope(value)) return value;
    throw new Error('[phi] Invalid medical-history encryption envelope');
  }
  // Older patient-portal writes store a scalar ENC: value in this JSON column.
  if (typeof value === 'string' && value.startsWith(MARKER)) return value;
  if (!canEncrypt()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[phi] Medical-history encryption unavailable in production');
    }
    return value;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('[phi] Medical history must be JSON serializable');
  const encrypted = encryptField(serialized);
  if (!encrypted || !encrypted.startsWith(MARKER)) {
    throw new Error('[phi] Medical-history encryption did not produce ciphertext');
  }
  return { [MEDICAL_HISTORY_ENVELOPE]: encrypted } satisfies EncryptedMedicalHistoryEnvelope;
}

/** Decode current envelopes and legacy scalar ciphertext; leave old plaintext JSON untouched. */
export function decryptMedicalHistory(value: unknown): unknown {
  if (value == null) return value;
  const hasEnvelope = hasMedicalHistoryEnvelopeMarker(value);
  const isEnvelope = isEncryptedMedicalHistoryEnvelope(value);
  if (hasEnvelope && !isEnvelope) {
    throw new Error('[phi] Invalid medical-history encryption envelope');
  }
  const ciphertext = isEnvelope
    ? value[MEDICAL_HISTORY_ENVELOPE]
    : typeof value === 'string' && value.startsWith(MARKER) ? value : null;
  if (!ciphertext) return value;
  const decrypted = decryptField(ciphertext);
  // decryptField deliberately passes through ciphertext in non-production when the
  // key is absent; never expose that token as patient history or overwrite it.
  if (decrypted === ciphertext || decrypted?.startsWith(MARKER)) {
    throw new Error('[phi] Medical-history decryption unavailable without the matching ENCRYPTION_KEY');
  }
  if (isEnvelope) {
    try {
      return JSON.parse(decrypted as string) as unknown;
    } catch {
      throw new Error('[phi] Encrypted medical history is not valid JSON');
    }
  }
  // Backward compatibility: the patient portal historically encrypted plain text,
  // not JSON.stringify(text). Parse JSON when it was stored that way; otherwise keep text.
  try { return JSON.parse(decrypted as string) as unknown; } catch { return decrypted; }
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
  if (!canEncrypt()) {
    if (process.env.NODE_ENV === 'production') throw new Error('[phi] Patient-field encryption unavailable in production');
    return data;
  }
  if (typeof data.iin === 'string') (data as Record<string, unknown>).iin = encryptField(data.iin as string);
  if (data.medicalHistory != null) (data as Record<string, unknown>).medicalHistory = encryptMedicalHistory(data.medicalHistory);
  return data;
}

/** Decrypt sensitive patient fields in place (mutates the result object). */
export function decryptPatientFields<T extends Record<string, unknown> | null>(
  data: T,
): T {
  if (!data) return data;
  if (!canEncrypt()) {
    if (process.env.NODE_ENV === 'production') throw new Error('[phi] Patient-field decryption unavailable in production');
    const history = (data as Record<string, unknown>).medicalHistory;
    if (hasMedicalHistoryEnvelopeMarker(history) || (typeof history === 'string' && history.startsWith(MARKER))) {
      // The codec distinguishes malformed reserved envelopes from valid
      // ciphertext and fails closed when the matching key is unavailable.
      decryptMedicalHistory(history);
      throw new Error('[phi] Medical-history decryption unavailable without the matching ENCRYPTION_KEY');
    }
    return data;
  }
  if (typeof (data as Record<string, unknown>).iin === 'string') {
    (data as Record<string, unknown>).iin = decryptField((data as Record<string, unknown>).iin as string);
  }
  if ((data as Record<string, unknown>).medicalHistory != null) {
    (data as Record<string, unknown>).medicalHistory = decryptMedicalHistory((data as Record<string, unknown>).medicalHistory);
  }
  return data;
}
