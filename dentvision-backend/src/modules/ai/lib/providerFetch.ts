/**
 * One place that knows how to talk to the model provider over HTTP.
 *
 * Before this there were no retries anywhere: a single 429 or a momentary 503
 * surfaced to the user as a failed assistant, and the caller fell through to
 * the deterministic router — which, on a rate limit, meant the user waited out
 * two round-trips to be told nothing useful.
 *
 * Retrying is not always right, which is why the classification lives here
 * too. A 401, a revoked key or an exhausted balance will fail identically on
 * every attempt; retrying those just multiplies the latency of a certain
 * failure.
 */

export interface ProviderError extends Error {
  providerUnavailable?: boolean;
  status?: number;
}

/**
 * Terminal: retrying cannot fix it.
 *
 * 429 is deliberately split — it means both "slow down" (retryable) and "no
 * credits left" (terminal), and treating the second as the first is how a dead
 * account turns into a minute of backoff on every request.
 */
export function isProviderUnavailable(status: number, detail: string): boolean {
  if (status === 401 || status === 403) return true;
  if (status !== 429) return false;
  return /insufficient_quota|credit_balance_exhausted|billing|no credits/i.test(detail);
}

export function isProviderUnavailableError(error: unknown): boolean {
  return Boolean(error && (error as ProviderError).providerUnavailable);
}

export interface ProviderFetchOptions {
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  /** Total attempts including the first. 1 disables retrying. */
  attempts?: number;
  /** Injectable for tests; defaults to a real sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `Retry-After` in seconds or as an HTTP date; null when absent or nonsense. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_DELAY_MS);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.min(date - now, MAX_DELAY_MS));
}

/**
 * Exponential with full jitter.
 *
 * Jitter is not decoration: without it every request rate-limited in the same
 * second retries in the same later second, and the clinic hits the same wall
 * together instead of spreading out.
 */
export function backoffDelay(attempt: number, random = Math.random): number {
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return Math.round(random() * ceiling);
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

/**
 * POST to the provider, retrying what is worth retrying.
 *
 * Returns the parsed body on success. Throws a `ProviderError` carrying
 * `status` and, for terminal failures, `providerUnavailable` so callers can
 * short-circuit instead of falling through to another doomed path.
 */
export async function providerFetch<T>(url: string, opts: ProviderFetchOptions): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? DEFAULT_ATTEMPTS);
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(opts.body),
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (networkError) {
      // A timeout or a dropped connection says nothing about the request
      // itself, so it is worth one more try.
      lastError = networkError as ProviderError;
      if (attempt === attempts - 1) break;
      await sleep(backoffDelay(attempt));
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const detail = await res.text().catch(() => '');
    const error: ProviderError = new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
    error.status = res.status;

    if (isProviderUnavailable(res.status, detail)) {
      error.providerUnavailable = true;
      throw error;
    }
    if (!retryableStatus(res.status) || attempt === attempts - 1) throw error;

    lastError = error;
    // The provider's own instruction wins over our guess when it gives one.
    await sleep(parseRetryAfter(res.headers.get('retry-after')) ?? backoffDelay(attempt));
  }

  throw lastError ?? new Error('Provider request failed');
}

/* ── streaming ─────────────────────────────────────────────────────────── */

export interface ProviderStreamOptions extends Omit<ProviderFetchOptions, 'attempts'> {
  /** Called for every text fragment as the model produces it. */
  onDelta: (text: string) => void;
}

/**
 * Same request, but read as it arrives.
 *
 * Deliberately **not** retried. Once a byte has been forwarded to the user's
 * screen a second attempt would duplicate what they already read; a stream
 * that dies mid-answer is the caller's problem to surface, not something to
 * paper over. The non-streaming path keeps its retries.
 *
 * Returns the completed response object, so the tool loop that consumes it
 * does not have to care whether the answer arrived at once or in pieces.
 */
export async function providerStream<T>(url: string, opts: ProviderStreamOptions): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...(opts.body as Record<string, unknown>), stream: true }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    const error: ProviderError = new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
    error.status = res.status;
    if (isProviderUnavailable(res.status, detail)) error.providerUnavailable = true;
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed: T | null = null;

  // SSE frames are separated by a blank line and can be split across chunks,
  // so the tail of the buffer is kept until its terminator actually arrives.
  const drain = (flush = false) => {
    let index: number;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      handleFrame(frame);
    }
    if (flush && buffer.trim()) {
      handleFrame(buffer);
      buffer = '';
    }
  };

  const handleFrame = (frame: string) => {
    for (const line of frame.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let event: { type?: string; delta?: string; response?: unknown };
      try {
        event = JSON.parse(payload);
      } catch {
        continue; // a frame we cannot read is not worth failing the answer over
      }
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        opts.onDelta(event.delta);
      } else if (event.type === 'response.completed' && event.response) {
        completed = event.response as T;
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    drain();
  }
  buffer += decoder.decode();
  drain(true);

  if (!completed) throw new Error('Provider stream ended without a completed response');
  return completed;
}
