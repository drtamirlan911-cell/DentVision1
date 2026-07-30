import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { generateTokens } from '../../lib/jwt.js';
import { permissionsForRole } from '../../lib/permissions.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// IAM module (Phase 2). Exposes the server-side permission model to clients so
// the frontend can drive UI from real, enforced permissions instead of a
// hard-coded role→pages map. See docs/DENTVISION_V2_INTEGRATION_PLAN.md §4.5.
export const iamRouter = Router();

iamRouter.use(authenticate);

// Effective permissions of the current user in the active context (token role),
// now sourced from the DB Role/Permission tables when available, with fallback
// to the hardcoded map.
iamRouter.get('/permissions', async (req: AuthRequest, res) => {
  const role = req.user?.role;

  // Try to load from DB Role → Permission first
  try {
    const dbRole = await prisma.role.findUnique({
      where: { key: role?.toLowerCase() || '' },
      include: { permissions: { include: { permission: true } } },
    });
    if (dbRole && dbRole.permissions.length > 0) {
      return res.json({
        ok: true,
        data: {
          role,
          permissions: dbRole.permissions.map((rp) => rp.permission.key),
          db: true,
        },
      } satisfies ApiResponse);
    }
  } catch { /* fall through to hardcoded */ }

  return res.json({
    ok: true,
    data: { role, permissions: permissionsForRole(role), db: false },
  } satisfies ApiResponse);
});

// GET /api/iam/types — list available organization and person types (from DB config)
iamRouter.get('/types', async (_req: AuthRequest, res) => {
  try {
    const orgTypes = await prisma.organization.groupBy({ by: ['type'], _count: true });
    const personTypes = await prisma.person.groupBy({ by: ['personType'], _count: true });
    return res.json({
      ok: true,
      data: {
        organizationTypes: orgTypes.map((t) => ({ type: t.type, count: t._count })),
        personTypes: personTypes.map((t) => ({ type: t.personType, count: t._count })),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM types error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить типы' } satisfies ApiResponse);
  }
});

// All contexts (memberships) the user belongs to — unified via Organization + Person.
iamRouter.get('/me/contexts', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // 1) Existing legacy memberships (for backward compatibility)
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

    // 2) New unified contexts via Person → Organization
    const persons = await prisma.person.findMany({
      where: { userId },
      include: {
        organization: { select: { id: true, name: true, type: true, logo: true } },
        roles: { include: { role: true } },
      },
    });

    const organizationContexts = persons
      .filter((p) => p.organization)
      .map((p) => ({
        id: p.id,
        scopeType: p.organization!.type,
        scopeId: p.organization!.id,
        personType: p.personType,
        roleKey: p.roles.map((pr) => pr.role.key).join(',') || p.personType.toLowerCase(),
        organization: {
          id: p.organization!.id,
          name: p.organization!.name,
          type: p.organization!.type,
          logo: p.organization!.logo,
        },
      }));

    const contexts = [
      // Legacy contexts (backward compat)
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
      // New unified organization contexts
      ...organizationContexts,
    ];

    return res.json({ ok: true, data: { contexts } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM contexts error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить контексты' } satisfies ApiResponse);
  }
});

// Switch active workspace context — unified: any org type, with legacy fallback.
iamRouter.post('/switch-context', async (req: AuthRequest, res) => {
  try {
    const { scopeType, scopeId } = req.body as { scopeType: string; scopeId?: string };
    const user = req.user!;

    if (!scopeType || !scopeId) {
      return res.status(400).json({ ok: false, error: 'scopeType и scopeId обязательны' } satisfies ApiResponse);
    }

    const base = { sub: user.id, email: user.email, role: user.role };

    // 1) Try unified Organization first (any type)
    const org = await prisma.organization.findUnique({ where: { id: scopeId } });
    if (org) {
      const person = await prisma.person.findFirst({
        where: { userId: user.id, organizationId: scopeId },
      });
      if (person) {
        const tokens = generateTokens({
          ...base,
          organizationId: scopeId,
          organizationType: org.type,
          personType: person.personType,
          // Legacy compat: if CLINIC, also set clinicId
          ...(org.type === 'CLINIC' ? { clinicId: scopeId } : {}),
        });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }

    // 2) Legacy CLINIC switch (for users without Person record yet)
    if (scopeType === 'CLINIC') {
      const membership = await prisma.clinicMember.findUnique({
        where: { userId_clinicId: { userId: user.id, clinicId: scopeId } },
      });
      if (membership) {
        const tokens = generateTokens({ ...base, role: membership.role, clinicId: scopeId });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }

    // 3) Legacy SUPPLIER switch
    if (scopeType === 'SUPPLIER') {
      const member = await prisma.supplierMember.findUnique({
        where: { userId_supplierId: { userId: user.id, supplierId: scopeId } },
      });
      if (member) {
        const tokens = generateTokens({ ...base, supplierId: scopeId, supplierRole: member.role });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }

    // 4) Legacy LECTURER switch
    if (scopeType === 'LECTURER') {
      const lecturer = await prisma.lecturer.findFirst({
        where: { id: scopeId, userId: user.id },
      });
      if (lecturer) {
        const tokens = generateTokens({ ...base, lecturerId: scopeId });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }

    return res.status(403).json({ ok: false, error: 'У вас нет доступа к этому контексту' } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM switch-context error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при переключении контекста' } satisfies ApiResponse);
  }
});

// GET /api/iam/roles — list all available roles
iamRouter.get('/roles', async (_req: AuthRequest, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { permissions: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json({ ok: true, data: roles } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM roles error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить роли' } satisfies ApiResponse);
  }
});

// POST /api/iam/persons/:personId/roles — assign a role to a person
iamRouter.post('/persons/:personId/roles', async (req: AuthRequest, res) => {
  try {
    const { personId } = req.params;
    const { roleId, scopeType, scopeId } = req.body as { roleId: string; scopeType?: string; scopeId?: string };

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) {
      return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ ok: false, error: 'Роль не найдена' } satisfies ApiResponse);
    }

    const assignment = await prisma.personRole.upsert({
      where: { personId_roleId: { personId, roleId } },
      update: { scopeType, scopeId },
      create: { id: uid(), personId, roleId, scopeType, scopeId },
    });

    return res.status(201).json({ ok: true, data: assignment } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM assign role error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось назначить роль' } satisfies ApiResponse);
  }
});

// DELETE /api/iam/persons/:personId/roles/:roleId — remove a role assignment
iamRouter.delete('/persons/:personId/roles/:roleId', async (req: AuthRequest, res) => {
  try {
    const { personId, roleId } = req.params;

    await prisma.personRole.deleteMany({
      where: { personId, roleId },
    });

    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM remove role error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить роль' } satisfies ApiResponse);
  }
});

export default iamRouter;
