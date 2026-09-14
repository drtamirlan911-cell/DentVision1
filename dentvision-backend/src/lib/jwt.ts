import jwt from 'jsonwebtoken';
import { env } from '../config.js';
import type { JwtPayload } from '../types/index.js';

/**
 * Protected user tokens must always be bound to a server-side session.
 * Guest/public tokens are the only exception because they intentionally have
 * no user session and are rejected by protected-route session checks anyway.
 *
 * Keeping this invariant at the signing boundary prevents auth routes from
 * accidentally issuing a JWT with `sessionId: undefined` when session creation
 * fails. Such a token would look valid cryptographically but could never pass
 * the session-enforcing authentication middleware.
 */
export function generateTokens(payload: JwtPayload) {
  if (!payload.isGuest && !payload.sessionId) {
    throw new Error('AUTH_SESSION_REQUIRED');
  }

  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
}
