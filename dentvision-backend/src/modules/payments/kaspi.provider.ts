import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { env } from '../../config.js';

const PROVIDER_REQUEST_TIMEOUT_MS = 8_000;
const PROVIDER_RESPONSE_LIMIT_BYTES = 64 * 1024;

async function readProviderResponse(response: Response): Promise<string> {
  const lengthHeader = response.headers.get('content-length');
  const declaredLength = lengthHeader === null ? null : Number(lengthHeader);
  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > PROVIDER_RESPONSE_LIMIT_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Kaspi API response exceeds 64 KiB limit');
  }

  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > PROVIDER_RESPONSE_LIMIT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Kaspi API response exceeds 64 KiB limit');
      }
      chunks.push(next.value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* stream may already be cancelled */ }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseProviderJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Kaspi API returned invalid JSON');
  }
}

function kaspiApiBaseUrl(): string {
  const raw = (env.KASPI_API_BASE_URL || 'https://pay.kaspi.kz').replace(/\/$/, '');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('KASPI_API_BASE_URL is invalid'); }
  if (
    (env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error('KASPI_API_BASE_URL must be a credential-free HTTPS base URL in production');
  }
  return url.toString().replace(/\/$/, '');
}

// Payment provider abstraction. Real Kaspi QR implements the same interface; mock is used until merchant credentials are configured.
export interface PaymentProvider {
  name: string;
  createPayment(input: { amountMinor: bigint; refId?: string | null }): Promise<{ externalId: string; qr: string }>;
  /** Provider-side status check (pending | paid | failed | expired). */
  getPaymentStatus(externalId: string): Promise<'pending' | 'paid' | 'failed' | 'expired'>;
}

/** In-memory mock ledger — only webhook with valid secret can mark paid. */
const mockLedger = new Map<string, 'pending' | 'paid' | 'failed' | 'expired'>();

export function buildKaspiPayUrl(input: { externalId: string; amountMinor?: bigint | number | string | null; refId?: string | null }): string {
  const base = (env.KASPI_PAY_BASE_URL || 'https://pay.kaspi.kz/pay').replace(/\/$/, '');
  const amount = input.amountMinor == null || input.amountMinor === '' ? null : String(input.amountMinor);
  const qs = new URLSearchParams();
  if (amount) qs.set('amount', amount);
  if (input.refId) qs.set('ref', String(input.refId));
  const q = qs.toString();
  return `${base}/${input.externalId}${q ? `?${q}` : ''}`;
}

/** Attach top-level qr/qrUrl for API clients (reads meta.qr or rebuilds from externalId). */
export function withPaymentQr<T extends Record<string, unknown>>(payment: T, qr?: string | null): T & { qr: string | null; qrUrl: string | null } {
  const meta = (payment as { meta?: { qr?: string } }).meta;
  const externalId = (payment as { externalId?: string | null }).externalId;
  const amount = (payment as { amount?: bigint | number | string }).amount;
  const refId = (payment as { refId?: string | null }).refId;
  const resolved = (typeof qr === 'string' && qr.trim()) || (typeof meta?.qr === 'string' && meta.qr.trim()) ||
    (externalId ? buildKaspiPayUrl({ externalId, amountMinor: amount ?? null, refId }) : null);
  return { ...payment, qr: resolved, qrUrl: resolved };
}

export const kaspiProvider: PaymentProvider = {
  name: 'kaspi_qr',
  async createPayment({ amountMinor, refId }) {
    if (!env.KASPI_MERCHANT_ID || !env.KASPI_API_KEY) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Kaspi production payments require KASPI_MERCHANT_ID and KASPI_API_KEY');
      }
      const externalId = `kaspi_${randomUUID()}`;
      mockLedger.set(externalId, 'pending');
      const qr = buildKaspiPayUrl({ externalId, amountMinor, refId });
      console.warn('[kaspi] Mock mode — set KASPI_MERCHANT_ID and KASPI_API_KEY for production');
      return { externalId, qr };
    }
    if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Kaspi payment amount is outside the supported range');
    }
    const response = await fetch(`${kaspiApiBaseUrl()}/api/v1/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.KASPI_API_KEY}`, 'X-Merchant-Id': env.KASPI_MERCHANT_ID },
      body: JSON.stringify({ merchant_id: env.KASPI_MERCHANT_ID, amount: Number(amountMinor) / 100, external_id: randomUUID(), return_url: `${env.FRONTEND_URL || 'https://dentvision.app'}/payment/success` }),
      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      // Do not reflect an arbitrary provider body into logs/API errors.
      throw new Error(`Kaspi API request failed with HTTP ${response.status}`);
    }
    const data = parseProviderJson<{ payment_id?: unknown; qr_url?: unknown }>(await readProviderResponse(response));
    if (typeof data.payment_id !== 'string' || !data.payment_id.trim() ||
        typeof data.qr_url !== 'string' || !data.qr_url.trim()) {
      throw new Error('Kaspi API response is missing payment_id or qr_url');
    }
    return { externalId: data.payment_id, qr: data.qr_url };
  },
  async getPaymentStatus(externalId) {
    if (!env.KASPI_MERCHANT_ID || !env.KASPI_API_KEY) return mockLedger.get(externalId) || 'pending';
    const response = await fetch(`${kaspiApiBaseUrl()}/api/v1/payments/${encodeURIComponent(externalId)}`, {
      headers: { 'Authorization': `Bearer ${env.KASPI_API_KEY}`, 'X-Merchant-Id': env.KASPI_MERCHANT_ID },
      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return 'pending';
    }
    const data = parseProviderJson<{ status?: unknown }>(await readProviderResponse(response));
    if (typeof data.status !== 'string') return 'pending';
    const statusMap: Record<string, 'pending' | 'paid' | 'failed' | 'expired'> = { WAIT: 'pending', PAID: 'paid', FAILED: 'failed', EXPIRED: 'expired' };
    return statusMap[data.status] || 'pending';
  },
};

/** Mark mock payment paid — only callable after callback auth succeeds. */
export function markMockPaymentStatus(externalId: string, status: 'pending' | 'paid' | 'failed' | 'expired'): void {
  mockLedger.set(externalId, status);
}

export const providers: Record<string, PaymentProvider> = { kaspi_qr: kaspiProvider };

/**
 * Verify Kaspi (or sandbox) webhook authenticity.
 * Requires KASPI_CALLBACK_SECRET — unsigned or raw-secret callbacks are rejected.
 */
export function verifyKaspiCallbackAuth(input: {
  headers: Record<string, string | string[] | undefined>;
  body: { externalId?: string; status?: string; signature?: string };
}): { ok: true } | { ok: false; error: string } {
  const secret = env.KASPI_CALLBACK_SECRET;
  if (!secret || secret.length < 32) return { ok: false, error: 'KASPI_CALLBACK_SECRET не настроен или короче 32 символов — callback оплаты отклонён' };

  const headerRaw = input.headers['x-kaspi-signature'] || input.headers['x-callback-secret'] || input.headers['x-webhook-secret'];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const externalId = String(input.body?.externalId || '');
  const status = String(input.body?.status || '');
  const bodySig = String(input.body?.signature || '');
  const provided = String(header || bodySig || '');
  if (!provided) return { ok: false, error: 'Подпись callback обязательна' };

  const expectedHmac = createHmac('sha256', secret).update(`${externalId}:${status}`).digest('hex');
  const a = Buffer.from(provided);
  const bHmac = Buffer.from(expectedHmac);
  // The shared secret itself is never accepted as a credential. A leaked secret
  // must not be sufficient to forge a callback without its message signature.
  if (a.length !== bHmac.length || !timingSafeEqual(a, bHmac)) return { ok: false, error: 'Неверная подпись callback' };
  return { ok: true };
}
