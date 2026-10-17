import type { Request, Response, NextFunction } from 'express';
import { env } from '../config.js';

const DEVELOPMENT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

function parseCorsOrigins(raw: string): string[] {
  const value = (raw || '').trim();
  // Empty and wildcard values must never turn credentialed CORS into allow-all.
  if (!value || value === '*') return [];
  return [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))];
}

const configured = parseCorsOrigins(
  [env.CORS_ORIGIN, env.FRONTEND_URL || ''].filter(Boolean).join(','),
);

/** Only explicitly configured origins are trusted in production. */
export function isOriginAllowed(origin: string | undefined): boolean {
  const production = env.NODE_ENV === 'production';
  if (!origin) return !production;
  if (configured.includes(origin)) return true;
  if (production) {
    const teamSlug = process.env.VERCEL_TEAM_SLUG?.trim().toLowerCase();
    if (!teamSlug || !/^[a-z0-9-]+$/.test(teamSlug)) return false;
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return host.endsWith(`-${teamSlug}.vercel.app`) &&
        host.length > teamSlug.length + '.vercel.app'.length + 1;
    } catch {
      return false;
    }
  }
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'http:' && DEVELOPMENT_ALLOWED_ORIGINS.includes(origin)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Attach ACAO on any response (errors, 429, 402) so browsers don't mask the real status. */
export function applyCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;
  if (!origin || !isOriginAllowed(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  );
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS.join(', '));
}

/** First middleware: CORS on every request, answer OPTIONS immediately. */
export function corsGuard(req: Request, res: Response, next: NextFunction): void {
  applyCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

export const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'] as const;

export const CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Platform-Ops-Key',
  'X-Cron-Secret',
  'X-Requested-With',
  'X-Client-Timezone',
  'X-Timezone',
  'X-Csrf-Token',
  'X-DentVision-Workspace-Id',
  'X-DentVision-Role',
  'X-DentVision-Organization-Id',
  'X-DentVision-Branch-Id',
  'X-DentVision-Workflow',
] as const;
