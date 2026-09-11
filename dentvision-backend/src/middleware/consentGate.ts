/**
 * Consent gates.
 *
 * `requireConsent()` is the UX/click-wrap gate used by broad authenticated
 * surfaces. `requireCurrentConsent()` is the security gate for protected
 * clinical workflows and always fails closed when consent cannot be verified.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { assertCurrentConsent, getRequiredConsents } from '../modules/compliance/compliance.service.js';
import { audienceForRole, type ConsentAudience } from '../modules/compliance/consent.catalog.js';

const CONSENT_ACCEPT_PATH = '/api/compliance/consents';
const CONSENT_REQUIRED_PATH = '/api/compliance/consents/required';

function audienceForRequest(req: AuthRequest): ConsentAudience {
  return audienceForRole({
    role: req.user?.role,
    organizationType: (req.user as any)?.organizationType,
    personType: (req.user as any)?.personType,
  });
}

/** Broad UX gate. Kept fail-open for non-protected surfaces during transient DB failures. */
export function requireConsent() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.path === CONSENT_ACCEPT_PATH || req.path === CONSENT_REQUIRED_PATH) return next();

      const user = req.user;
      if (!user) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });

      const status = await getRequiredConsents(user.id, audienceForRequest(req));
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

      return next();
    } catch (err) {
      console.error('[consentGate] failed, allowing non-protected surface through:', (err as Error)?.message);
      return next();
    }
  };
}

/**
 * Strict gate for clinical/medical-data mutations or other protected workflows.
 * Database uncertainty is treated as denial, never as permission.
 */
export function requireCurrentConsent(requiredTypes?: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });

      const status = await assertCurrentConsent(user.id, audienceForRequest(req), requiredTypes);
      res.locals.consentStatus = status;
      return next();
    } catch (err) {
      const error = err as { code?: string; pending?: string[]; items?: unknown[] };
      if (error.code === 'CONSENT_REQUIRED') {
        return res.status(403).json({
          ok: false,
          error: 'Для этого действия необходимо актуальное согласие',
          code: 'CONSENT_REQUIRED',
          data: {
            pending: error.pending || [],
            items: error.items || [],
            acceptUrl: CONSENT_ACCEPT_PATH,
          },
        });
      }

      console.error('[strictConsentGate] verification failed:', err);
      return res.status(503).json({
        ok: false,
        error: 'Не удалось проверить согласия. Действие временно недоступно.',
        code: 'CONSENT_VERIFICATION_UNAVAILABLE',
      });
    }
  };
}
