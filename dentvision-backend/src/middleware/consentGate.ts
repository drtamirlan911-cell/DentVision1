/**
 * Consent gate middleware — blocks API access for users who haven't accepted
 * mandatory click-wrap agreements (ToS, privacy, data processing, platform offer).
 *
 * Applied after authenticate(). Skips itself on the consent acceptance endpoint
 * to avoid a chicken-and-egg deadlock.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { getRequiredConsents } from '../modules/compliance/compliance.service.js';
import { audienceForRole } from '../modules/compliance/consent.catalog.js';

const CONSENT_ACCEPT_PATH = '/api/compliance/consents';
const CONSENT_REQUIRED_PATH = '/api/compliance/consents/required';

export function requireConsent() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Never gate the consent endpoints themselves (deadlock).
      if (req.path === CONSENT_ACCEPT_PATH || req.path === CONSENT_REQUIRED_PATH) {
        return next();
      }

      const user = req.user;
      if (!user) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });

      // Resolve which consent audience this user must satisfy.
      const audience = audienceForRole({
        role: user.role,
        organizationType: user.organizationType,
        personType: user.personType,
      });

      const status = await getRequiredConsents(user.id, audience);

      if (!status.allSatisfied) {
        return res.status(403).json({
          ok: false,
          error: 'Необходимо принять обязательные соглашения',
          code: 'CONSENT_REQUIRED',
          data: {
            pending: status.items.filter((i) => i.mandatory && i.status !== 'accepted'),
            acceptUrl: CONSENT_ACCEPT_PATH,
          },
        });
      }

      next();
    } catch (err) {
      // Fail open on DB errors — don't lock users out due to a transient issue.
      console.error('[consentGate] failed, allowing through:', (err as Error)?.message);
      next();
    }
  };
}
