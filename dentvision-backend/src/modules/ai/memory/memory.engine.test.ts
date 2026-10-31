import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  findFirst: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: { aIMemory: db },
}));

import { memoryEngine } from './memory.engine.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalKey = process.env.ENCRYPTION_KEY;
const FIELD = '__dentvisionEncryptedMemoryV1';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'dentvision-ai-memory-test-key-2026-10-31';
  Object.values(db).forEach((mock) => mock.mockReset());
  db.upsert.mockResolvedValue({});
  db.findMany.mockResolvedValue([]);
  db.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ENCRYPTION_KEY = originalKey;
});

describe('AI memory encryption at rest', () => {
  it('encrypts short-, session- and long-term memory values before JSON persistence', async () => {
    const secret = { note: 'patient reports severe tooth pain', nested: { allergy: 'penicillin' } };
    await memoryEngine.setShortTerm('short-1', secret, 'user-1', 'clinic-1');
    await memoryEngine.setSession('session-1', secret, 'user-1', 'clinic-1');
    await memoryEngine.setLongTerm('long-1', secret, 'user-1', 'clinic-1');

    expect(db.upsert).toHaveBeenCalledTimes(3);
    for (const call of db.upsert.mock.calls) {
      const stored = call[0].create.value as Record<string, any>;
      expect(stored).toHaveProperty(FIELD);
      expect(stored[FIELD].v).toBe(1);
      expect(stored[FIELD].ciphertext).toMatch(/^ENC:/);
      expect(JSON.stringify(stored)).not.toContain('severe tooth pain');
      expect(JSON.stringify(stored)).not.toContain('penicillin');
    }
  });

  it('decrypts encrypted values and keeps legacy JSON readable', async () => {
    await memoryEngine.setLongTerm('prefs', { items: [{ value: 'remember only my preferred language' }] }, 'user-1', 'clinic-1');
    const stored = db.upsert.mock.calls[0][0].create.value;
    db.findFirst.mockResolvedValueOnce({ value: stored });
    await expect(memoryEngine.getLongTerm('prefs', 'user-1', 'clinic-1'))
      .resolves.toEqual({ items: [{ value: 'remember only my preferred language' }] });

    const legacy = { items: [{ value: 'legacy preference' }] };
    db.findFirst.mockResolvedValueOnce({ value: legacy });
    await expect(memoryEngine.getLongTerm('prefs', 'user-1', 'clinic-1')).resolves.toEqual(legacy);
  });

  it('decrypts every scoped row returned by the memory listing', async () => {
    await memoryEngine.setSession('cache', { text: 'private session context' }, 'user-1', 'clinic-1');
    const stored = db.upsert.mock.calls[0][0].create.value;
    db.findMany.mockResolvedValue([{ id: 'memory-1', key: 'cache', value: stored, scope: 'session', userId: 'user-1', clinicId: 'clinic-1', updatedAt: new Date() }]);
    const rows = await memoryEngine.getAllByScope('user-1', 'clinic-1', 'session');
    expect(rows[0].value).toEqual({ text: 'private session context' });
  });

  it('fails closed for malformed envelopes and production writes without an encryption key', async () => {
    db.findFirst.mockResolvedValueOnce({ value: { [FIELD]: { v: 2, ciphertext: 'ENC:bad' } } });
    await expect(memoryEngine.getLongTerm('prefs', 'user-1', 'clinic-1'))
      .rejects.toThrow(/Unsupported or malformed AI-memory encryption envelope/);

    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    await expect(memoryEngine.setLongTerm('prefs', { value: 'sensitive' }, 'user-1', 'clinic-1'))
      .rejects.toThrow(/Encryption unavailable in production/);
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
