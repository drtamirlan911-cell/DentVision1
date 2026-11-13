import { createHmac } from 'node:crypto';
import { decryptField, encryptField } from '../../../lib/phi.js';
import type { NormalizedMessage } from '../webhook/types.js';

const ENCRYPTED_PREFIX = 'ENC:';

export interface AiAdminExternalUserIdentity { clinicId: string; channel: string; externalUserId: string }

export function hashAiAdminExternalUserId(identity: AiAdminExternalUserIdentity): string {
  const externalUserId = identity.externalUserId.trim();
  if (!identity.clinicId || !identity.channel || !externalUserId || externalUserId.length > 256) {
    throw new Error('[phi] AI Admin external identity is invalid');
  }
  const configuredKey = process.env.ENCRYPTION_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('[phi] ENCRYPTION_KEY is required for AI Admin external identity indexing');
  }
  const masterKey = configuredKey && configuredKey.length >= 32 ? configuredKey : 'dev-only-ai-admin-index-key-not-for-production';
  const indexKey = createHmac('sha256', masterKey).update('dentvision:ai-admin:external-user-id:index-key:v1').digest();
  const scopedIdentity = JSON.stringify([identity.channel, identity.clinicId, externalUserId]);
  return 'v1:' + createHmac('sha256', indexKey).update(scopedIdentity).digest('hex');
}

/** AI Admin durable message text must never silently fall back to plaintext. */
export function encryptAiAdminText(value: string): string {
  const encrypted = encryptField(value);
  if (!encrypted || !encrypted.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('[phi] AI Admin text encryption did not produce ciphertext');
  }
  return encrypted;
}

/** Old plaintext rows remain readable; new ciphertext fails closed without its key. */
export function decryptAiAdminText(value: string | null | undefined): string {
  if (value == null) return '';
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const decrypted = decryptField(value);
  if (decrypted == null || decrypted === value || decrypted.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('[phi] AI Admin text decryption unavailable without the matching ENCRYPTION_KEY');
  }
  return decrypted;
}

/** Store JSONB fields as an encrypted JSON string scalar without a schema change. */
export function encryptAiAdminJson(value: unknown): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('[phi] AI Admin value is not JSON serializable');
  }
  if (serialized === undefined) throw new Error('[phi] AI Admin value is not JSON serializable');
  return encryptAiAdminText(serialized);
}

/** Decode encrypted JSON scalars and preserve legacy JSONB objects. */
export function decryptAiAdminJson(value: unknown): unknown {
  if (value == null || typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const serialized = decryptAiAdminText(value);
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('[phi] Decrypted AI Admin JSON is invalid');
  }
}

/** Normalize queue timestamps after decrypting either legacy JSONB or ciphertext. */
export function decodeQueuedAiAdminMessage(value: unknown): NormalizedMessage {
  const decoded = decryptAiAdminJson(value);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('[phi] AI Admin queue payload must be an object');
  }

  const record = decoded as Record<string, unknown>;
  if (
    (record.channel !== 'WHATSAPP' && record.channel !== 'INSTAGRAM')
    || typeof record.channelAccountId !== 'string'
    || typeof record.externalUserId !== 'string'
    || typeof record.text !== 'string'
    || typeof record.externalMessageId !== 'string'
  ) {
    throw new Error('[phi] AI Admin queue payload is incomplete');
  }

  const receivedAt = record.receivedAt instanceof Date
    ? record.receivedAt
    : new Date(String(record.receivedAt ?? ''));
  if (Number.isNaN(receivedAt.getTime())) {
    throw new Error('[phi] AI Admin queue payload has an invalid timestamp');
  }

  return {
    channel: record.channel,
    channelAccountId: record.channelAccountId,
    externalUserId: record.externalUserId,
    text: record.text,
    externalMessageId: record.externalMessageId,
    receivedAt,
  };
}
