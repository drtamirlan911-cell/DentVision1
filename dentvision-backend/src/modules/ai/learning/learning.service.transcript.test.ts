import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  messageFindMany: vi.fn(),
  messageFindFirst: vi.fn(),
  messageUpdate: vi.fn(),
  messageCreate: vi.fn(),
  sessionFindFirst: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    aIMessage: {
      findMany: db.messageFindMany,
      findFirst: db.messageFindFirst,
      update: db.messageUpdate,
      create: db.messageCreate,
    },
    aISession: { findFirst: db.sessionFindFirst },
  },
}));

vi.mock('../memory/memory.engine.js', () => ({
  memoryEngine: {
    get: vi.fn(),
    set: vi.fn(),
    getSession: vi.fn(),
    setSession: vi.fn(),
  },
}));

import { encryptAiTranscriptText, decryptAiTranscriptText } from '../lib/transcriptEncryption.js';
import { getPositiveFewShots, recordMessageFeedback } from './learning.service.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'dentvision-learning-transcript-test-key';
  Object.values(db).forEach((mock) => mock.mockReset());
  db.messageFindMany.mockResolvedValue([]);
  db.messageFindFirst.mockResolvedValue(null);
  db.messageUpdate.mockResolvedValue({ id: 'message-1' });
  db.messageCreate.mockResolvedValue({ id: 'message-1' });
  db.sessionFindFirst.mockResolvedValue({ id: 'session-1' });
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ENCRYPTION_KEY = originalKey;
});

describe('AI learning transcript handling', () => {
  it('decrypts encrypted user and assistant text before building few-shot examples', async () => {
    db.messageFindMany.mockResolvedValue([{
      content: encryptAiTranscriptText('Расписание врача: сегодня свободно два окна.'),
      prevUserText: encryptAiTranscriptText('Покажи расписание врача сегодня.'),
    }]);

    const result = await getPositiveFewShots('user-1', 'clinic-1', 'Покажи расписание врача');

    expect(result).toEqual([{
      user: 'Покажи расписание врача сегодня.',
      assistant: 'Расписание врача: сегодня свободно два окна.',
    }]);
  });

  it('only updates a feedback target owned by the active user and workspace', async () => {
    db.messageFindFirst.mockResolvedValue(null);

    const result = await recordMessageFeedback({
      userId: 'user-1',
      clinicId: 'clinic-1',
      messageId: 'message-from-another-user',
      rating: 'up',
    });

    expect(result).toEqual({ ok: false });
    expect(db.messageUpdate).not.toHaveBeenCalled();
    expect(db.messageCreate).not.toHaveBeenCalled();
  });

  it('keeps legacy conversation text encrypted when feedback is recorded', async () => {
    db.messageFindMany.mockResolvedValue([{
      id: 'message-1',
      content: 'legacy assistant answer',
      prevUserText: 'legacy user question',
    }]);

    const result = await recordMessageFeedback({
      userId: 'user-1',
      clinicId: 'clinic-1',
      sessionId: 'session-1',
      assistantText: 'legacy assistant answer',
      rating: 'down',
    });

    expect(result.ok).toBe(true);
    const update = db.messageUpdate.mock.calls[0][0];
    expect(update.data.content).toMatch(/^ENC:/);
    expect(update.data.prevUserText).toMatch(/^ENC:/);
    expect(decryptAiTranscriptText(update.data.content)).toBe('legacy assistant answer');
    expect(decryptAiTranscriptText(update.data.prevUserText)).toBe('legacy user question');
  });
});
