import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { generateTokens } from '../../lib/jwt.js';
import { permissionsForRole } from '../../lib/permissions.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// IAM: permissions + multi-context memberships (CLINIC / SUPPLIER / LECTURER).
export const iamRouter = Router();

iamRouter.use(authenticate);

iamRouter.get('/permissions', (req: AuthRequest, res) => {
  const role = req.user?.role;
  return res.json({
    ok: true,
    data: { role, permissions: permissionsForRole(role) },
  } satisfies ApiResponse);
});

// All contexts the user can switch into.
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

    const supplierMemberships = await prisma.supplierMember.findMany({
      where: { userId: req.user!.id },
      include: { supplier: { select: { id: true, name: true, status: true } } },
    });

    const lecturerProfiles = await prisma.lecturer.findMany({
      where: { userId: req.user!.id },
      include: { academy: { select: { id: true, name: true } } },
    });

    const contexts = [
      ...memberships.map((m) => ({
        id: m.id,
        scopeType: 'CLINIC' as const,
        scopeId: m.clinicId,
        roleKey: `clinic.${m.role.toLowerCase()}`,
        role: m.role,
        clinic: m.clinic,
      })),
      ...supplierMemberships.map((m) => ({
        id: m.id,
        scopeType: 'SUPPLIER' as const,
        scopeId: m.supplierId,
        roleKey: `supplier.${m.role}`,
        role: m.role,
        supplier: m.supplier,
      })),
      ...lecturerProfiles.map((l) => ({
        id: l.id,
        scopeType: 'LECTURER' as const,
        scopeId: l.id,
        roleKey: 'lecturer',
        role: 'lecturer',
        level: l.level,
        academy: l.academy,
      })),
    ];

    return res.json({ ok: true, data: { contexts } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM contexts error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить контексты' } satisfies ApiResponse);
  }
});

// Switch active context → new JWT scoped to clinic / supplier / lecturer / personal.
iamRouter.post('/switch-context', async (req: AuthRequest, res) => {
  try {
    const { scopeType, scopeId } = req.body || {};
    const base = { sub: req.user!.id, email: req.user!.email, role: req.user!.role };

    if (scopeType === 'PERSONAL' || !scopeType) {
      const tokens = generateTokens(base);
      return res.json({ ok: true, data: { ...tokens, context: { scopeType: 'PERSONAL' } } } satisfies ApiResponse);
    }

    if (scopeType === 'CLINIC') {
      const m = await prisma.clinicMember.findUnique({
        where: { userId_clinicId: { userId: req.user!.id, clinicId: scopeId } },
      });
      if (!m) return res.status(403).json({ ok: false, error: 'Вы не участник этой клиники' } satisfies ApiResponse);
      const tokens = generateTokens({ ...base, clinicId: scopeId });
      return res.json({ ok: true, data: { ...tokens, context: { scopeType, scopeId, role: m.role } } } satisfies ApiResponse);
    }

    if (scopeType === 'SUPPLIER') {
      const m = await prisma.supplierMember.findUnique({
        where: { userId_supplierId: { userId: req.user!.id, supplierId: scopeId } },
      });
      if (!m) return res.status(403).json({ ok: false, error: 'Вы не участник этого поставщика' } satisfies ApiResponse);
      const tokens = generateTokens({ ...base, supplierId: scopeId, supplierRole: m.role });
      return res.json({ ok: true, data: { ...tokens, context: { scopeType, scopeId, role: m.role } } } satisfies ApiResponse);
    }

    if (scopeType === 'LECTURER') {
      const lecturer = await prisma.lecturer.findFirst({ where: { id: scopeId, userId: req.user!.id } });
      if (!lecturer) return res.status(403).json({ ok: false, error: 'Вы не являетесь этим лектором' } satisfies ApiResponse);
      const tokens = generateTokens({ ...base, lecturerId: lecturer.id });
      return res.json({ ok: true, data: { ...tokens, context: { scopeType, scopeId, role: 'lecturer' } } } satisfies ApiResponse);
    }

    return res.status(400).json({ ok: false, error: 'Неизвестный scopeType' } satisfies ApiResponse);
  } catch (error) {
    console.error('switch-context error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось переключить контекст' } satisfies ApiResponse);
  }
});

export default iamRouter;
