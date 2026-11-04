import { decryptField, encryptField } from '../../lib/phi.js';

/**
 * AI Event OS payloads may contain patient-linked or clinical fields. Keep the
 * JSONB column shape unchanged, but encrypt every new durable payload at rest.
 * Legacy plaintext object rows remain readable until the separately approved
 * staging backfill and retention plan is executed.
 */
export function encodeDurableEventPayload(payload: Record<string, unknown>): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new Error('[EventPayload] Payload is not JSON serializable');
  }
  if (serialized === undefined) throw new Error('[EventPayload] Payload is not JSON serializable');

  const encrypted = encryptField(serialized);
  if (!encrypted || !encrypted.startsWith('ENC:')) {
    throw new Error('[EventPayload] Encryption did not produce ciphertext');
  }
  return encrypted;
}

/**
 * Decode new ciphertext and legacy plaintext JSON objects. Malformed ciphertext,
 * a wrong key, or a non-object payload fails closed; ciphertext is never exposed
 * as if it were an event payload.
 */
export function decodeDurableEventPayload(value: unknown): Record<string, unknown> {
  if (value == null) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    throw new Error('[EventPayload] Stored payload must be an object or encrypted JSON string');
  }

  const serialized = value.startsWith('ENC:') ? decryptField(value) : value;
  if (serialized == null || serialized.startsWith('ENC:')) {
    throw new Error('[EventPayload] Decryption unavailable');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('[EventPayload] Stored payload is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('[EventPayload] Stored payload root must be an object');
  }
  return parsed as Record<string, unknown>;
}
