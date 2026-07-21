import type { Request, Response, NextFunction } from 'express';

/** Ensure error responses still carry CORS when upstream middleware skipped. */
function ensureCorsOnError(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (!origin || res.getHeader('Access-Control-Allow-Origin')) return;
  const allowed =
    origin === 'https://dent-vision1.vercel.app' ||
    origin.startsWith('http://localhost:') ||
    (origin.endsWith('.vercel.app') && origin.includes('dent-vision'));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
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
