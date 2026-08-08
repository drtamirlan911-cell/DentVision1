import type { Request, Response, NextFunction } from 'express';
import { applyCorsHeaders } from '../lib/cors.js';

function ensureCorsOnError(req: Request, res: Response) {
  applyCorsHeaders(req, res);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message, err.stack || '');
  ensureCorsOnError(req, res);
  res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
}

export function notFound(req: Request, res: Response) {
  ensureCorsOnError(req, res);
  res.status(404).json({ ok: false, error: 'Маршрут не найден' });
}
