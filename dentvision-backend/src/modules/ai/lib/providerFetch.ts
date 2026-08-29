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
