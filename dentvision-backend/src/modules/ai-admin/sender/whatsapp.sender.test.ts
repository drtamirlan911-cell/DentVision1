import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWhatsApp } from './whatsapp.sender.js';

afterEach(() => vi.unstubAllGlobals());

describe('WhatsApp sender error privacy', () => {
  it('does not expose the provider response body in the thrown error', async () => {
    const sensitiveDetail = 'recipient=77010000000 private message body';
    const responseText = vi.fn().mockResolvedValue(sensitiveDetail);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: responseText }));

    let failure: unknown;
    try {
      await sendWhatsApp({
        externalUserId: '77010000000',
        text: 'private patient update',
        accessToken: 'test-token',
        phoneNumberId: 'phone-number-1',
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('WhatsApp send failed with HTTP 400');
    expect((failure as Error).message).not.toContain(sensitiveDetail);
    expect(responseText).not.toHaveBeenCalled();
  });
});
