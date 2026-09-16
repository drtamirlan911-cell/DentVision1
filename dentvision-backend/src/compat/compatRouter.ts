import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMeRouter } from '../modules/auth/me.routes.js';
import { authenticate } from '../middleware/auth.js';
import { uid } from '../lib/helpers.js';

const compatRouter = Router();

// Auth compatibility endpoints kept under the legacy /api mount. The canonical
// auth router remains responsible for login/register/session issuance; these
// session-context endpoints restore the long-standing API contract.
compatRouter.use('/auth', authMeRouter);

/**
 * Compatibility endpoint used by the web staff workspace.
 * The canonical clinic invitation contract is POST /api/clinics/:id/invite;
 * this legacy shape keeps existing clients working while applying the same
 * clinic membership authorization rules.
 */
compatRouter.post('/auth/invitations', authenticate, async (req: any, res: Response) => {
  try {
    const clinicId = String(req.body?.clinicId || '').trim();
    if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId обязателен' });

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId } },
    });
    if (!membership) return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для создания приглашений' });
    }

    const code = uid().slice(0, 8).toUpperCase();
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const role = String(req.body?.role || 'DOCTOR').toUpperCase();
    const expiresInDays = Math.min(90, Math.max(1, Number(req.body?.expiresInDays) || 7));

    return res.status(201).json({
      ok: true,
      data: { code, clinicId, email, role, expiresInDays },
    });
  } catch (error) {
    console.error('[Compat] create invitation', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании приглашения' });
  }
});

// Public service-access endpoint (no auth, used by public booking widget)
compatRouter.get('/service-access/public/:clinicId', async (req: Request, res: Response) => {
  try {
    const clinicId = String(req.params.clinicId);
    const access = await prisma.serviceAccess.findMany({ where: { clinicId } });
    const ALL_SERVICES = ['crm', 'shop', 'school', 'ai', 'analytics', 'settings'];
    const map: Record<string, boolean> = {};
    for (const svc of ALL_SERVICES) {
      const found = access.find((a: { service: string; enabled: boolean }) => a.service === svc);
      map[svc] = found ? found.enabled : true;
    }
    res.json(map);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default compatRouter;
