/**
 * Per-clinic Kaspi / bank payment config.
 *
 * CRM cashier payments settle on the clinic's own merchant account —
 * never on DentVision platform Kaspi (that is for Academy / Shop / SaaS only).
 */

import { randomUUID } from 'node:crypto';
import { env } from '../../config.js';
import prisma from '../../lib/prisma.js';
import { minorToTenge } from '../../lib/money.js';

export type ClinicPayMode = 'unconfigured' | 'static' | 'api';

export interface ClinicPaymentsConfig {
  mode: ClinicPayMode;
  /** Display name on the QR panel (clinic brand). */
  merchantName?: string;
  /** Kaspi business phone for transfers (static mode). */
  kaspiPhone?: string;
  /** Pre-made Kaspi pay link / QR payload (static mode). */
  staticQrUrl?: string;
  /** Optional gateway base URL (api mode), e.g. https://api.apipay.kz/api/v1 */
  apiBaseUrl?: string;
  /** Write-only secret — never return to clients in clear text. */
  apiKey?: string;
  /** Write-only webhook HMAC secret for clinic callback URL. */
  webhookSecret?: string;
}

export interface ClinicPaymentsPublic extends Omit<ClinicPaymentsConfig, 'apiKey' | 'webhookSecret'> {
  configured: boolean;
  apiKeySet: boolean;
  webhookSecretSet: boolean;
  /** Public callback URL to paste into clinic Kaspi / gateway cabinet. */
  webhookUrl?: string;
}

export const DEFAULT_CLINIC_PAYMENTS: ClinicPaymentsConfig = {
  mode: 'unconfigured',
  merchantName: '',
  kaspiPhone: '',
  staticQrUrl: '',
  apiBaseUrl: '',
  apiKey: '',
  webhookSecret: '',
};

export function readClinicPayments(rawSettings: unknown): ClinicPaymentsConfig {
  const settings = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
  const p = settings.payments && typeof settings.payments === 'object'
    ? (settings.payments as Record<string, unknown>)
    : {};
  const modeRaw = String(p.mode || 'unconfigured');
  const mode: ClinicPayMode =
    modeRaw === 'static' || modeRaw === 'api' ? modeRaw : 'unconfigured';
  return {
    mode,
    merchantName: String(p.merchantName || ''),
    kaspiPhone: String(p.kaspiPhone || '').replace(/\s+/g, ''),
    staticQrUrl: String(p.staticQrUrl || ''),
    apiBaseUrl: String(p.apiBaseUrl || '').replace(/\/$/, ''),
    apiKey: String(p.apiKey || ''),
    webhookSecret: String(p.webhookSecret || ''),
  };
}

/** Merge payments block; blank secret fields keep previous values. */
export function mergeClinicPayments(
  existingRaw: unknown,
  incoming: Partial<ClinicPaymentsConfig> | undefined,
): ClinicPaymentsConfig {
  const prev = readClinicPayments(existingRaw);
  if (!incoming || typeof incoming !== 'object') return prev;
  const next: ClinicPaymentsConfig = {
    ...prev,
    ...incoming,
    mode: (incoming.mode as ClinicPayMode) || prev.mode,
  };
  // Empty string from UI means "leave unchanged" for secrets
  if (!incoming.apiKey) next.apiKey = prev.apiKey;
  if (!incoming.webhookSecret) next.webhookSecret = prev.webhookSecret;
  if (incoming.apiKey === '__clear__') next.apiKey = '';
  if (incoming.webhookSecret === '__clear__') next.webhookSecret = '';
  return next;
}

export function isClinicPaymentsConfigured(cfg: ClinicPaymentsConfig): boolean {
  if (cfg.mode === 'static') {
    return Boolean(cfg.kaspiPhone?.trim() || cfg.staticQrUrl?.trim());
  }
  if (cfg.mode === 'api') {
    return Boolean(cfg.apiBaseUrl?.trim() && cfg.apiKey?.trim());
  }
  return false;
}

export function publicClinicPayments(
  cfg: ClinicPaymentsConfig,
  clinicId?: string,
): ClinicPaymentsPublic {
  const base =
    env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    (env.NODE_ENV === 'production' ? 'https://dentvision-api.onrender.com' : `http://localhost:${env.PORT}`);
  // Prefer API host for webhook — callers should use the API origin.
  const apiHost =
    env.PUBLIC_API_URL ||
    (env.NODE_ENV === 'production' ? 'https://dentvision-api.onrender.com' : `http://localhost:${env.PORT}`);
  void base;
  return {
    mode: cfg.mode,
    merchantName: cfg.merchantName || '',
    kaspiPhone: cfg.kaspiPhone || '',
    staticQrUrl: cfg.staticQrUrl || '',
    apiBaseUrl: cfg.apiBaseUrl || '',
    configured: isClinicPaymentsConfigured(cfg),
    apiKeySet: Boolean(cfg.apiKey),
    webhookSecretSet: Boolean(cfg.webhookSecret && cfg.webhookSecret.length >= 16),
    webhookUrl: clinicId ? `${apiHost.replace(/\/$/, '')}/api/payments/callbacks/kaspi/clinic/${clinicId}` : undefined,
  };
}

export function normalizeKaspiPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) return `7${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 11) return digits;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

/** Static pay payload shown as QR — money goes to clinic Kaspi, not platform. */
export function buildClinicStaticQr(input: {
  cfg: ClinicPaymentsConfig;
  amountMinor: bigint;
  externalId: string;
  clinicId: string;
}): string {
  if (input.cfg.staticQrUrl?.trim()) {
    const url = input.cfg.staticQrUrl.trim();
    // If clinic pasted a full pay link, append amount when possible
    try {
      const u = new URL(url);
      if (!u.searchParams.has('amount')) {
        u.searchParams.set('amount', String(minorToTenge(input.amountMinor)));
      }
      u.searchParams.set('ref', input.externalId);
      return u.toString();
    } catch {
      return url;
    }
  }
  const phone = normalizeKaspiPhone(input.cfg.kaspiPhone || '');
  const amountTenge = minorToTenge(input.amountMinor);
  // Deep-link style payload for QR — patient opens Kaspi / transfer to clinic phone.
  // When clinic switches to API mode, this is replaced by gateway qr_token / deep_link.
  return `https://kaspi.kz/pay/${phone}?amount=${amountTenge}&ref=${encodeURIComponent(input.externalId)}&clinic=${encodeURIComponent(input.clinicId)}`;
}

export class ClinicPaymentsError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'CLINIC_PAYMENTS') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function loadClinicPaymentsConfig(clinicId: string): Promise<{
  clinic: { id: string; name: string };
  cfg: ClinicPaymentsConfig;
}> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, settings: true },
  });
  if (!clinic) {
    throw new ClinicPaymentsError('Клиника не найдена', 404, 'CLINIC_NOT_FOUND');
  }
  return { clinic, cfg: readClinicPayments(clinic.settings) };
}

/**
 * Create a Kaspi QR payment that settles on the clinic merchant.
 * Does NOT use platform KASPI_* credentials.
 */
export async function createClinicKaspiPayment(input: {
  clinicId: string;
  amountMinor: bigint;
  refId?: string | null;
  comment?: string;
}): Promise<{ externalId: string; qr: string; provider: string; mode: ClinicPayMode }> {
  const { clinic, cfg } = await loadClinicPaymentsConfig(input.clinicId);
  if (!isClinicPaymentsConfigured(cfg)) {
    throw new ClinicPaymentsError(
      'Касса клиники не подключена к своему Kaspi/банку. Руководитель: Настройки клиники → Оплата на кассе.',
      409,
      'CLINIC_KASPI_NOT_CONFIGURED',
    );
  }

  if (cfg.mode === 'api') {
    const created = await createViaClinicGateway({
      cfg,
      amountMinor: input.amountMinor,
      refId: input.refId,
      comment: input.comment || clinic.name,
      clinicId: clinic.id,
    });
    return { ...created, provider: 'clinic_kaspi', mode: 'api' };
  }

  // static mode
  const externalId = `clinic_${clinic.id.slice(0, 8)}_${randomUUID()}`;
  const qr = buildClinicStaticQr({
    cfg,
    amountMinor: input.amountMinor,
    externalId,
    clinicId: clinic.id,
  });
  return { externalId, qr, provider: 'clinic_kaspi', mode: 'static' };
}

async function createViaClinicGateway(input: {
  cfg: ClinicPaymentsConfig;
  amountMinor: bigint;
  refId?: string | null;
  comment: string;
  clinicId: string;
}): Promise<{ externalId: string; qr: string }> {
  const amountTenge = Math.round(Number(input.amountMinor) / 100);
  const base = input.cfg.apiBaseUrl!.replace(/\/$/, '');
  const key = input.cfg.apiKey!;

  // Compatible with common KZ Kaspi bridges (ApiPay-style /invoices/qr).
  // Clinics can point apiBaseUrl at their chosen gateway.
  const endpoints = [`${base}/invoices/qr`, `${base}/qr`, `${base}/v2/qr`];
  let lastError = 'Gateway не ответил';

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key,
          Authorization: `Bearer ${key}`,
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          amount: amountTenge,
          comment: input.comment.slice(0, 255),
          external_id: input.refId || undefined,
          clinic_id: input.clinicId,
        }),
      });
      const raw: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = String(raw?.error || raw?.message || `HTTP ${res.status}`);
        continue;
      }
      const data: any = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
      const externalId = String(
        data.id || data.invoice_id || data.operation_id || data.externalId || randomUUID(),
      );
      const qr = String(
        data.qr ||
          data.qr_url ||
          data.qrUrl ||
          data.deep_link ||
          data.deepLink ||
          data.qr_token ||
          data.payment_url ||
          '',
      );
      if (!qr) {
        lastError = 'Gateway не вернул QR / deep_link';
        continue;
      }
      return { externalId, qr };
    } catch (e: any) {
      lastError = e?.message || 'Ошибка сети gateway';
    }
  }

  throw new ClinicPaymentsError(
    `Не удалось создать QR через API клиники: ${lastError}`,
    502,
    'CLINIC_GATEWAY_ERROR',
  );
}

export async function getClinicGatewayStatus(
  clinicId: string,
  externalId: string,
): Promise<'pending' | 'paid' | 'failed' | 'expired'> {
  const { cfg } = await loadClinicPaymentsConfig(clinicId);
  if (cfg.mode !== 'api' || !cfg.apiBaseUrl || !cfg.apiKey) {
    return 'pending';
  }
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const urls = [
    `${base}/invoices/${encodeURIComponent(externalId)}`,
    `${base}/operations/${encodeURIComponent(externalId)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'X-API-Key': cfg.apiKey,
          Authorization: `Bearer ${cfg.apiKey}`,
        },
      });
      if (!res.ok) continue;
      const raw: any = await res.json().catch(() => ({}));
      const data: any = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
      const status = String(data.status || data.payment_status || data.state || '').toLowerCase();
      if (['paid', 'success', 'processed', 'completed', 'done'].includes(status)) return 'paid';
      if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
      if (['expired', 'timeout'].includes(status)) return 'expired';
      return 'pending';
    } catch {
      /* try next */
    }
  }
  return 'pending';
}
