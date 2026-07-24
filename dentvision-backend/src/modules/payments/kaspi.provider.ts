import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { env } from '../../config.js';

// Payment provider abstraction. Real Kaspi QR implements the same interface;
// mock is used until merchant credentials are configured.

export interface PaymentProvider {
  name: string;
  createPayment(input: { amountMinor: bigint; refId?: string | null }): Promise<{
    externalId: string;
    qr: string;
  }>;
  /** Provider-side status check (pending | paid | failed | expired). */
  getPaymentStatus(externalId: string): Promise<'pending' | 'paid' | 'failed' | 'expired'>;
}

/** In-memory mock ledger — only webhook with valid secret can mark paid. */
const mockLedger = new Map<string, 'pending' | 'paid' | 'failed' | 'expired'>();

export function buildKaspiPayUrl(input: {
  externalId: string;
  amountMinor?: bigint | number | string | null;
  refId?: string | null;
}): string {
  const base = (env.KASPI_PAY_BASE_URL || 'https://pay.dentvision.app/qr').replace(/\/$/, '');
  const amount =
    input.amountMinor == null || input.amountMinor === ''
      ? null
      : String(input.amountMinor);
  const qs = new URLSearchParams();
  if (amount) qs.set('amount', amount);
  if (input.refId) qs.set('ref', String(input.refId));
  const q = qs.toString();
  return `${base}/${input.externalId}${q ? `?${q}` : ''}`;
}

/** Attach top-level qr/qrUrl for API clients (reads meta.qr or rebuilds from externalId). */
export function withPaymentQr<T extends Record<string, unknown>>(
  payment: T,
  qr?: string | null,
): T & { qr: string | null; qrUrl: string | null } {
  const meta = (payment as { meta?: { qr?: string } }).meta;
  const externalId = (payment as { externalId?: string | null }).externalId;
  const amount = (payment as { amount?: bigint | number | string }).amount;
  const refId = (payment as { refId?: string | null }).refId;
  const resolved =
    (typeof qr === 'string' && qr.trim()) ||
    (typeof meta?.qr === 'string' && meta.qr.trim()) ||
    (externalId
      ? buildKaspiPayUrl({ externalId, amountMinor: amount ?? null, refId })
      : null);
  return { ...payment, qr: resolved, qrUrl: resolved };
}

export const kaspiProvider: PaymentProvider = {
  name: 'kaspi_qr',
  async createPayment({ amountMinor, refId }) {
    const externalId = `kaspi_${randomUUID()}`;
    mockLedger.set(externalId, 'pending');
    // Production: call payment provider API with merchant token and return real QR/deeplink.
    const qr = buildKaspiPayUrl({ externalId, amountMinor, refId });
    return { externalId, qr };
  },
  async getPaymentStatus(externalId) {
    // Production: GET merchant status API. Mock only knows what webhook set.
    return mockLedger.get(externalId) || 'pending';
  },
};

/** Mark mock payment paid — only callable after callback auth succeeds. */
export function markMockPaymentStatus(
  externalId: string,
  status: 'pending' | 'paid' | 'failed' | 'expired',
): void {
  mockLedger.set(externalId, status);
}

export const providers: Record<string, PaymentProvider> = {
  kaspi_qr: kaspiProvider,
};

/**
 * Verify Kaspi (or sandbox) webhook authenticity.
 * Requires KASPI_CALLBACK_SECRET — unsigned paid callbacks are rejected.
 */
export function verifyKaspiCallbackAuth(input: {
  headers: Record<string, string | string[] | undefined>;
  body: { externalId?: string; status?: string; signature?: string };
}): { ok: true } | { ok: false; error: string } {
  const secret = env.KASPI_CALLBACK_SECRET;
  if (!secret || secret.length < 16) {
    return {
      ok: false,
      error: 'KASPI_CALLBACK_SECRET не настроен — callback оплаты отклонён',
    };
  }

  const headerRaw =
    input.headers['x-kaspi-signature'] ||
    input.headers['x-callback-secret'] ||
    input.headers['x-webhook-secret'];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

  // Accept either raw shared secret or HMAC(externalId:status, secret)
  const externalId = String(input.body?.externalId || '');
  const status = String(input.body?.status || '');
  const bodySig = String(input.body?.signature || '');
  const provided = String(header || bodySig || '');

  if (!provided) {
    return { ok: false, error: 'Подпись callback обязательна' };
  }

  const expectedHmac = createHmac('sha256', secret)
    .update(`${externalId}:${status}`)
    .digest('hex');

  const a = Buffer.from(provided);
  const bSecret = Buffer.from(secret);
  const bHmac = Buffer.from(expectedHmac);

  const matchSecret =
    a.length === bSecret.length && timingSafeEqual(a, bSecret);
  const matchHmac =
    a.length === bHmac.length && timingSafeEqual(a, bHmac);

  if (!matchSecret && !matchHmac) {
    return { ok: false, error: 'Неверная подпись callback' };
  }
  return { ok: true };
}
