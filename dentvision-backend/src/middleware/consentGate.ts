/**
 * Consent gates.
 *
 * The patient portal handles protected personal/medical data, so its gate must
 * fail closed. Consent endpoints themselves are outside this router and remain
 * reachable so a patient can satisfy the gate after a 403.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { assertCurrentConsent } from '../modules/compliance/compliance.service.js';
import { audienceForRole, type ConsentAudience } from '../modules/compliance/consent.catalog.js';

const CONSENT_ACCEPT_PATH = '/api/compliance/consents';

function audienceForRequest(req: AuthRequest): ConsentAudience {
  return audienceForRole({
    role: req.user?.role,
    organizationType: (req.user as any)?.organizationType,
    personType: (req.user as any)?.personType,
  });
}

/**
 * Gate for the patient portal and other protected-data routers.
 *
 * Mandatory consent is checked against the current catalogue version. Any
 * database uncertainty is a temporary denial rather than an accidental grant.
 */
export function requireConsent() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });

      const status = await assertCurrentConsent(user.id, audienceForRequest(req));
      res.locals.consentStatus = status;
      return next();
    } catch (err) {
      const error = err as { code?: string; pending?: string[]; items?: unknown[] };
      if (error.code === 'CONSENT_REQUIRED') {
        return res.status(403).json({
          ok: false,
          error: 'Для доступа к медицинским данным необходимо актуальное согласие',
          code: 'CONSENT_REQUIRED',
          data: {
            pending: error.pending || [],
            items: error.items || [],
            acceptUrl: CONSENT_ACCEPT_PATH,
          },
        });
      }

      console.error('[consentGate] verification failed:', err);
      return res.status(503).json({
        ok: false,
        error: 'Не удалось проверить согласия. Доступ временно недоступен.',
        code: 'CONSENT_VERIFICATION_UNAVAILABLE',
      });
    }
  };
}

/**
 * Explicit strict gate for routes that need a narrower consent contract than
 * the router default. Database uncertainty always denies.
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
