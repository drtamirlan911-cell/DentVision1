/**
 * Application-layer encryption for persisted AI transcripts.
 *
 * AI prompts/replies may repeat patient complaints, history and other PHI.
 * New writes use the same fail-closed field cipher as other protected data;
 * legacy plaintext remains readable during the separately approved backfill.
 */
import { decryptField, encryptField } from '../../../lib/phi.js';

const ENCRYPTED_PREFIX = 'ENC:';

function encryptPlainTranscriptValue(value: string): string {
  const encrypted = encryptField(value);
  if (!encrypted || !encrypted.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('[phi] AI transcript encryption did not produce ciphertext');
  }
  return encrypted;
}

/** Always treats input as plaintext, including a literal client string beginning with ENC:. */
export function encryptAiTranscriptInput(value: string): string {
  return encryptPlainTranscriptValue(value);
}

/** Idempotent encoder for trusted transcript mirrors that may already hold ciphertext. */
export function encryptAiTranscriptText(value: string): string {
  if (value.startsWith(ENCRYPTED_PREFIX)) {
    // Preserve valid ciphertext and reject malformed/undecryptable markers.
    decryptField(value);
    return value;
  }

  return encryptPlainTranscriptValue(value);
}

/** Decrypt current encrypted text and pass through historical plaintext rows. */
export function decryptAiTranscriptText(value: string | null | undefined): string {
  if (value == null) return '';
  return decryptField(value) ?? '';
}
