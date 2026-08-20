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
  // body-parser sets `status`/`statusCode` to 400 for a malformed request
  // body (bad JSON, payload too large) before this handler ever sees it —
  // that got silently discarded here and turned into a flat 500, so every
  // client mistake (a genuinely bad request) was reported as a server
  // failure. Trust an explicit 4xx the error already carries; anything
  // else (or no status at all) is a real server error and stays 500.
  const declared = (err as any).status ?? (err as any).statusCode;
  const status = declared >= 400 && declared < 500 ? declared : 500;
  // Only true server errors (5xx) reach Sentry — 401/403/404 get handled
  // inline and would otherwise flood the error quota.
  if (status >= 500 && isSentryEnabled()) {
    Sentry.captureException(err, {
      tags: { request_path: req.path },
    });
  }
  const message = status < 500 ? (err.message || 'Некорректный запрос') : 'Внутренняя ошибка сервера';
  res.status(status).json({ ok: false, error: message });
}

export function notFound(req: Request, res: Response) {
  ensureCorsOnError(req, res);
  res.status(404).json({ ok: false, error: 'Маршрут не найден' });
}
