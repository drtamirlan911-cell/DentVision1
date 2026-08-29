import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, resolveModels } = vi.hoisted(() => ({
  mockEnv: { OPENAI_API_KEY: 'k'.repeat(24), OPENAI_MODEL: undefined, OPENAI_MODEL_MINI: undefined },
  resolveModels: vi.fn(),
}));

vi.mock('../../../config.js', () => ({ env: mockEnv }));
vi.mock('./modelCatalog.js', () => ({ resolveModels }));

const { MAX_AUDIO_BYTES, transcribeAudio } = await import('./transcription.js');

const audio = (bytes = 128) => Buffer.alloc(bytes, 1);

function stubProvider(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => 'error body',
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  mockEnv.OPENAI_API_KEY = 'k'.repeat(24);
  resolveModels.mockReset().mockResolvedValue({ transcription: 'test-stt' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('refuses before spending anything', () => {
  it('without an API key', async () => {
    mockEnv.OPENAI_API_KEY = '';
    const fetchMock = stubProvider({});

    await expect(transcribeAudio({ buffer: audio(), filename: 'a.webm', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ ok: false, reason: 'NO_KEY' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('on an empty recording', async () => {
    const fetchMock = stubProvider({});

    await expect(transcribeAudio({ buffer: Buffer.alloc(0), filename: 'a.webm', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ ok: false, reason: 'EMPTY' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('above the provider’s size limit', async () => {
    const fetchMock = stubProvider({});

    await expect(transcribeAudio({
      buffer: audio(MAX_AUDIO_BYTES + 1), filename: 'a.webm', mimeType: 'audio/webm',
    })).resolves.toMatchObject({ ok: false, reason: 'TOO_LARGE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['application/pdf', 'image/png', 'text/plain', ''])('on %s, which is not audio', async (type) => {
    const fetchMock = stubProvider({});

    await expect(transcribeAudio({ buffer: audio(), filename: 'a', mimeType: type }))
      .resolves.toMatchObject({ ok: false, reason: 'UNSUPPORTED_TYPE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('transcribeAudio', () => {
  it('accepts a mime type carrying a codec suffix', async () => {
    // MediaRecorder produces `audio/webm;codecs=opus`; matching the bare type
    // against the allow-list would reject every real browser recording.
    stubProvider({ text: 'на шестнадцатом кариес' });

    await expect(transcribeAudio({
      buffer: audio(), filename: 'a.webm', mimeType: 'audio/webm;codecs=opus',
    })).resolves.toMatchObject({ ok: true, text: 'на шестнадцатом кариес' });
  });

  it('sends the resolved model and the language hint', async () => {
    const fetchMock = stubProvider({ text: 'ок' });

    await transcribeAudio({ buffer: audio(), filename: 'a.webm', mimeType: 'audio/webm', language: 'ru' });

    const form = (fetchMock.mock.calls[0][1] as any).body as FormData;
    expect(form.get('model')).toBe('test-stt');
    expect(form.get('language')).toBe('ru');
    // A dental prompt, so the recogniser does not turn tooth terms into
    // ordinary words.
    expect(String(form.get('prompt'))).toContain('FDI');
  });

  it('reports a provider failure without throwing', async () => {
    stubProvider({}, false);

    await expect(transcribeAudio({ buffer: audio(), filename: 'a.webm', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ ok: false, reason: 'PROVIDER_ERROR' });
  });

  it('treats a blank transcript as empty rather than success', async () => {
    stubProvider({ text: '   ' });

    await expect(transcribeAudio({ buffer: audio(), filename: 'a.webm', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ ok: false, reason: 'EMPTY' });
  });

  it('survives a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    await expect(transcribeAudio({ buffer: audio(), filename: 'a.webm', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ ok: false, reason: 'PROVIDER_ERROR' });
  });
});
