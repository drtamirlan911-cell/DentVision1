import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { generateTokens } from '../../lib/jwt.js';
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

// All contexts (memberships) the user belongs to.
iamRouter.get('/me/contexts', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [memberships, supplierMemberships, lecturer] = await Promise.all([
      prisma.clinicMember.findMany({
        where: { userId },
        select: {
          id: true,
          role: true,
          clinicId: true,
          joinedAt: true,
          clinic: { select: { id: true, name: true, plan: true, logo: true } },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.supplierMember.findMany({
        where: { userId },
        select: {
          id: true,
          role: true,
          supplierId: true,
          createdAt: true,
          supplier: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.lecturer.findUnique({
        where: { userId },
        select: {
          id: true,
          level: true,
          academy: { select: { id: true, name: true } },
        },
      }),
    ]);

    const contexts = [
      ...memberships.map((m) => ({
        id: m.id,
        scopeType: 'CLINIC' as const,
        scopeId: m.clinicId,
        roleKey: `clinic.${m.role.toLowerCase()}`,
        role: m.role,
        joinedAt: m.joinedAt,
        clinic: m.clinic,
      })),
      ...supplierMemberships.map((m) => ({
        id: m.id,
        scopeType: 'SUPPLIER' as const,
        scopeId: m.supplierId,
        roleKey: `supplier.${m.role}`,
        role: m.role,
        joinedAt: m.createdAt,
        supplier: m.supplier,
      })),
      ...(lecturer
        ? [{
            id: lecturer.id,
            scopeType: 'LECTURER' as const,
            scopeId: lecturer.id,
            roleKey: 'lecturer',
            role: lecturer.level,
            level: lecturer.level,
            academy: lecturer.academy,
          }]
        : []),
    ];

    return res.json({ ok: true, data: { contexts } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM contexts error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить контексты' } satisfies ApiResponse);
  }
});

// Switch active workspace context (clinic, supplier, or lecturer).
iamRouter.post('/switch-context', async (req: AuthRequest, res) => {
  try {
    const { scopeType, scopeId } = req.body as { scopeType: string; scopeId?: string };
    const user = req.user!;

    if (!scopeType || !scopeId) {
      return res.status(400).json({ ok: false, error: 'scopeType и scopeId обязательны' } satisfies ApiResponse);
    }

    const base = { sub: user.id, email: user.email, role: user.role };

    if (scopeType === 'CLINIC') {
      const membership = await prisma.clinicMember.findUnique({
        where: { userId_clinicId: { userId: user.id, clinicId: scopeId } },
      });
      if (!membership) {
        return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' } satisfies ApiResponse);
      }
      const tokens = generateTokens({ ...base, role: membership.role, clinicId: scopeId });
      return res.json({ ok: true, data: tokens } satisfies ApiResponse);
    }

    if (scopeType === 'SUPPLIER') {
      const member = await prisma.supplierMember.findUnique({
        where: { userId_supplierId: { userId: user.id, supplierId: scopeId } },
      });
      if (!member) {
        return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этого поставщика' } satisfies ApiResponse);
      }
      const tokens = generateTokens({ ...base, supplierId: scopeId, supplierRole: member.role });
      return res.json({ ok: true, data: tokens } satisfies ApiResponse);
    }

    if (scopeType === 'LECTURER') {
      const lecturer = await prisma.lecturer.findFirst({
        where: { id: scopeId, userId: user.id },
      });
      if (!lecturer) {
        return res.status(403).json({ ok: false, error: 'Лекторский профиль не найден' } satisfies ApiResponse);
      }
      const tokens = generateTokens({ ...base, lecturerId: scopeId });
      return res.json({ ok: true, data: tokens } satisfies ApiResponse);
    }

    return res.status(400).json({ ok: false, error: 'Неизвестный тип контекста' } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM switch-context error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при переключении контекста' } satisfies ApiResponse);
  }
});

export default iamRouter;
