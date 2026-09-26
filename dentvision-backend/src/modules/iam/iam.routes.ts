import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { generateTokens } from '../../lib/jwt.js';
import { resolveUserPermissions } from '../../lib/resolvePermissions.js';
import { uid } from '../../lib/helpers.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';
import { buildWorkspaceContexts, roleLabelFor, userRoleForPartnerRole } from './contexts.js';
import type { ScopeType } from './contexts.js';
import {
  acceptInvitation,
  canManageMembers,
  createInvitation,
  rejectInvitation,
} from './invitations.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import type { UserRole } from '@prisma/client';
import { auditFromReq, writeAuditLog } from '../compliance/audit.service.js';

/** Roles allowed to manage clinic staff, mirroring MEMBER_MANAGER_ROLES for the other org types. */
const CLINIC_MANAGER_ROLES = ['OWNER', 'ADMIN', 'DIRECTOR'];

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

export const iamRouter = Router();
iamRouter.use(authenticate);

iamRouter.get('/permissions', async (req: AuthRequest, res) => {
  const role = req.user?.role;
  try {
    const scopeId = (req.user as any)?.organizationId || (req.user as any)?.clinicId;
    const permissions = await resolveUserPermissions(req.user!.id, scopeId);
    return res.json({ ok: true, data: { role, permissions, db: true } } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось получить права' } satisfies ApiResponse);
  }
});

iamRouter.get('/types', async (_req: AuthRequest, res) => {
  try {
    const orgTypes = await prisma.organization.groupBy({ by: ['type'], _count: true });
    const personTypes = await prisma.person.groupBy({ by: ['personType'], _count: true });
    return res.json({ ok: true, data: { organizationTypes: orgTypes.map((t) => ({ type: t.type, count: t._count })), personTypes: personTypes.map((t) => ({ type: t.personType, count: t._count })) } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM types error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить типы' } satisfies ApiResponse);
  }
});

iamRouter.get('/me/contexts', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const [memberships, supplierMemberships, lecturer, diagnosticCenterMemberships, laboratoryMemberships] = await Promise.all([
      prisma.clinicMember.findMany({ where: { userId }, select: { id: true, role: true, clinicId: true, joinedAt: true, clinic: { select: { id: true, name: true, plan: true, logo: true } } }, orderBy: { joinedAt: 'asc' } }),
      prisma.supplierMember.findMany({ where: { userId }, select: { id: true, role: true, supplierId: true, createdAt: true, supplier: { select: { id: true, name: true, status: true } } }, orderBy: { createdAt: 'asc' } }),
      prisma.lecturer.findUnique({ where: { userId }, select: { id: true, level: true, academy: { select: { id: true, name: true } } } }),
      prisma.diagnosticCenterMember.findMany({ where: { userId }, select: { id: true, role: true, centerId: true, createdAt: true, center: { select: { id: true, name: true, logo: true } } }, orderBy: { createdAt: 'asc' } }),
      prisma.laboratoryMember.findMany({ where: { userId }, select: { id: true, role: true, labId: true, createdAt: true, lab: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    const persons = await prisma.person.findMany({ where: { userId }, include: { organization: { select: { id: true, name: true, type: true, logo: true, originalId: true } }, personRoles: { include: { role: true } } } });
    const contexts = buildWorkspaceContexts({ memberships, supplierMemberships, lecturer, diagnosticCenterMemberships, laboratoryMemberships, persons });

    // The active JWT already proves the user's canonical organization context.
    // Keep that context visible even if a legacy partner membership is missing
    // or was created after the Person graph. This is a read-model repair path,
    // not an authorization bypass: the Person must exist and carry an active
    // scoped role before we expose the workspace.
    if (req.user?.organizationId) {
      const activeOrgId = req.user.organizationId;
      const activePerson = persons.find((person) => person.organization?.id === activeOrgId);
      const activeRole = activePerson?.personRoles
        ?.map((personRole) => personRole.role.key)
        .find((key) => /^(diagnostic_|medical_lab_|dental_lab_|lab_coordinator|dental_technician|cad_designer|ceramist|orthodontic_technician|qc_specialist|lab_finance)/i.test(key));
      if (activePerson?.organization && activeRole) {
        const org = activePerson.organization;
        const scopeType = ({ CLINIC: 'CLINIC', DIAGNOSTIC_CENTER: 'DIAGNOSTIC_CENTER', LABORATORY: 'LABORATORY', SUPPLIER_COMPANY: 'SUPPLIER', SUPPLIER: 'SUPPLIER', ACADEMY: 'ACADEMY', PARTNER: 'PARTNER' } as Record<string, ScopeType>)[org.type];
        const scopeId = org.originalId || org.id;
        const id = scopeType ? (scopeType + ':' + scopeId) : null;
        if (scopeType && id && !contexts.some((context) => context.id === id)) {
          contexts.push({
            id,
            scopeType,
            scopeId,
            organizationId: org.id,
            name: org.name,
            roleKey: activeRole,
            roleLabel: roleLabelFor(activeRole),
            personType: activePerson.personType,
            logo: org.logo ?? null,
          });
        }
      }
    }

    return res.json({ ok: true, data: { contexts } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM contexts error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить контексты' } satisfies ApiResponse);
  }
});

iamRouter.post('/switch-context', async (req: AuthRequest, res) => {
  try {
    const { scopeType, scopeId, branchId } = req.body as { scopeType: string; scopeId?: string; branchId?: string };
    const user = req.user!;
    if (!scopeType || !scopeId) return res.status(400).json({ ok: false, error: 'scopeType и scopeId обязательны' } satisfies ApiResponse);
    const base = { sub: user.id, email: user.email, role: user.role, sessionId: user.sessionId };
    const org = (await prisma.organization.findUnique({ where: { id: scopeId } })) || (await prisma.organization.findFirst({ where: { originalId: scopeId } }));
    if (org) {
      let person = await prisma.person.findFirst({ where: { userId: user.id, organizationId: org.id }, include: { personRoles: { include: { role: true } } } });
      if (!person && org.originalId) {
        person = await prisma.person.findFirst({ where: { userId: user.id, originalId: `${org.originalId}:${user.id}` }, include: { personRoles: { include: { role: true } } } });
        if (person) await prisma.person.update({ where: { id: person.id }, data: { organizationId: org.id } }).catch(() => {});
      }
      if (person) {
        const scopedRoleKey = person.personRoles?.find((pr) => !pr.scopeId || pr.scopeId === org.id)?.role.key || person.personType || user.role;
        const userRoleValues = new Set<UserRole>(['OWNER', 'DOCTOR', 'ASSISTANT', 'ADMIN', 'CASHIER', 'LAB', 'MANAGER', 'STUDENT', 'SUPERADMIN', 'SUPPORT', 'PATIENT']);
        const scopedRole: UserRole = userRoleValues.has(String(scopedRoleKey).toUpperCase() as UserRole)
          ? String(scopedRoleKey).toUpperCase() as UserRole
          : userRoleForPartnerRole(scopedRoleKey, user.role);
        const entityId = org.originalId || org.id;
        let supplierContext = {};
        if (org.type === 'SUPPLIER_COMPANY') {
          const member = await prisma.supplierMember.findUnique({ where: { userId_supplierId: { userId: user.id, supplierId: entityId } } });
          if (member) supplierContext = { supplierId: entityId, supplierRole: member.role };
        }
        let selectedBranchId: string | undefined;
        if (branchId) {
          const rows = await prisma.$queryRaw<Array<{ id: string; organization_id: string | null }>>`SELECT "id", "organization_id" FROM "branches" WHERE "id" = ${branchId} LIMIT 1`;
          if (!rows[0] || rows[0].organization_id !== org.id) return res.status(403).json({ ok: false, error: 'Филиал не относится к выбранной организации' });
          const roleRows = await prisma.personRole.findMany({ where: { personId: person.id }, include: { role: true } });
          const orgManager = roleRows.some((pr) => ['owner', 'org_owner', 'admin', 'org_admin'].includes(pr.role.key.toLowerCase()));
          const assigned = await prisma.branchMember.findUnique({ where: { personId_branchId: { personId: person.id, branchId } } });
          if (!orgManager && !assigned) return res.status(403).json({ ok: false, error: 'У вас нет доступа к выбранному филиалу' });
          selectedBranchId = branchId;
        }
        const tokens = generateTokens({ ...base, role: scopedRole, organizationId: org.id, organizationOriginalId: org.originalId || undefined, organizationType: org.type, personType: person.personType, ...(selectedBranchId ? { branchId: selectedBranchId } : {}), ...supplierContext, ...(org.type === 'CLINIC' && org.originalId ? { clinicId: org.originalId } : {}) });
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'organization', entityId: org.id, details: { scopeType: org.type } });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }
    if (scopeType === 'CLINIC') {
      const membership = await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId: user.id, clinicId: scopeId } } });
      if (membership) {
        const tokens = generateTokens({ ...base, role: membership.role, clinicId: scopeId });
        await writeAuditLog({ userId: user.id, clinicId: scopeId, action: 'auth.switch_context', entity: 'clinic', entityId: scopeId });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }
    if (scopeType === 'SUPPLIER') {
      const member = await prisma.supplierMember.findUnique({ where: { userId_supplierId: { userId: user.id, supplierId: scopeId } } });
      if (member) {
        const scopedRole = userRoleForPartnerRole(member.role, user.role);
        const organization = await prisma.organization.findFirst({ where: { originalType: 'Supplier', originalId: scopeId } });
        const tokens = generateTokens({
          ...base,
          role: scopedRole,
          supplierId: scopeId,
          supplierRole: member.role,
          organizationId: organization?.id,
          organizationOriginalId: scopeId,
          organizationType: 'SUPPLIER',
          personType: 'SUPPLIER_REP',
        });
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'supplier', entityId: scopeId });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }
    if (scopeType === 'DIAGNOSTIC_CENTER') {
      const member = await prisma.diagnosticCenterMember.findUnique({ where: { centerId_userId: { centerId: scopeId, userId: user.id } } });
      if (member) {
        const scopedRole = userRoleForPartnerRole(member.role, user.role);
        const organization = await prisma.organization.findFirst({ where: { originalType: 'DiagnosticCenter', originalId: scopeId } });
        const tokens = generateTokens({ ...base, role: scopedRole, organizationId: organization?.id, organizationOriginalId: scopeId, organizationType: 'DIAGNOSTIC_CENTER' });
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'diagnostic_center', entityId: scopeId, details: { role: member.role } });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }
    if (scopeType === 'LECTURER') {
      const lecturer = await prisma.lecturer.findFirst({ where: { id: scopeId, userId: user.id } });
      if (lecturer) {
        const academy = lecturer.academyId
          ? await prisma.academy.findUnique({ where: { id: lecturer.academyId }, select: { id: true, name: true } })
          : null;
        const organization = academy
          ? await prisma.organization.findFirst({ where: { originalType: 'Academy', originalId: academy.id }, select: { id: true } })
          : null;
        const tokens = generateTokens({
          ...base,
          lecturerId: scopeId,
          organizationId: organization?.id,
          organizationOriginalId: academy?.id,
          organizationType: 'LECTURER',
          personType: 'LECTURER',
        });
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'lecturer', entityId: scopeId });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }
    if (scopeType === 'LABORATORY') {
      const membership = await prisma.laboratoryMember.findUnique({ where: { labId_userId: { labId: scopeId, userId: user.id } } });
      if (membership) {
        const scopedRole = userRoleForPartnerRole(membership.role, user.role);
        const organization = await prisma.organization.findFirst({ where: { originalType: 'Laboratory', originalId: scopeId } });
        const tokens = generateTokens({ ...base, role: scopedRole, organizationId: organization?.id, organizationOriginalId: scopeId, organizationType: 'LABORATORY' });
        await writeAuditLog({ userId: user.id, action: 'auth.switch_context', entity: 'laboratory', entityId: scopeId, details: { role: membership.role } });
        return res.json({ ok: true, data: tokens } satisfies ApiResponse);
      }
    }
    return res.status(403).json({ ok: false, error: 'У вас нет доступа к этому контексту' } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM switch-context error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при переключении контекста' } satisfies ApiResponse);
  }
});

iamRouter.post('/invitations', async (req: AuthRequest, res) => {
  try {
    const { organizationId, role, email, expiresInDays } = req.body as { organizationId?: string; role?: string; email?: string; expiresInDays?: number };
    if (!organizationId) return res.status(400).json({ ok: false, error: 'organizationId обязателен' } satisfies ApiResponse);
    const org = (await prisma.organization.findUnique({ where: { id: organizationId } })) || (await prisma.organization.findFirst({ where: { originalId: organizationId } }));
    if (!org) return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    const allowed = await canManageMembers(req.user!.id, org, req.user!.role === 'SUPERADMIN');
    if (!allowed) return res.status(403).json({ ok: false, error: 'Только владелец или администратор может приглашать' } satisfies ApiResponse);
    const invitation = await createInvitation({ organizationId: org.id, role, email, expiresInDays, createdBy: req.user!.id });
    return res.status(201).json({ ok: true, data: invitation } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM create invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать приглашение' } satisfies ApiResponse);
  }
});

iamRouter.get('/invitations', async (req: AuthRequest, res) => {
  try {
    const organizationId = String(req.query.organizationId || '');
    if (!organizationId) return res.status(400).json({ ok: false, error: 'organizationId обязателен' } satisfies ApiResponse);
    const org = (await prisma.organization.findUnique({ where: { id: organizationId } })) || (await prisma.organization.findFirst({ where: { originalId: organizationId } }));
    if (!org) return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    const allowed = await canManageMembers(req.user!.id, org, req.user!.role === 'SUPERADMIN');
    if (!allowed) return res.status(403).json({ ok: false, error: 'Недостаточно прав' } satisfies ApiResponse);
    const invitations = await prisma.organizationInvitation.findMany({ where: { organizationId: org.id, usedAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json({ ok: true, data: invitations } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM list invitations error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить приглашения' } satisfies ApiResponse);
  }
});

iamRouter.post('/invitations/:id/revoke', async (req: AuthRequest, res) => {
  try {
    const invitationId = String(req.params.id);
    const invitation = await prisma.organizationInvitation.findUnique({ where: { id: invitationId }, include: { organization: true } });
    if (!invitation) return res.status(404).json({ ok: false, error: 'Приглашение не найдено' } satisfies ApiResponse);
    const allowed = await canManageMembers(req.user!.id, invitation.organization, req.user!.role === 'SUPERADMIN');
    if (!allowed) return res.status(403).json({ ok: false, error: 'Недостаточно прав' } satisfies ApiResponse);
    if (invitation.usedAt) return res.status(409).json({ ok: false, error: 'Приглашение уже использовано' } satisfies ApiResponse);
    if (invitation.revokedAt) return res.status(409).json({ ok: false, error: 'Приглашение уже отозвано' } satisfies ApiResponse);
    const revoked = await prisma.organizationInvitation.updateMany({
      where: { id: invitationId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: req.user!.id },
    });
    if (revoked.count !== 1) return res.status(409).json({ ok: false, error: 'Приглашение уже изменено' } satisfies ApiResponse);
    await auditFromReq(req, { action: 'organization.invitation_revoked', entity: 'organization_invitation', entityId: invitationId, details: { organizationId: invitation.organizationId } });
    return res.json({ ok: true, data: { id: invitationId, revoked: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM revoke invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отозвать приглашение' } satisfies ApiResponse);
  }
});

iamRouter.get('/invitations/lookup', async (req: AuthRequest, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ ok: false, error: 'code обязателен' } satisfies ApiResponse);
    const invitation = await prisma.organizationInvitation.findUnique({ where: { code }, include: { organization: { select: { id: true, name: true, type: true } } } });
    const rejection = rejectInvitation(invitation, { userEmail: req.user!.email });
    if (rejection) return res.status(rejection.status).json({ ok: false, error: rejection.error } satisfies ApiResponse);
    return res.json({ ok: true, data: { organization: invitation!.organization, role: invitation!.role, expiresAt: invitation!.expiresAt } } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM lookup invitation error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось проверить приглашение' } satisfies ApiResponse);
  }
});

iamRouter.post('/join-by-invite', async (req: AuthRequest, res) => {
  try {
    const code = String((req.body || {}).code || '').trim();
    if (!code) return res.status(400).json({ ok: false, error: 'code обязателен' } satisfies ApiResponse);
    const result = await acceptInvitation(code, { id: req.user!.id, email: req.user!.email });
    return res.status(201).json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    const status = (error as any)?.status;
    if (status) return res.status(status).json({ ok: false, error: (error as Error).message } satisfies ApiResponse);
    console.error('IAM join-by-invite error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось присоединиться к организации' } satisfies ApiResponse);
  }
});

iamRouter.get('/roles', async (_req: AuthRequest, res) => {
  try {
    const roles = await prisma.role.findMany({ include: { _count: { select: { permissions: true } } }, orderBy: { name: 'asc' } });
    return res.json({ ok: true, data: roles } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM roles error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить роли' } satisfies ApiResponse);
  }
});

iamRouter.post('/persons/:personId/roles', async (req: AuthRequest, res) => {
  try {
    const personId = String(req.params.personId);
    const { roleId, scopeType, scopeId } = req.body as { roleId: string; scopeType?: string; scopeId?: string };
    const person = await prisma.person.findUnique({ where: { id: personId }, include: { organization: true } });
    if (!person) return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    const allowed = await canManageRolesFor(req.user!, person.organization);
    if (!allowed) return res.status(403).json({ ok: false, error: 'Недостаточно прав для назначения роли' } satisfies ApiResponse);
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return res.status(404).json({ ok: false, error: 'Роль не найдена' } satisfies ApiResponse);
    if (String(role.key).toUpperCase() === 'SUPERADMIN' && req.user!.role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'Роль SUPERADMIN может назначать только SUPERADMIN' } satisfies ApiResponse);
    }
    const effectiveScopeType = scopeType ?? (person.organization ? 'organization' : 'platform');
    const effectiveScopeId = effectiveScopeType === 'organization' ? (scopeId ?? person.organization?.id ?? undefined) : undefined;
    if (effectiveScopeType === 'organization' && !effectiveScopeId) {
      return res.status(400).json({ ok: false, error: 'Для организационной роли требуется scopeId' } satisfies ApiResponse);
    }
    const scopeKey = effectiveScopeType === 'organization' && effectiveScopeId ? `organization:${effectiveScopeId}` : 'platform';
    const assignment = await prisma.personRole.upsert({
      where: { personId_roleId_scopeKey: { personId, roleId, scopeKey } },
      update: { scopeType: effectiveScopeType, scopeId: effectiveScopeId ?? null },
      create: { id: uid(), personId, roleId, scopeType: effectiveScopeType, scopeId: effectiveScopeId, scopeKey },
    });
    await auditFromReq(req, { action: 'person_role.assigned', entity: 'person_role', entityId: assignment.id, details: { personId, roleId, roleName: role.name, scopeType: scopeType || null, scopeId: scopeId || null } });
    return res.status(201).json({ ok: true, data: assignment } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM assign role error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось назначить роль' } satisfies ApiResponse);
  }
});

iamRouter.delete('/persons/:personId/roles/:roleId', async (req: AuthRequest, res) => {
  try {
    const personId = String(req.params.personId);
    const roleId = String(req.params.roleId);
    const person = await prisma.person.findUnique({ where: { id: personId }, include: { organization: true } });
    if (!person) return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    const allowed = await canManageRolesFor(req.user!, person.organization);
    if (!allowed) return res.status(403).json({ ok: false, error: 'Недостаточно прав для удаления роли' } satisfies ApiResponse);
    const scopeKey = person.organization ? `organization:${person.organization.id}` : 'platform';
    await prisma.personRole.deleteMany({ where: { personId, roleId, scopeKey } });
    await auditFromReq(req, { action: 'person_role.removed', entity: 'person_role', entityId: `${personId}:${roleId}`, details: { personId, roleId } });
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('IAM remove role error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить роль' } satisfies ApiResponse);
  }
});

export default iamRouter;
