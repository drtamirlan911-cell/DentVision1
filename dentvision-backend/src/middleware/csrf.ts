import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_COOKIE = 'dv_csrf';
const CSRF_HEADER = 'x-csrf-token';

export function setCsrfCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return token;
}

const SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  // Sign-in endpoints are unauthenticated by definition: there is no session to
  // ride, and the browser has no token to send yet. `/auth/google` additionally
  // requires an ID token Google issued for our client id, which an attacker
  // would have to own outright.
  '/api/auth/google',
  '/api/public/',
  '/api/guest/',
  '/api/health',
  '/api/diagnostics/register',
];
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (SKIP_PATHS.some((p) => req.path.startsWith(p))) return next();
  // JWT Bearer auth is inherently CSRF-safe: browsers never attach an
  // Authorization header cross-site automatically. Skip double-submit CSRF
  // for token-authenticated requests (also fixes cross-origin SPA where the
  // dv_csrf cookie lives on the API domain and is unreadable by the frontend).
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return next();
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  if (!cookieToken || !headerToken) {
    res.status(403).json({ ok: false, error: 'CSRF token missing' });
    return;
  }
  if (headerToken !== cookieToken) {
    res.status(403).json({ ok: false, error: 'CSRF token mismatch' });
    return;
  }
  next();
}
