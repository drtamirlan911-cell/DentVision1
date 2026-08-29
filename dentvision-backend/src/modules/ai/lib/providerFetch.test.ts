import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  backoffDelay,
  isProviderUnavailable,
  isProviderUnavailableError,
  parseRetryAfter,
  providerFetch,
  providerStream,
} from './providerFetch.js';

/** Queue of responses the stubbed provider hands back, in order. */
function stubResponses(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('fetch called more times than the test queued');
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const fail = (status: number, body = '', headers: Record<string, string> = {}) =>
  new Response(body, { status, headers });

/** No real waiting: the delays are asserted, not slept through. */
const slept: number[] = [];
const sleep = async (ms: number) => { slept.push(ms); };

const OPTS = { apiKey: 'k', body: {}, timeoutMs: 1000, sleep };

beforeEach(() => {
  vi.unstubAllGlobals();
  slept.length = 0;
});

describe('isProviderUnavailable — what retrying cannot fix', () => {
  it.each([401, 403])('treats %i as terminal', (status) => {
    expect(isProviderUnavailable(status, '')).toBe(true);
  });

  it('splits 429 by meaning, not by status code', () => {
    // "Slow down" is worth retrying; "no credits" will fail identically forever.
    expect(isProviderUnavailable(429, 'Rate limit reached')).toBe(false);
    expect(isProviderUnavailable(429, 'insufficient_quota')).toBe(true);
    expect(isProviderUnavailable(429, 'credit_balance_exhausted')).toBe(true);
  });

  it.each([500, 502, 503])('does not treat %i as terminal', (status) => {
    expect(isProviderUnavailable(status, '')).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('reads a delay in seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
  });

  it('reads an HTTP date relative to now', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:03 GMT', now)).toBe(3000);
  });

  it('caps an absurd delay rather than stalling the request', () => {
    expect(parseRetryAfter('99999')).toBe(8000);
  });

  it.each([[null], [''], ['soon']])('returns null for %s', (header) => {
    expect(parseRetryAfter(header as string | null)).toBeNull();
  });
});

describe('backoffDelay', () => {
  it('grows with each attempt and stays capped', () => {
    const worstCase = (attempt: number) => backoffDelay(attempt, () => 1);
    expect(worstCase(0)).toBe(500);
    expect(worstCase(1)).toBe(1000);
    expect(worstCase(10)).toBe(8000);
  });

  it('jitters, so simultaneous callers do not retry in lockstep', () => {
    expect(backoffDelay(3, () => 0)).toBe(0);
    expect(backoffDelay(3, () => 1)).toBe(4000);
  });
});

describe('providerFetch', () => {
  it('returns the parsed body on first success', async () => {
    const fetchMock = stubResponses(ok({ answer: 42 }));

    await expect(providerFetch('https://x', OPTS)).resolves.toEqual({ answer: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
  });

  it('retries a rate limit and succeeds', async () => {
    const fetchMock = stubResponses(fail(429, 'Rate limit reached'), ok({ answer: 1 }));

    await expect(providerFetch('https://x', OPTS)).resolves.toEqual({ answer: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(slept).toHaveLength(1);
  });

  it('obeys Retry-After over its own backoff', async () => {
    stubResponses(fail(429, 'slow down', { 'retry-after': '2' }), ok());

    await providerFetch('https://x', OPTS);

    expect(slept).toEqual([2000]);
  });

  it.each([500, 502, 503, 408])('retries %i', async (status) => {
    const fetchMock = stubResponses(fail(status), ok());

    await providerFetch('https://x', OPTS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a network failure — it says nothing about the request', async () => {
    const fetchMock = stubResponses(new Error('socket hang up'), ok({ answer: 2 }));

    await expect(providerFetch('https://x', OPTS)).resolves.toEqual({ answer: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an exhausted balance, and marks it terminal', async () => {
    const fetchMock = stubResponses(fail(429, 'insufficient_quota'));

    const error = await providerFetch('https://x', OPTS).catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isProviderUnavailableError(error)).toBe(true);
  });

  it.each([400, 404, 422])('does not retry %i — the request itself is wrong', async (status) => {
    const fetchMock = stubResponses(fail(status, 'bad request'));

    await expect(providerFetch('https://x', OPTS)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt budget and reports the last failure', async () => {
    const fetchMock = stubResponses(fail(503), fail(503), fail(503));

    await expect(providerFetch('https://x', OPTS)).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(slept).toHaveLength(2);
  });

  it('can be told not to retry at all', async () => {
    const fetchMock = stubResponses(fail(503));

    await expect(providerFetch('https://x', { ...OPTS, attempts: 1 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('providerStream', () => {
  /** A body that hands the reader exactly these chunks, in order. */
  function streamBody(chunks: string[]) {
    const encoder = new TextEncoder();
    let i = 0;
    return {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: encoder.encode(chunks[i++]) } : { done: true, value: undefined },
      }),
    };
  }

  function stubStream(chunks: string[], status = 200) {
    const fetchMock = vi.fn(async () => ({
      ok: status === 200,
      status,
      body: streamBody(chunks),
      text: async () => 'error body',
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const delta = (text: string) =>
    `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\n`;
  const completed = (response: unknown) =>
    `data: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;

  it('emits each fragment and returns the completed response', async () => {
    stubStream([delta('При'), delta('вет'), completed({ output_text: 'Привет' })]);
    const seen: string[] = [];

    const result = await providerStream<{ output_text: string }>('https://x', {
      apiKey: 'k', body: {}, timeoutMs: 1000, onDelta: (t) => seen.push(t),
    });

    expect(seen).toEqual(['При', 'вет']);
    expect(result.output_text).toBe('Привет');
  });

  it('asks the provider to stream', async () => {
    const fetchMock = stubStream([completed({})]);

    await providerStream('https://x', { apiKey: 'k', body: { model: 'm' }, timeoutMs: 1000, onDelta: () => {} });

    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body)).toMatchObject({ model: 'm', stream: true });
  });

  it('reassembles a frame split across network chunks', async () => {
    // The decisive case: SSE frames do not align with TCP boundaries, and a
    // naive parser drops whatever straddles two reads.
    const frame = delta('целое');
    stubStream([frame.slice(0, 12), frame.slice(12), completed({})]);
    const seen: string[] = [];

    await providerStream('https://x', { apiKey: 'k', body: {}, timeoutMs: 1000, onDelta: (t) => seen.push(t) });

    expect(seen).toEqual(['целое']);
  });

  it('handles several frames arriving in one chunk', async () => {
    stubStream([delta('a') + delta('b') + completed({})]);
    const seen: string[] = [];

    await providerStream('https://x', { apiKey: 'k', body: {}, timeoutMs: 1000, onDelta: (t) => seen.push(t) });

    expect(seen).toEqual(['a', 'b']);
  });

  it('ignores [DONE] and any frame it cannot parse', async () => {
    stubStream([`data: [DONE]\n\n`, `data: {not json\n\n`, delta('ок'), completed({})]);
    const seen: string[] = [];

    await expect(
      providerStream('https://x', { apiKey: 'k', body: {}, timeoutMs: 1000, onDelta: (t) => seen.push(t) }),
    ).resolves.toBeDefined();
    expect(seen).toEqual(['ок']);
  });

  it('fails loudly when the stream ends without a completed response', async () => {
    // Half an answer must not be returned as if it were whole.
    stubStream([delta('обрыв')]);

    await expect(
      providerStream('https://x', { apiKey: 'k', body: {}, timeoutMs: 1000, onDelta: () => {} }),
    ).rejects.toThrow(/completed/i);
  });

  it('marks a terminal provider failure, and does not retry', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 401, body: null, text: async () => 'invalid key',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await providerStream('https://x', {
      apiKey: 'k', body: {}, timeoutMs: 1000, onDelta: () => {},
    }).catch((e) => e);

    expect(isProviderUnavailableError(error)).toBe(true);
    // Retrying a stream would replay text the user already read.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
