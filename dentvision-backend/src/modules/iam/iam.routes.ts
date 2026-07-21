import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { permissionsForRole } from '../../lib/permissions.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// IAM module (Phase 1). Exposes the server-side permission model to clients so
// the frontend can drive UI from real, enforced permissions instead of a
// hard-coded role→pages map. See docs/DENTVISION_V2_INTEGRATION_PLAN.md §4.5.
export const iamRouter = Router();

iamRouter.use(authenticate);

// Effective permissions of the current user in the active context (token role).
iamRouter.get('/permissions', (req: AuthRequest, res) => {
  const role = req.user?.role;
  return res.json({
    ok: true,
    data: { role, permissions: permissionsForRole(role) },
  } satisfies ApiResponse);
});

// All contexts (memberships) the user belongs to. Today only CLINIC scopes exist;
// SUPPLIER/ACADEMY/PLATFORM scopes are added in later phases with the same shape.
iamRouter.get('/me/contexts', async (req: AuthRequest, res) => {
  try {
    const memberships = await prisma.clinicMember.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        role: true,
        clinicId: true,
        joinedAt: true,
        clinic: { select: { id: true, name: true, plan: true, logo: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const contexts = memberships.map((m) => ({
      id: m.id,
      scopeType: 'CLINIC' as const,
      scopeId: m.clinicId,
      roleKey: `clinic.${m.role.toLowerCase()}`,
      role: m.role,
      joinedAt: m.joinedAt,
      clinic: m.clinic,
    }));

    return res.json({ ok: true, data: { contexts } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM contexts error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить контексты' } satisfies ApiResponse);
  }
});

export default iamRouter;
