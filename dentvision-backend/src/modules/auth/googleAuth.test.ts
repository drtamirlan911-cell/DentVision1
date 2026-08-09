import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken, envMock } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  envMock: {
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    NODE_ENV: 'development',
    GOOGLE_CERTS_URL: undefined,
  } as { GOOGLE_CLIENT_ID?: string; NODE_ENV?: string; GOOGLE_CERTS_URL?: string },
}));

const { constructed } = vi.hoisted(() => ({ constructed: [] as any[] }));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
    constructor(options: unknown) { constructed.push(options); }
  },
}));
vi.mock('../../config.js', () => ({ env: envMock }));

import {
  GoogleAuthError,
  googleSignInEnabled,
  namesFromProfile,
  resetGoogleClient,
  verifyGoogleIdToken,
} from './googleAuth.js';

/** What Google's payload looks like for an ordinary Gmail account. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    sub: '1122334455',
    email: 'Patient@Gmail.com',
    email_verified: true,
    given_name: 'Асель',
    family_name: 'Нурлановна',
    picture: 'https://lh3.googleusercontent.com/a/abc',
    ...overrides,
  };
}

beforeEach(() => {
  verifyIdToken.mockReset();
  constructed.length = 0;
  resetGoogleClient();
  envMock.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  envMock.NODE_ENV = 'development';
  envMock.GOOGLE_CERTS_URL = undefined;
  verifyIdToken.mockResolvedValue({ getPayload: () => payload() });
});

describe('googleSignInEnabled', () => {
  it('is off until a client id exists', () => {
    envMock.GOOGLE_CLIENT_ID = undefined;
    expect(googleSignInEnabled()).toBe(false);
  });

  it('is on once one does', () => {
    expect(googleSignInEnabled()).toBe(true);
  });
});

describe('verifyGoogleIdToken', () => {
  it('checks the token against *our* client id', async () => {
    // Without an audience check, a token minted for any other Google
    // application would verify here just as well — this is the assertion that
    // separates "signed by Google" from "meant for us".
    await verifyGoogleIdToken('token');

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'token',
      audience: 'test-client-id.apps.googleusercontent.com',
    });
  });

  it('normalises the address, because ours are stored lower-case', async () => {
    const profile = await verifyGoogleIdToken('token');
    expect(profile.email).toBe('patient@gmail.com');
  });

  it('carries the subject id, not just the address', async () => {
    // The address can be reassigned inside a Workspace domain; `sub` cannot.
    const profile = await verifyGoogleIdToken('token');
    expect(profile.googleId).toBe('1122334455');
  });

  it('reports an unverified address as unverified', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email_verified: false }) });
    expect((await verifyGoogleIdToken('token')).emailVerified).toBe(false);
  });

  it('treats a missing verification claim as unverified, not as verified', async () => {
    // Some account types omit it. Defaulting to "verified" would be an
    // account-takeover path by email.
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email_verified: undefined }) });
    expect((await verifyGoogleIdToken('token')).emailVerified).toBe(false);
  });

  it('refuses a token Google will not vouch for', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token signature'));
    await expect(verifyGoogleIdToken('forged')).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('refuses a payload with no address at all', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email: undefined }) });
    await expect(verifyGoogleIdToken('token')).rejects.toMatchObject({ status: 401 });
  });

  it('answers 503, not 401, when the feature is simply not configured', async () => {
    // "Not set up" is an operator problem; reporting it as a rejected sign-in
    // would send someone hunting for a problem with their Google account.
    envMock.GOOGLE_CLIENT_ID = undefined;
    await expect(verifyGoogleIdToken('token')).rejects.toMatchObject({ status: 503 });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects an empty token before calling out', async () => {
    await expect(verifyGoogleIdToken('')).rejects.toMatchObject({ status: 400 });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});

describe('namesFromProfile', () => {
  it('keeps the names Google sent', () => {
    expect(namesFromProfile({
      googleId: '1', email: 'a@b.kz', emailVerified: true, firstName: 'Асель', lastName: 'Н',
    })).toEqual({ firstName: 'Асель', lastName: 'Н' });
  });

  it('falls back to the address when Google sends no given name', () => {
    // Both columns are required, so a blank first name would fail the insert.
    expect(namesFromProfile({
      googleId: '1', email: 'asel@b.kz', emailVerified: true, firstName: '', lastName: '',
    })).toEqual({ firstName: 'asel', lastName: '' });
  });
});

describe('the development-only certificate override', () => {
  it('is honoured outside production, so the route is testable against a local key', async () => {
    envMock.GOOGLE_CERTS_URL = 'http://127.0.0.1:2600/';
    await verifyGoogleIdToken('token');
    // Both, because the library picks PEM on Node and JWK in a browser —
    // overriding only one would silently do nothing on the server.
    expect(constructed[0]).toMatchObject({
      endpoints: {
        oauth2FederatedSignonPemCertsUrl: 'http://127.0.0.1:2600/',
        oauth2FederatedSignonJwkCertsUrl: 'http://127.0.0.1:2600/',
      },
    });
  });

  it('is ignored in production — the signing keys are the whole trust anchor', async () => {
    // Honouring this in production would let anyone who can set an environment
    // variable supply their own keys and mint valid sign-ins.
    envMock.NODE_ENV = 'production';
    envMock.GOOGLE_CERTS_URL = 'http://attacker.example/keys';
    await verifyGoogleIdToken('token');
    expect(constructed[0]).not.toHaveProperty('endpoints');
  });
});
