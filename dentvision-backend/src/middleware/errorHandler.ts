import type { Request, Response, NextFunction } from 'express';
import { applyCorsHeaders } from '../lib/cors.js';

/** Ensure error responses still carry CORS when upstream middleware skipped. */
function ensureCorsOnError(req: Request, res: Response) {
  applyCorsHeaders(req, res);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message, err.stack);
  ensureCorsOnError(req, res);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Внутренняя ошибка сервера',
  });
}

export function notFound(req: Request, res: Response) {
  ensureCorsOnError(req, res);
  res.status(404).json({ ok: false, error: 'Маршрут не найден' });
}
