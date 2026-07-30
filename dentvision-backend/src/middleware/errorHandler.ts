import type { Request, Response, NextFunction } from 'express';
import { applyCorsHeaders } from '../lib/cors.js';

const SENSITIVE_KEYS = /(password|token|secret|key|authorization|credential)/i;

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSensitive(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function ensureCorsOnError(req: Request, res: Response) {
  applyCorsHeaders(req, res);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const isDev = process.env.NODE_ENV === 'development';
  console.error('[ERROR]', err.message, isDev ? err.stack : '');
  ensureCorsOnError(req, res);
  res.status(500).json({
    ok: false,
    error: isDev ? err.message : 'Внутренняя ошибка сервера',
    ...(isDev ? { stack: err.stack?.split('\n').map(l => l.trim()) } : {}),
    ...(isDev && (req as any).body ? { body: redactSensitive((req as any).body) } : {}),
  });
}

export function notFound(req: Request, res: Response) {
  ensureCorsOnError(req, res);
  res.status(404).json({ ok: false, error: 'Маршрут не найден' });
}
