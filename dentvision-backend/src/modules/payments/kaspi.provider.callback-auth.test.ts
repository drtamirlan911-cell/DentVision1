import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', () => ({
  env: {
    KASPI_CALLBACK_SECRET: 'test-kaspi-callback-secret-32-chars-long',
    KASPI_PAY_BASE_URL: 'https://pay.kaspi.kz/pay',
    KASPI_MERCHANT_ID: undefined,
    KASPI_API_KEY: undefined,
    FRONTEND_URL: 'https://dentvision.app',
  },
}));

import { verifyKaspiCallbackAuth } from './kaspi.provider.js';

const externalId = 'kaspi-test-payment';
const status = 'paid';
const secret = 'test-kaspi-callback-secret-32-chars-long';
const signature = createHmac('sha256', secret).update(`${externalId}:${status}`).digest('hex');

describe('verifyKaspiCallbackAuth', () => {
  it('accepts the expected HMAC signature', () => {
    expect(verifyKaspiCallbackAuth({
      headers: { 'x-kaspi-signature': signature },
      body: { externalId, status },
    })).toEqual({ ok: true });
  });

  it('rejects the raw shared secret even when it is otherwise correct', () => {
    expect(verifyKaspiCallbackAuth({
      headers: { 'x-kaspi-signature': secret },
      body: { externalId, status },
    })).toEqual({ ok: false, error: 'Неверная подпись callback' });
  });

  it('rejects a signature for a different payment or status', () => {
    expect(verifyKaspiCallbackAuth({
      headers: { 'x-kaspi-signature': signature },
      body: { externalId: 'different-payment', status },
    })).toEqual({ ok: false, error: 'Неверная подпись callback' });
  });
});
