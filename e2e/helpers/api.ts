import { APIRequestContext, APIResponse, request } from '@playwright/test';

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

let _api: APIRequestContext | null = null;

export async function api(): Promise<APIRequestContext> {
  if (!_api) {
    _api = await request.newContext({ baseURL: BASE_URL });
  }
  return _api;
}

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  const ctx = await api();
  const res = await ctx.post('/api/auth/login', {
    data: { email, password },
  });

  if (!res.ok()) {
    throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`);
  }

  const body = await res.json();
  return body.data || body;
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function makeRequest(
  method: string,
  path: string,
  options: {
    token?: string;
    data?: unknown;
    params?: Record<string, string>;
  } = {},
): Promise<any> {
  const ctx = await api();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const url = new URL(path, BASE_URL);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await ctx.fetch(url.toString(), {
    method: method.toUpperCase(),
    headers,
    data: options.data,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok()) {
    const err: any = new Error(
      `${method.toUpperCase()} ${path} failed: ${res.status()} ${JSON.stringify(body)}`,
    );
    err.status = res.status();
    err.body = body;
    throw err;
  }

  return body?.data ?? body;
}

/**
 * The payload, with the envelope taken off.
 *
 * Every route answers `{ ok, data }` on success and `{ ok, error }` on failure,
 * but most specs were written against a bare body — `body.id`, `body.firstName`
 * — so the id they captured was `undefined` and every request that used it came
 * back 404. That cascade accounted for most of the suite's failures.
 *
 * Only a success envelope is unwrapped. An error response has no `data` and is
 * returned whole, because the specs assert on `error` and on nothing else.
 */
export async function payload(res: APIResponse): Promise<any> {
  const parsed = await res.json().catch(() => null);
  if (parsed && typeof parsed === 'object' && 'ok' in parsed && 'data' in parsed) {
    return (parsed as { data: unknown }).data;
  }
  return parsed;
}
