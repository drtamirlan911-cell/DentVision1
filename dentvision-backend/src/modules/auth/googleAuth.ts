/**
 * Google sign-in — verification of the ID token the browser hands us.
 *
 * This is the ID-token flow, not an OAuth redirect: the Google button in the
 * browser produces a signed JWT, and this module decides whether to believe it.
 * That choice buys us no client secret to leak, no `state`/PKCE to get wrong,
 * and no need to hand our own tokens across the Vercel↔Render origin boundary,
 * which is the awkward part of a redirect flow.
 *
 * Verification is delegated to `google-auth-library` rather than hand-rolled on
 * top of `jsonwebtoken`. The four things a hand-rolled version tends to miss —
 * fetching the right key by `kid`, surviving Google's key rotation, checking
 * `aud` against *our* client id, and checking `iss` — are exactly the four that
 * turn "verified" into "anyone can mint one".
 */

import { OAuth2Client } from 'google-auth-library';

import { env } from '../../config.js';

export interface GoogleProfile {
  /** Google's stable subject id — the identity, as opposed to the address. */
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  picture?: string;
}

export class GoogleAuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

/** Configured? With no client id the feature is off and the route says so. */
export function googleSignInEnabled(): boolean {
  return !!env.GOOGLE_CLIENT_ID;
}

let client: OAuth2Client | null = null;
function oauthClient(): OAuth2Client {
  if (!client) {
    // `GOOGLE_CERTS_URL` points the verifier at a JWKS we control, so the whole
    // sign-in route can be driven against a real running server without a real
    // Google account. Ignored outside development on purpose: honouring it in
    // production would let anyone who can set an environment variable supply
    // their own signing keys, which is the entire trust anchor.
    // Both endpoints, because which one is used depends on the runtime:
    // `getFederatedSignonCertsAsync` picks JWK only when browser crypto is
    // present and PEM otherwise — so on Node it is the PEM URL that matters,
    // and overriding the JWK one alone would have had no effect at all.
    const endpoints =
      env.NODE_ENV !== 'production' && env.GOOGLE_CERTS_URL
        ? {
            oauth2FederatedSignonPemCertsUrl: env.GOOGLE_CERTS_URL,
            oauth2FederatedSignonJwkCertsUrl: env.GOOGLE_CERTS_URL,
          }
        : undefined;
    client = new OAuth2Client({ clientId: env.GOOGLE_CLIENT_ID, ...(endpoints ? { endpoints } : {}) });
  }
  return client;
}

/** Test seam: drop the cached client so a changed environment takes effect. */
export function resetGoogleClient(): void {
  client = null;
}

/**
 * Verify an ID token and return the profile it asserts.
 *
 * Throws `GoogleAuthError` for anything that is not a token this deployment
 * should accept — a bad signature, an expired token, or one minted for a
 * different application.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!googleSignInEnabled()) {
    throw new GoogleAuthError('Вход через Google не настроен', 503);
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new GoogleAuthError('Токен Google обязателен', 400);
  }

  let payload;
  try {
    // `audience` is the check that matters most: without it a token minted for
    // any other Google application would verify here just as well.
    const ticket = await oauthClient().verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    throw new GoogleAuthError(`Не удалось проверить вход через Google: ${(error as Error).message}`);
  }

  if (!payload?.email) {
    throw new GoogleAuthError('Google не вернул адрес электронной почты');
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    // Google sends this as a boolean, but the claim is absent for some account
    // types; anything other than an explicit `true` is treated as unverified.
    emailVerified: payload.email_verified === true,
    firstName: (payload.given_name || '').trim(),
    lastName: (payload.family_name || '').trim(),
    picture: payload.picture,
  };
}

/**
 * A display name for an account created from a Google profile.
 *
 * Google does not always send `given_name`/`family_name` — a single-word
 * profile name, or none at all, is common — and both columns are required, so a
 * blank one would fail the insert.
 */
export function namesFromProfile(profile: GoogleProfile): { firstName: string; lastName: string } {
  const first = profile.firstName || profile.email.split('@')[0] || 'Пользователь';
  return { firstName: first, lastName: profile.lastName || '' };
}
