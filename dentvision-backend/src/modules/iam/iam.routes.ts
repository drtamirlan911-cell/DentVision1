import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { generateTokens } from '../../lib/jwt.js';
import { resolveUserPermissions } from '../../lib/resolvePermissions.js';
import { uid } from '../../lib/helpers.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';
import { buildWorkspaceContexts } from './contexts.js';
import {
  acceptInvitation,
  canManageMembers,
  createInvitation,
  rejectInvitation,
} from './invitations.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { auditFromReq, writeAuditLog } from '../compliance/audit.service.js';

/** Roles allowed to manage clinic staff, mirroring MEMBER_MANAGER_ROLES for the other org types. */
const CLINIC_MANAGER_ROLES = ['OWNER', 'ADMIN', 'DIRECTOR'];

/**
 * Can this user assign/remove roles on a person belonging to `org`?
 *
 * `canManageMembers` only understands DIAGNOSTIC_CENTER/LABORATORY — clinics
 * have always had their own invite flow (`/auth/join-clinic`), so this adds
 * the CLINIC branch here rather than widening that module's scope.
 */
export async function canManageRolesFor(
  user: { id: string; role: string },
  org: { id: string; type: string; originalId: string | null } | null,
): Promise<boolean> {
  if (user.role === 'SUPERADMIN') return true;
  if (!org) return false;
  if (org.type === 'CLINIC') {
    const clinicId = org.originalId || org.id;
    const access = await resolveClinicAccess(user.id, clinicId);
    return !!access && CLINIC_MANAGER_ROLES.includes(String(access.role).toUpperCase());
  }
  return canManageMembers(user.id, org, false);
}

// IAM module (Phase 2). Exposes the server-side permission model to clients so
// the frontend can drive UI from real, enforced permissions instead of a
// hard-coded role→pages map. See docs/DENTVISION_V2_INTEGRATION_PLAN.md §4.5.
export const iamRouter = Router();

iamRouter.use(authenticate);

// Effective permissions of the current user in the active context (token role),
// sourced from the DB Person → PersonRole → Role → Permission graph with a
// hardcoded fallback. Same helper as /me and /login, so the frontend always
// receives one consistent permission set.
iamRouter.get('/permissions', async (req: AuthRequest, res) => {
  const role = req.user?.role;
  try {
    const scopeId = (req.user as any)?.organizationId || (req.user as any)?.clinicId;
    const permissions = await resolveUserPermissions(req.user!.id, scopeId);
    return res.json({
      ok: true,
      data: { role, permissions, db: true },
    } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось получить права' } satisfies ApiResponse);
  }
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

    // 2) New unified contexts via Person → Organization.
    // `originalId` is required, not cosmetic: it is where the mirrored entity's
    // real id lives, and `Organization.id` is a separate uuid.
    const persons = await prisma.person.findMany({
      where: { userId },
      include: {
        organization: { select: { id: true, name: true, type: true, logo: true, originalId: true } },
        personRoles: { include: { role: true } },
      },
    });

    // One row per real workspace — see contexts.ts for why the two halves used
    // to arrive as two or three copies of the same clinic.
    const contexts = buildWorkspaceContexts({
      memberships,
      supplierMemberships,
      lecturer,
      persons,
    });

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

    // sessionId must survive a context switch: without it `authenticate` skips
    // the revocation check, so a switched token outlived logout.
    const base = { sub: user.id, email: user.email, role: user.role, sessionId: user.sessionId };

    // 1) Try unified Organization first (any type).
    // `scopeId` may be either the Organization uuid or the mirrored entity's
    // own id: /me/contexts now keys workspaces by the entity (a clinic id is
    // what every clinic-scoped query needs), and callers pass that back. Only
    // CLINIC and SUPPLIER had legacy branches below, so a diagnostic centre or
    // laboratory reached by entity id would have fallen through to a 404.
    const org =
      (await prisma.organization.findUnique({ where: { id: scopeId } })) ||
      (await prisma.organization.findFirst({ where: { originalId: scopeId } }));
    if (org) {
      let person = await prisma.person.findFirst({
        where: { userId: user.id, organizationId: org.id },
      });
      // Fallback: org.id may have been realigned to the entity id while the
      // Person link was stored against the old id — resolve by originalId.
      if (!person && org.originalId) {
        person = await prisma.person.findFirst({
          where: { userId: user.id, originalId: `${org.originalId}:${user.id}` },
        });
        if (person) {
          await prisma.person.update({ where: { id: person.id }, data: { organizationId: org.id } }).catch(() => {});
        }
      }
      if (person) {
        // The mirrored entity's own id — never the organisation uuid, and never
        // the caller's `scopeId`, which may now be either of the two.
        const entityId = org.originalId || org.id;
        let supplierContext = {};
        if (org.type === 'SUPPLIER_COMPANY') {
          const member = await prisma.supplierMember.findUnique({
            where: { userId_supplierId: { userId: user.id, supplierId: entityId } },
          });
          if (member) supplierContext = { supplierId: entityId, supplierRole: member.role };
        }
        const tokens = generateTokens({
          ...base,
          organizationId: org.id,
          organizationType: org.type,
          personType: person.personType,
          ...supplierContext,
          // Legacy compat: a clinic's own id is Organization.originalId — the
          // organization id itself matches no Clinic row, so emitting it here
          // handed every clinic-scoped query an id that resolves to nothing.
          ...(org.type === 'CLINIC' && org.originalId ? { clinicId: org.originalId } : {}),
        });
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'organization', entityId: org.id, details: { scopeType: org.type } });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
      console.warn(`[IAM] switch-context: org ${scopeId} (${org.type}) found but no Person link for user ${user.id}`);
    }

    // 2) Legacy CLINIC switch (for users without Person record yet)
    if (scopeType === 'CLINIC') {
      const membership = await prisma.clinicMember.findUnique({
        where: { userId_clinicId: { userId: user.id, clinicId: scopeId } },
      });
      if (membership) {
        const tokens = generateTokens({ ...base, role: membership.role, clinicId: scopeId });
        await writeAuditLog({ userId: user.id, clinicId: scopeId, action: 'auth.switch_context', entity: 'clinic', entityId: scopeId });
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
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'supplier', entityId: scopeId });
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
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'lecturer', entityId: scopeId });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }

    return res.status(403).json({ ok: false, error: 'У вас нет доступа к этому контексту' } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM switch-context error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при переключении контекста' } satisfies ApiResponse);
  }
});

// ─── Organization invitations ───────────────────────────────────────────────
//
// Clinics join through /auth/join-clinic; everything else had no path at all.
// See invitations.service.ts.

// POST /api/iam/invitations — mint an invite code for an organization
iamRouter.post('/invitations', async (req: AuthRequest, res) => {
  try {
    const { organizationId, role, email, expiresInDays } = req.body as {
      organizationId?: string; role?: string; email?: string; expiresInDays?: number;
    };
    if (!organizationId) {
      return res.status(400).json({ ok: false, error: 'organizationId обязателен' } satisfies ApiResponse);
    }

    // Accept either the Organization uuid or the mirrored entity's own id —
    // the workspace holds the latter, the switcher the former.
    const org =
      (await prisma.organization.findUnique({ where: { id: organizationId } })) ||
      (await prisma.organization.findFirst({ where: { originalId: organizationId } }));
    if (!org) {
      return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    }

    const allowed = await canManageMembers(req.user!.id, org, req.user!.role === 'SUPERADMIN');
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'Только владелец или администратор может приглашать' } satisfies ApiResponse);
    }

    const invitation = await createInvitation({
      organizationId: org.id,
      role,
      email,
      expiresInDays,
      createdBy: req.user!.id,
    });
    return res.status(201).json({ ok: true, data: invitation } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM create invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать приглашение' } satisfies ApiResponse);
  }
});

// GET /api/iam/invitations?organizationId= — outstanding codes for an org
iamRouter.get('/invitations', async (req: AuthRequest, res) => {
  try {
    const organizationId = String(req.query.organizationId || '');
    if (!organizationId) {
      return res.status(400).json({ ok: false, error: 'organizationId обязателен' } satisfies ApiResponse);
    }

    const org =
      (await prisma.organization.findUnique({ where: { id: organizationId } })) ||
      (await prisma.organization.findFirst({ where: { originalId: organizationId } }));
    if (!org) {
      return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    }

    const allowed = await canManageMembers(req.user!.id, org, req.user!.role === 'SUPERADMIN');
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав' } satisfies ApiResponse);
    }

    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId: org.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ ok: true, data: invitations } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM list invitations error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить приглашения' } satisfies ApiResponse);
  }
});

// GET /api/iam/invitations/lookup?code= — what does this code offer?
// Read-only, so the invitee sees the organization before committing.
iamRouter.get('/invitations/lookup', async (req: AuthRequest, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) {
      return res.status(400).json({ ok: false, error: 'code обязателен' } satisfies ApiResponse);
    }

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { code },
      include: { organization: { select: { id: true, name: true, type: true } } },
    });

    const rejection = rejectInvitation(invitation, { userEmail: req.user!.email });
    if (rejection) {
      return res.status(rejection.status).json({ ok: false, error: rejection.error } satisfies ApiResponse);
    }

    return res.json({
      ok: true,
      data: {
        organization: invitation!.organization,
        role: invitation!.role,
        expiresAt: invitation!.expiresAt,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM lookup invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось проверить приглашение' } satisfies ApiResponse);
  }
});

// POST /api/iam/join-by-invite — consume a code and gain membership
iamRouter.post('/join-by-invite', async (req: AuthRequest, res) => {
  try {
    const code = String((req.body || {}).code || '').trim();
    if (!code) {
      return res.status(400).json({ ok: false, error: 'code обязателен' } satisfies ApiResponse);
    }

    const result = await acceptInvitation(code, { id: req.user!.id, email: req.user!.email });
    return res.status(201).json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ ok: false, error: (error as Error).message } satisfies ApiResponse);
    }
    console.error('IAM join-by-invite error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось присоединиться к организации' } satisfies ApiResponse);
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
    const personId = String(req.params.personId);
    const { roleId, scopeType, scopeId } = req.body as { roleId: string; scopeType?: string; scopeId?: string };

    const person = await prisma.person.findUnique({ where: { id: personId }, include: { organization: true } });
    if (!person) {
      return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    }

    const allowed = await canManageRolesFor(req.user!, person.organization);
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для назначения роли' } satisfies ApiResponse);
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

    await auditFromReq(req, {
      action: 'person_role.assigned',
      entity: 'person_role',
      entityId: assignment.id,
      details: { personId, roleId, roleName: role.name, scopeType: scopeType || null, scopeId: scopeId || null },
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
    const personId = String(req.params.personId);
    const roleId = String(req.params.roleId);

    const person = await prisma.person.findUnique({ where: { id: personId }, include: { organization: true } });
    if (!person) {
      return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    }

    const allowed = await canManageRolesFor(req.user!, person.organization);
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для удаления роли' } satisfies ApiResponse);
    }

    await prisma.personRole.deleteMany({
      where: { personId, roleId },
    });

    await auditFromReq(req, {
      action: 'person_role.removed',
      entity: 'person_role',
      entityId: `${personId}:${roleId}`,
      details: { personId, roleId },
    });

    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM remove role error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить роль' } satisfies ApiResponse);
  }
});

export default iamRouter;
