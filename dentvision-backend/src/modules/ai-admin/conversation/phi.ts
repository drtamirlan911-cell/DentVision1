import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import type { NormalizedMessage } from '../webhook/types.js';

const ENCRYPTED_PREFIX = 'ENC:';
const VERSIONED_PREFIX = 'ENC:v2:';
const LEGACY_INDEX_PREFIX = 'v1:';
const DEV_KEY = 'dev-only-ai-admin-key-not-for-production';
const DEV_LEGACY_FIELD_KEY = 'dev-only-key-not-for-production';
const DEV_LEGACY_INDEX_KEY = 'dev-only-ai-admin-index-key-not-for-production';
const KEY_MIN_LENGTH = 32;
const KEY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const CIPHER_ALGORITHM = 'aes-256-gcm';
const CIPHER_IV_LENGTH = 12;
const CIPHER_TAG_LENGTH = 16;

export interface AiAdminExternalUserIdentity { clinicId: string; channel: string; externalUserId: string }
type SecretKeyring = { keys: Map<string, string>; activeKeyId: string };

function configuredFallbackSecret(developmentFallback = DEV_KEY): string {
  const configured = process.env.ENCRYPTION_KEY;
  if (configured && configured.length >= KEY_MIN_LENGTH) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[phi] A configured AI Admin keyring or ENCRYPTION_KEY is required in production');
  }
  return developmentFallback;
}

function parseKeyring(raw: string, envName: string): Map<string, string> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('[phi] ' + envName + ' must be valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('[phi] ' + envName + ' must be a JSON object of key IDs to secrets');
  }
  const keys = new Map<string, string>();
  for (const [keyId, secret] of Object.entries(parsed as Record<string, unknown>)) {
    if (!KEY_ID_PATTERN.test(keyId) || typeof secret !== 'string' || secret.length < KEY_MIN_LENGTH) {
      throw new Error('[phi] ' + envName + ' contains an invalid key ID or secret');
    }
    keys.set(keyId, secret);
  }
  if (keys.size === 0) throw new Error('[phi] ' + envName + ' must contain at least one key');
  return keys;
}

function resolveKeyring(ringEnvName: string, activeEnvName: string, developmentFallback = DEV_KEY): SecretKeyring {
  const raw = process.env[ringEnvName];
  const keys = raw
    ? parseKeyring(raw, ringEnvName)
    : new Map<string, string>([['legacy', configuredFallbackSecret(developmentFallback)]]);
  const requestedActiveKeyId = process.env[activeEnvName];
  const activeKeyId = requestedActiveKeyId || (keys.size === 1 ? keys.keys().next().value : undefined);
  if (!activeKeyId || !keys.has(activeKeyId)) {
    throw new Error('[phi] ' + activeEnvName + ' must name a key in ' + ringEnvName);
  }
  return { keys, activeKeyId };
}

function deriveVersionedEncryptionKey(secret: string, keyId: string): Buffer {
  return scryptSync(secret, 'dentvision:ai-admin:phi:v2:' + keyId, 32);
}

function deriveLegacyEncryptionKey(secret: string): Buffer {
  return scryptSync(secret, 'salt', 32);
}

function getLegacyEncryptionSecret(): string {
  const ringEnv = process.env.AI_ADMIN_PHI_KEYRING_JSON;
  if (ringEnv) {
    const legacy = parseKeyring(ringEnv, 'AI_ADMIN_PHI_KEYRING_JSON').get('legacy');
    if (legacy) return legacy;
  }
  const configured = process.env.ENCRYPTION_KEY;
  if (configured && configured.length >= KEY_MIN_LENGTH) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[phi] ENCRYPTION_KEY is required to decrypt legacy AI Admin ciphertext');
  }
  return DEV_LEGACY_FIELD_KEY;
}

function decryptLegacyAiAdminText(value: string): string {
  const parts = value.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3 || !parts.every((part) => /^[a-fA-F0-9]+$/.test(part))) {
    throw new Error('[phi] AI Admin legacy ciphertext has an invalid format');
  }
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    if (iv.length !== 16 || tag.length !== CIPHER_TAG_LENGTH) throw new Error('invalid lengths');
    const decipher = createDecipheriv(CIPHER_ALGORITHM, deriveLegacyEncryptionKey(getLegacyEncryptionSecret()), iv);
    decipher.setAuthTag(tag);
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    throw new Error('[phi] AI Admin legacy ciphertext cannot be decrypted with the configured legacy key');
  }
}

export function hashAiAdminExternalUserId(identity: AiAdminExternalUserIdentity): string {
  const externalUserId = identity.externalUserId.trim();
  if (!identity.clinicId || !identity.channel || !externalUserId || externalUserId.length > 256) {
    throw new Error('[phi] AI Admin external identity is invalid');
  }
  const keyring = resolveKeyring('AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON', 'AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID', DEV_LEGACY_INDEX_KEY);
  const secret = keyring.keys.get(keyring.activeKeyId)!;
  const indexKey = createHmac('sha256', secret)
    .update('dentvision:ai-admin:external-user-id:index-key:v2:' + keyring.activeKeyId)
    .digest();
  const scopedIdentity = JSON.stringify([identity.channel, identity.clinicId, externalUserId]);
  return 'v2:' + keyring.activeKeyId + ':' + createHmac('sha256', indexKey).update(scopedIdentity).digest('hex');
}

/** All currently readable blind-index versions, active first, for safe online rotation. */
export function getAiAdminExternalUserIdHashes(identity: AiAdminExternalUserIdentity): string[] {
  const externalUserId = identity.externalUserId.trim();
  if (!identity.clinicId || !identity.channel || !externalUserId || externalUserId.length > 256) {
    throw new Error('[phi] AI Admin external identity is invalid');
  }
  const keyring = resolveKeyring('AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON', 'AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID');
  const scopedIdentity = JSON.stringify([identity.channel, identity.clinicId, externalUserId]);
  const hashes: string[] = [];
  const activeSecret = keyring.keys.get(keyring.activeKeyId)!;
  const activeIndexKey = createHmac('sha256', activeSecret)
    .update('dentvision:ai-admin:external-user-id:index-key:v2:' + keyring.activeKeyId)
    .digest();
  hashes.push('v2:' + keyring.activeKeyId + ':' + createHmac('sha256', activeIndexKey).update(scopedIdentity).digest('hex'));

  for (const [keyId, secret] of keyring.keys) {
    const indexKey = createHmac('sha256', secret)
      .update('dentvision:ai-admin:external-user-id:index-key:v2:' + keyId)
      .digest();
    hashes.push('v2:' + keyId + ':' + createHmac('sha256', indexKey).update(scopedIdentity).digest('hex'));
    if (keyId === 'legacy') {
      const oldIndexKey = createHmac('sha256', secret)
        .update('dentvision:ai-admin:external-user-id:index-key:v1')
        .digest();
      hashes.push(LEGACY_INDEX_PREFIX + createHmac('sha256', oldIndexKey).update(scopedIdentity).digest('hex'));
    }
  }
  return [...new Set(hashes)];
}

export function encryptAiAdminText(value: string): string {
  if (typeof value !== 'string') throw new Error('[phi] AI Admin text must be a string');
  const keyring = resolveKeyring('AI_ADMIN_PHI_KEYRING_JSON', 'AI_ADMIN_PHI_ACTIVE_KEY_ID');
  const secret = keyring.keys.get(keyring.activeKeyId)!;
  const key = deriveVersionedEncryptionKey(secret, keyring.activeKeyId);
  const iv = randomBytes(CIPHER_IV_LENGTH);
  const aad = Buffer.from('dentvision:ai-admin:phi:v2:' + keyring.activeKeyId, 'utf8');
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return VERSIONED_PREFIX
    + keyring.activeKeyId + ':'
    + iv.toString('base64url') + ':'
    + cipher.getAuthTag().toString('base64url') + ':'
    + ciphertext.toString('base64url');
}

export function decryptAiAdminText(value: string | null | undefined): string {
  if (value == null) return '';
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  if (!value.startsWith(VERSIONED_PREFIX)) return decryptLegacyAiAdminText(value);

  const parts = value.split(':');
  if (
    parts.length !== 6 || parts[0] !== 'ENC' || parts[1] !== 'v2'
    || !KEY_ID_PATTERN.test(parts[2])
    || !/^[A-Za-z0-9_-]+$/.test(parts[3])
    || !/^[A-Za-z0-9_-]+$/.test(parts[4])
    || !/^[A-Za-z0-9_-]+$/.test(parts[5])
  ) {
    throw new Error('[phi] AI Admin versioned ciphertext has an invalid format');
  }
  const [, , keyId, ivEncoded, tagEncoded, ciphertextEncoded] = parts;
  const keyring = resolveKeyring('AI_ADMIN_PHI_KEYRING_JSON', 'AI_ADMIN_PHI_ACTIVE_KEY_ID');
  const secret = keyring.keys.get(keyId);
  if (!secret) throw new Error('[phi] AI Admin ciphertext references an unavailable key ID');
  try {
    const iv = Buffer.from(ivEncoded, 'base64url');
    const tag = Buffer.from(tagEncoded, 'base64url');
    if (iv.length !== CIPHER_IV_LENGTH || tag.length !== CIPHER_TAG_LENGTH) throw new Error('invalid lengths');
    const decipher = createDecipheriv(CIPHER_ALGORITHM, deriveVersionedEncryptionKey(secret, keyId), iv);
    decipher.setAAD(Buffer.from('dentvision:ai-admin:phi:v2:' + keyId, 'utf8'));
    decipher.setAuthTag(tag);
    return decipher.update(Buffer.from(ciphertextEncoded, 'base64url')).toString('utf8') + decipher.final('utf8');
  } catch {
    throw new Error('[phi] AI Admin ciphertext authentication failed or the configured key is incorrect');
  }
}

export function isAiAdminTextEncryptedWithActiveKey(value: string | null | undefined): boolean {
  if (!value?.startsWith(VERSIONED_PREFIX)) return false;
  const keyring = resolveKeyring('AI_ADMIN_PHI_KEYRING_JSON', 'AI_ADMIN_PHI_ACTIVE_KEY_ID');
  return value.startsWith(VERSIONED_PREFIX + keyring.activeKeyId + ':');
}

export function encryptAiAdminJson(value: unknown): string {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); }
  catch { throw new Error('[phi] AI Admin value is not JSON serializable'); }
  if (serialized === undefined) throw new Error('[phi] AI Admin value is not JSON serializable');
  return encryptAiAdminText(serialized);
}

export function decryptAiAdminJson(value: unknown): unknown {
  if (value == null || typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) return value;
  const serialized = decryptAiAdminText(value);
  try { return JSON.parse(serialized) as unknown; }
  catch { throw new Error('[phi] Decrypted AI Admin JSON is invalid'); }
}

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
  if (Number.isNaN(receivedAt.getTime())) throw new Error('[phi] AI Admin queue payload has an invalid timestamp');
  return {
    channel: record.channel,
    channelAccountId: record.channelAccountId,
    externalUserId: record.externalUserId,
    text: record.text,
    externalMessageId: record.externalMessageId,
    receivedAt,
  };
}
