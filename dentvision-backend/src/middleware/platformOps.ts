import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';

export function requirePlatformOps(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }
  return next();
}
