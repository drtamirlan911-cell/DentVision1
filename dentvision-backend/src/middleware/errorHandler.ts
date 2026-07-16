import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message, err.stack);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Внутренняя ошибка сервера',
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: 'Маршрут не найден' });
}
