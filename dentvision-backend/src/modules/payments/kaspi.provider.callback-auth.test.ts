import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', () => ({
  env: {
    KASPI_CALLBACK_SECRET: 'test-kaspi-callback-secret-32-chars-long',
    KASPI_PAY_BASE_URL: 'https://pay.kaspi.kz/pay',
    KASPI_MERCHANT_ID: undefined,
    KASPI_API_KEY: undefined,
    KASPI_API_BASE_URL: 'https://pay.kaspi.kz',
    NODE_ENV: 'test',
    FRONTEND_URL: 'https://dentvision.app',
  },
}));

import { kaspiProvider, verifyKaspiCallbackAuth } from './kaspi.provider.js';
import { env } from '../../config.js';

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


describe('Kaspi production callback and provider configuration', () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalMerchantId = env.KASPI_MERCHANT_ID;
  const originalApiKey = env.KASPI_API_KEY;
  const originalCallbackSecret = env.KASPI_CALLBACK_SECRET;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    env.KASPI_MERCHANT_ID = originalMerchantId;
    env.KASPI_API_KEY = originalApiKey;
    env.KASPI_CALLBACK_SECRET = originalCallbackSecret;
  });

  it.each(['short', 'a'.repeat(31)])('rejects callback secrets shorter than 32 characters (%s)', (secretValue) => {
    env.KASPI_CALLBACK_SECRET = secretValue === 'short' ? 'short' : secretValue;
    expect(verifyKaspiCallbackAuth({
      headers: { 'x-kaspi-signature': 'irrelevant' },
      body: { externalId, status },
    })).toEqual({
      ok: false,
      error: 'KASPI_CALLBACK_SECRET не настроен или короче 32 символов — callback оплаты отклонён',
    });
  });

  it('refuses mock payment creation in production when merchant credentials are missing', async () => {
    env.NODE_ENV = 'production';
    env.KASPI_MERCHANT_ID = undefined;
    env.KASPI_API_KEY = undefined;
    await expect(kaspiProvider.createPayment({ amountMinor: 1000n }))
      .rejects.toThrow(/require KASPI_MERCHANT_ID and KASPI_API_KEY/);
  });
});
