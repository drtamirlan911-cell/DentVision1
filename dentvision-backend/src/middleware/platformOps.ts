import type { Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'node:crypto';
import { env } from '../config.js';
import type { AuthRequest } from '../types/index.js';

/**
 * Stealth platform-ops gate for sensitive governance actions (supplier verify, etc.).
 *
 * Layers:
 * 1) Must already be authenticated
 * 2) Role must be SUPERADMIN (JWT + DB role already on req.user)
 * 3) Header X-Platform-Ops-Key must match PLATFORM_OPS_SECRET (timing-safe)
 *
 * Fail closed with 404 (not 401/403) so casual probing does not reveal the ops surface.
 */
function secretsEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function requirePlatformOps(req: AuthRequest, res: Response, next: NextFunction) {
  // Never acknowledge the ops API to non-superadmins.
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  const configured = env.PLATFORM_OPS_SECRET;
  if (!configured || configured.length < 24) {
    // Misconfigured: disable the surface entirely in production; soft-allow only in development.
    if (env.NODE_ENV === 'production') {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }
    console.warn('[ops] PLATFORM_OPS_SECRET missing/short — allowing SUPERADMIN without key in development only');
    return next();
  }

  const provided = String(req.headers['x-platform-ops-key'] || '');
  if (!provided || !secretsEqual(provided, configured)) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  return next();
}
