import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Two properties matter here and both are about not failing loudly.
 *
 * The cache is keyed on the *text*, so two patients hearing the same sentence
 * cost one synthesis between them — that is what makes re-watching free.
 *
 * And silence is a valid outcome: no storage, no key, a dead provider, an
 * exhausted budget all produce `audioUrl: null`, which the player turns into a
 * line read at its estimated pace. The patient never sees an error.
 */

const { voiceFindMany, voiceUpsert, voiceUpdateMany } = vi.hoisted(() => ({
  voiceFindMany: vi.fn(),
  voiceUpsert: vi.fn(),
  voiceUpdateMany: vi.fn(),
}));
const { storageConfigured, uploadObject, signedDownloadUrl } = vi.hoisted(() => ({
  storageConfigured: vi.fn(),
  uploadObject: vi.fn(),
  signedDownloadUrl: vi.fn(),
}));
const { env } = vi.hoisted(() => ({ env: { OPENAI_API_KEY: 'sk-test-key-long-enough-for-schema' } }));

vi.mock('../../lib/prisma.js', () => ({
  default: { voiceAsset: { findMany: voiceFindMany, upsert: voiceUpsert, updateMany: voiceUpdateMany } },
}));
vi.mock('../../config.js', () => ({ env }));
vi.mock('../../lib/storage.js', () => ({
  storageConfigured,
  uploadObject,
  signedDownloadUrl,
  toStorageUrl: (key: string) => `s3://${key}`,
  keyFromStorageUrl: (url: string) => (url.startsWith('s3://') ? url.slice(5) : ''),
}));

import { normalizeForTts, resolveVoiceLines, voiceCacheKey, voiceConfigured } from './voice.service.js';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  env.OPENAI_API_KEY = 'sk-test-key-long-enough-for-schema';
  storageConfigured.mockReturnValue(true);
  voiceFindMany.mockResolvedValue([]);
  voiceUpdateMany.mockResolvedValue({ count: 0 });
  voiceUpsert.mockImplementation(async ({ create }: any) => ({ ...create, durationMs: null }));
  uploadObject.mockResolvedValue(undefined);
  signedDownloadUrl.mockImplementation(async (key: string) => `https://cdn.test/${key}?sig=x`);
  fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1024) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the cache key', () => {
  it('collapses whitespace, so trivially different strings share one entry', () => {
    expect(normalizeForTts('  Привет   мир \n')).toBe('Привет мир');
    expect(voiceCacheKey('Привет   мир', 'ru')).toBe(voiceCacheKey('Привет мир', 'ru'));
  });

  it('separates locales', () => {
    expect(voiceCacheKey('Hello', 'ru')).not.toBe(voiceCacheKey('Hello', 'en'));
  });

  it('changes with the text', () => {
    expect(voiceCacheKey('Один', 'ru')).not.toBe(voiceCacheKey('Два', 'ru'));
  });
});

describe('synthesis', () => {
  it('synthesises a miss and stores it', async () => {
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: 'Здравствуйте.' }], 'ru');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(uploadObject).toHaveBeenCalledWith(expect.stringMatching(/^voice\/ru\/[0-9a-f]{64}\.mp3$/), expect.any(Buffer), 'audio/mpeg');
    expect(line.audioUrl).toContain('https://cdn.test/');
  });

  it('serves a hit without calling the provider', async () => {
    const key = voiceCacheKey('Здравствуйте.', 'ru');
    voiceFindMany.mockResolvedValue([{ cacheKey: key, storageUrl: `s3://voice/ru/${key}.mp3`, durationMs: 1800 }]);
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: 'Здравствуйте.' }], 'ru');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(line.durationMs).toBe(1800);
  });

  it('synthesises a repeated sentence only once within a batch', async () => {
    // Two beats, identical wording — the opening line of every plan.
    const lines = await resolveVoiceLines(
      [
        { beatId: 'b1', text: 'Одинаковая фраза.' },
        { beatId: 'b2', text: 'Одинаковая  фраза.' },
      ],
      'ru',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lines[0].audioUrl).toBe(lines[1].audioUrl);
  });

  it('marks served entries as recently used', async () => {
    const key = voiceCacheKey('Здравствуйте.', 'ru');
    voiceFindMany.mockResolvedValue([{ cacheKey: key, storageUrl: `s3://voice/ru/${key}.mp3`, durationMs: null }]);
    await resolveVoiceLines([{ beatId: 'b1', text: 'Здравствуйте.' }], 'ru');
    expect(voiceUpdateMany).toHaveBeenCalled();
  });
});

describe('silence is a valid outcome', () => {
  it('when storage is not configured, nothing is synthesised and nothing fails', async () => {
    storageConfigured.mockReturnValue(false);
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: 'Здравствуйте.' }], 'ru');
    expect(voiceConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(line).toEqual({ beatId: 'b1', audioUrl: null, durationMs: null });
  });

  it('when there is no API key, likewise', async () => {
    env.OPENAI_API_KEY = '';
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: 'Здравствуйте.' }], 'ru');
    expect(line.audioUrl).toBeNull();
  });

  it('when the provider returns an error, that line is silent and the rest continue', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) });
    const lines = await resolveVoiceLines(
      [
        { beatId: 'b1', text: 'Первая.' },
        { beatId: 'b2', text: 'Вторая.' },
      ],
      'ru',
    );
    expect(lines[0].audioUrl).toBeNull();
    expect(lines[1].audioUrl).toContain('https://cdn.test/');
  });

  it('when the provider throws, it does not reject', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(resolveVoiceLines([{ beatId: 'b1', text: 'Первая.' }], 'ru')).resolves.toEqual([
      { beatId: 'b1', audioUrl: null, durationMs: null },
    ]);
  });

  it('when the upload fails, no row is written and the line stays silent', async () => {
    uploadObject.mockRejectedValue(new Error('s3 down'));
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: 'Первая.' }], 'ru');
    expect(voiceUpsert).not.toHaveBeenCalled();
    expect(line.audioUrl).toBeNull();
  });

  it('when signing fails, the line stays silent rather than serving a broken URL', async () => {
    signedDownloadUrl.mockRejectedValue(new Error('sign failed'));
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: 'Первая.' }], 'ru');
    expect(line.audioUrl).toBeNull();
  });

  it('an empty line is silent without touching the provider', async () => {
    const [line] = await resolveVoiceLines([{ beatId: 'b1', text: '   ' }], 'ru');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(line.audioUrl).toBeNull();
  });
});

describe('cost control', () => {
  it('stops at the per-request character budget instead of billing without limit', async () => {
    // Each line is well under the per-beat cap but together they blow the
    // per-request budget; the overflow must go silent, not through.
    const lines = Array.from({ length: 40 }, (_, i) => ({
      beatId: `b${i}`,
      text: `${'я'.repeat(300)} ${i}`,
    }));
    const results = await resolveVoiceLines(lines, 'ru');
    expect(fetchMock.mock.calls.length).toBeLessThan(40);
    expect(results.some((r) => r.audioUrl === null)).toBe(true);
    expect(results).toHaveLength(40);
  });
});
