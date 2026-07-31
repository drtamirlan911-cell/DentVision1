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
  '/api/public/',
  '/api/guest/',
  '/api/health',
  '/api/diagnostics/register',
];
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (SKIP_PATHS.some((p) => req.path.startsWith(p))) return next();
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
