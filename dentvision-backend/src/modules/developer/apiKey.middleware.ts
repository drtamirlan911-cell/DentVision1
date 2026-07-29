import { createHash } from 'node:crypto';
import type { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import type { AuthRequest } from '../../types/index.js';

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

// Authenticates a request via an API key: `x-api-key: <prefix>.<secret>`.
// Attaches req.apiKey with the app id and granted scopes.
export async function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const raw = (req.headers['x-api-key'] as string) || '';
    const [prefix, secret] = raw.split('.');
    if (!prefix || !secret) {
      return res.status(401).json({ ok: false, error: 'API key required' });
    }
    const key = await prisma.apiKey.findUnique({ where: { prefix } });
    if (!key || key.revokedAt || key.hash !== hashSecret(secret)) {
      return res.status(401).json({ ok: false, error: 'Invalid API key' });
    }
    req.apiKey = { id: key.id, appId: key.appId, scopes: key.scopes };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid API key' });
  }
}
