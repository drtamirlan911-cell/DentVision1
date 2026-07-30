import type { Request, Response, NextFunction } from 'express';
import { env } from '../config.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://dent-vision1.vercel.app',
  'https://dentvision1.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

function parseCorsOrigins(raw: string): true | string[] {
  const value = (raw || '').trim();
  if (!value || value === '*') return true;
  return [...new Set([
    ...value.split(',').map((s) => s.trim()).filter(Boolean),
    ...DEFAULT_ALLOWED_ORIGINS,
  ])];
}

const configured = parseCorsOrigins(env.CORS_ORIGIN + (env.FRONTEND_URL ? `,${env.FRONTEND_URL}` : ''));

/**
 * Allow production + all DentVision / Cursor Vercel previews
 * (incl. team hosts like *-projects.vercel.app).
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  if (configured === true) return true;
  if (configured.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (!host.endsWith('.vercel.app')) return false;
    // Production + preview aliases — exact match only (no substring bypass)
    if (host === 'dent-vision1.vercel.app') return true;
    if (host === 'dentvision1.vercel.app') return true;
    // Preview deployments: dent-vision1-git-<branch>-<hash>.vercel.app
    if (/^dent-vision1-git-.+\.vercel\.app$/.test(host)) return true;
    if (/^dentvision1-git-.+\.vercel\.app$/.test(host)) return true;
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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Platform-Ops-Key, X-Cron-Secret, X-Requested-With, X-Client-Timezone, X-Timezone, X-Csrf-Token',
  );
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
] as const;
