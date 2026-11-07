import { prisma } from '../../../lib/prisma.js';
import { decryptField, encryptField } from '../../../lib/phi.js';
import { MemoryEntry } from '../types/ai.types.js';

const ENVELOPE_KEY = '__dentvisionEncryptedMemoryV1';
type EncryptedMemoryEnvelope = {
  __dentvisionEncryptedMemoryV1: { v: 1; ciphertext: string };
};

function encodeMemoryValue(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error('[phi] AI memory value must be JSON serializable');
  }

  const ciphertext = encryptField(serialized);
  if (!ciphertext) throw new Error('[phi] AI memory encryption returned no value');
  if (!ciphertext.startsWith('ENC:')) {
    // phi.ts intentionally supports plaintext local development without a key.
    // Production cannot fall back because encryptField throws before this point.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[phi] AI memory encryption unavailable in production');
    }
    return value;
  }

  return {
    [ENVELOPE_KEY]: { v: 1, ciphertext },
  } satisfies EncryptedMemoryEnvelope;
}

function decodeMemoryValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !Object.prototype.hasOwnProperty.call(value, ENVELOPE_KEY)) {
    // Read compatibility for legacy JSON values during the separately
    // approved data backfill. Old values are not re-emitted by new writes.
    return value;
  }

  const envelope = (value as Record<string, unknown>)[ENVELOPE_KEY];
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('[phi] Invalid AI-memory encryption envelope');
  }
  const record = envelope as Record<string, unknown>;
  if (record.v !== 1 || typeof record.ciphertext !== 'string' || !record.ciphertext.startsWith('ENC:')) {
    throw new Error('[phi] Unsupported or malformed AI-memory encryption envelope');
  }

  const plaintext = decryptField(record.ciphertext);
  if (plaintext == null || plaintext === record.ciphertext || plaintext.startsWith('ENC:')) {
    throw new Error('[phi] AI-memory decryption unavailable without the matching ENCRYPTION_KEY');
  }
  try {
    return JSON.parse(plaintext) as unknown;
  } catch {
    throw new Error('[phi] Decrypted AI-memory value is not valid JSON');
  }
}

export class MemoryEngine {
  async getShortTerm(key: string, userId: string, clinicId: string): Promise<unknown> {
    const entry = await prisma.aIMemory.findFirst({
      where: { key, userId, clinicId, scope: 'short' },
    });
    return entry ? decodeMemoryValue(entry.value) : null;
  }

  async setShortTerm(key: string, value: unknown, userId: string, clinicId: string): Promise<void> {
    const storedValue = encodeMemoryValue(value);
    await prisma.aIMemory.upsert({
      where: { key_userId_clinicId_scope: { key, userId, clinicId, scope: 'short' } },
      update: { value: storedValue as any, updatedAt: new Date() },
      create: { id: crypto.randomUUID(), key, value: storedValue as any, userId, clinicId, scope: 'short' },
    });
  }

  async getSession(key: string, userId: string, clinicId: string): Promise<unknown> {
    const entry = await prisma.aIMemory.findFirst({
      where: { key, userId, clinicId, scope: 'session' },
    });
    return entry ? decodeMemoryValue(entry.value) : null;
  }

  async setSession(key: string, value: unknown, userId: string, clinicId: string): Promise<void> {
    const storedValue = encodeMemoryValue(value);
    await prisma.aIMemory.upsert({
      where: { key_userId_clinicId_scope: { key, userId, clinicId, scope: 'session' } },
      update: { value: storedValue as any, updatedAt: new Date() },
      create: { id: crypto.randomUUID(), key, value: storedValue as any, userId, clinicId, scope: 'session' },
    });
  }

  async getLongTerm(key: string, userId: string, clinicId: string): Promise<unknown> {
    const entry = await prisma.aIMemory.findFirst({
      where: { key, userId, clinicId, scope: 'long' },
    });
    return entry ? decodeMemoryValue(entry.value) : null;
  }

  async setLongTerm(key: string, value: unknown, userId: string, clinicId: string): Promise<void> {
    const storedValue = encodeMemoryValue(value);
    await prisma.aIMemory.upsert({
      where: { key_userId_clinicId_scope: { key, userId, clinicId, scope: 'long' } },
      update: { value: storedValue as any, updatedAt: new Date() },
      create: { id: crypto.randomUUID(), key, value: storedValue as any, userId, clinicId, scope: 'long' },
    });
  }

  async clearScope(userId: string, clinicId: string, scope: 'short' | 'session' | 'long'): Promise<void> {
    await prisma.aIMemory.deleteMany({
      where: { userId, clinicId, scope },
    });
  }

  async getAllByScope(userId: string, clinicId: string, scope: 'short' | 'session' | 'long'): Promise<MemoryEntry[]> {
    const entries = await prisma.aIMemory.findMany({
      where: { userId, clinicId, scope },
      orderBy: { updatedAt: 'desc' },
    });
    return entries.map((entry) => ({
      ...entry,
      value: decodeMemoryValue(entry.value),
    })) as MemoryEntry[];
  }
}

export const memoryEngine = new MemoryEngine();
