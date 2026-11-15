import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendInstagram } from './instagram.sender.js';

afterEach(() => vi.unstubAllGlobals());

describe('Instagram sender error privacy', () => {
  it('does not expose the provider response body in the thrown error', async () => {
    const sensitiveDetail = 'recipient=private-account private message body';
    const responseText = vi.fn().mockResolvedValue(sensitiveDetail);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: responseText }));

    let failure: unknown;
    try {
      await sendInstagram({
        externalUserId: 'private-account',
        text: 'private patient update',
        accessToken: 'test-token',
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Instagram send failed with HTTP 403');
    expect((failure as Error).message).not.toContain(sensitiveDetail);
    expect(responseText).not.toHaveBeenCalled();
  });
});
