import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptAiTranscriptText, encryptAiTranscriptText } from './transcriptEncryption.js';
import { decryptStoredThreadMessages, parseAiHistoryPagination } from './threadHistory.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'dentvision-thread-history-test-key';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ENCRYPTION_KEY = originalKey;
});

describe('AI stored thread history boundary', () => {
  it('decrypts encrypted and legacy messages while preserving metadata', () => {
    const encrypted = encryptAiTranscriptText('Пациент сообщает о боли.');
    const rows = [
      { id: 'm1', role: 'user', content: encrypted, timestamp: '2026-10-31T10:00:00.000Z', source: 'crm' },
      { id: 'm2', role: 'assistant', content: 'legacy plaintext reply', timestamp: '2026-10-31T10:00:01.000Z' },
    ];
    const result = decryptStoredThreadMessages(rows) as Array<Record<string, unknown>>;
    expect(result[0]).toEqual({ ...rows[0], content: 'Пациент сообщает о боли.' });
    expect(result[1]).toEqual(rows[1]);
    expect(decryptAiTranscriptText(encrypted)).toBe('Пациент сообщает о боли.');
  });

  it('returns an empty list for invalid session message containers', () => {
    expect(decryptStoredThreadMessages(null)).toEqual([]);
    expect(decryptStoredThreadMessages({ content: 'not-an-array' })).toEqual([]);
  });

  it('fails closed for a malformed encrypted message', () => {
    expect(() => decryptStoredThreadMessages([{ role: 'user', content: 'ENC:broken' }]))
      .toThrow(/Unable to decrypt encrypted field/);
  });

  it('bounds history pagination', () => {
    expect(parseAiHistoryPagination('30', '40')).toEqual({ limit: 30, offset: 40 });
    expect(parseAiHistoryPagination('5000', '999999999999999999999')).toEqual({ limit: 100, offset: 0 });
    expect(parseAiHistoryPagination('-1', '2.5')).toEqual({ limit: 20, offset: 0 });
    expect(parseAiHistoryPagination('20items', '3')).toEqual({ limit: 20, offset: 3 });
    expect(parseAiHistoryPagination(undefined, undefined)).toEqual({ limit: 20, offset: 0 });
  });

  it('requires authentication and the active workspace scope on the history routes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/ai/ai.routes.ts'), 'utf8');
    const threadStart = source.indexOf("aiRouter.get('/threads', authenticate");
    const threadEnd = source.indexOf("aiRouter.get('/threads/active'", threadStart);
    const threadRoute = source.slice(threadStart, threadEnd);
    expect(threadRoute).toContain('clinicId: aiSessionScope(req)');

    const historyStart = source.indexOf("aiRouter.get('/history', authenticate");
    const historyEnd = source.indexOf("aiRouter.post('/session'", historyStart);
    const historyRoute = source.slice(historyStart, historyEnd);
    expect(historyRoute).toContain('parseAiHistoryPagination(req.query.limit, req.query.offset)');
    expect(historyRoute).toContain('decryptStoredThreadMessages(session.messages)');
    expect(historyRoute).toContain('clinicId: aiSessionScope(req)');
  });
});
