import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';
import { applyCorsHeaders } from '../lib/cors.js';
import { isSentryEnabled } from '../lib/sentry.js';

function ensureCorsOnError(req: Request, res: Response) {
  applyCorsHeaders(req, res);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message, err.stack || '');
  ensureCorsOnError(req, res);
  // Only true server errors (5xx) reach Sentry — 401/403/404 get handled
  // inline and would otherwise flood the error quota.
  const status = (err as any).status ?? 500;
  if (status >= 500 && isSentryEnabled()) {
    Sentry.captureException(err, {
      tags: { request_path: req.path },
    });
  }
  res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
}

export function notFound(req: Request, res: Response) {
  ensureCorsOnError(req, res);
  res.status(404).json({ ok: false, error: 'Маршрут не найден' });
}
