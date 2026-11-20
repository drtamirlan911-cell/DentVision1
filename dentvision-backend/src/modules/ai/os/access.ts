/**
 * AI tool access resolver — the single entry point that decides which tools a
 * caller may invoke.
 *
 * Replaces the previous `toolsForRole(req.user.role)` calls, which trusted a
 * raw role string. Three problems with that:
 *
 *   1. `req.user.role` is the *global* User.role. A user who is OWNER of one
 *      clinic and DOCTOR in another got the owner tool set everywhere, and
 *      staff that exist only in the unified model (Person/PersonRole, no
 *      ClinicMember) got whatever their legacy column happened to say.
 *   2. On `/query` and `/query/stream` the router runs under `optionalAuth`,
 *      which decodes the JWT without touching the database — so both the role
 *      and the clinicId were unverified claims: stale after a role change or
 *      a revoked session, and never checked for membership.
 *   3. The tool surface was never reconciled with the permission model the REST
 *      routes enforce, so the assistant could act where the UI refuses.
 *
 * This resolver reads the database on every call: the effective clinic-scoped
 * role (Person → PersonRole first, ClinicMember fallback), the effective
 * permission set for that scope, and a clinicId that is only returned once
 * membership is proven.
 */

import prisma from '../../../lib/prisma.js';
import { resolveClinicAccess, resolveOrganizationIdForClinic } from '../../../lib/orgContext.js';
import { resolveUserPermissions } from '../../../lib/resolvePermissions.js';
import { toolsForRole } from './registry.js';
import { TOOL_PERMISSIONS, permissionsSatisfy } from './toolPermissions.js';
import { employeeContractForRole, type AiEmployeeContract } from './employeeContract.js';

export interface AiToolAccess {
  /** Effective role resolved from the active organization membership. */
  role: string;
  /** Clinic scope — null unless clinic membership was verified. */
  clinicId: string | null;
  /** Canonical organization scope — null unless organization membership was verified. */
  organizationId: string | null;
  /** Canonical organization type read from the database, never the JWT claim. */
  organizationType: string | null;
  /** Original domain entity ID from a verified Organization link (e.g. Laboratory.id). */
  organizationOriginalId: string | null;
  /** Legacy supplier entity scope, present only after membership verification. */
  supplierId: string | null;
  /** Lecturer entity scope, present only after ownership verification. */
  lecturerId: string | null;
  /** Tool names this caller may invoke. */
  allowed: Set<string>;
  /** Deterministic role-bound AI employee identity and autonomy contract. */
  employee: AiEmployeeContract;
}

export interface AiToolAccessInput {
  userId: string;
  /** Requested clinic scope (JWT claim) — verified here, not trusted. */
  clinicId?: string | null;
  /** Active unified workspace scope from the authenticated context. */
  organizationId?: string | null;
  organizationType?: string | null;
  supplierId?: string | null;
  lecturerId?: string | null;
  isGuest?: boolean;
}

/**
 * Guests never touch clinic data: their agent set is static and no database
 * lookup is warranted (the guest JWT carries no membership to verify).
 */
function guestAccess(): AiToolAccess {
  return {
    role: 'GUEST',
    clinicId: null,
    organizationId: null,
    organizationType: null,
    organizationOriginalId: null,
    supplierId: null,
    lecturerId: null,
    allowed: toolsForRole('GUEST'),
    employee: employeeContractForRole('GUEST'),
  };
}

export async function resolveAiToolAccess(input: AiToolAccessInput): Promise<AiToolAccess> {
  if (input.isGuest || !input.userId || input.userId === 'guest') return guestAccess();

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { role: true },
  });
  if (!user) return guestAccess();

  if (user.role === 'SUPERADMIN') {
    return {
      role: 'SUPERADMIN',
      clinicId: input.clinicId || null,
      organizationId: input.organizationId || null,
      organizationType: input.organizationType || null,
      organizationOriginalId: null,
      supplierId: input.supplierId || null,
      lecturerId: input.lecturerId || null,
      allowed: toolsForRole('SUPERADMIN'),
      employee: employeeContractForRole('SUPERADMIN'),
    };
  }

  // Resolve the active workspace, not the user's historical/global role.
  // Partner identities are carried through the token, but the organization,
  // Person/PersonRole and legacy membership are re-verified on every call.
  let role = String(user.role);
  let clinicId: string | null = null;
  let organizationId: string | null = null;
  let organizationType: string | null = null;
  let organizationOriginalId: string | null = null;
  let supplierId: string | null = null;
  let lecturerId: string | null = null;

  const hasNonClinicWorkspace = Boolean(
    input.supplierId
    || input.lecturerId
    || (input.organizationId && input.organizationType && input.organizationType !== 'CLINIC'),
  );

  if (input.clinicId && !hasNonClinicWorkspace) {
    const membership = await resolveClinicAccess(input.userId, input.clinicId);
    if (!membership) return guestAccess();

    role = membership.role;
    clinicId = input.clinicId;
    organizationId = await resolveOrganizationIdForClinic(input.clinicId);
    organizationType = 'CLINIC';
  } else if (input.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, type: true, originalType: true, originalId: true, archivedAt: true },
    });
    if (!org || org.archivedAt) return guestAccess();

    organizationId = org.id;
    organizationType = String(org.type);
    organizationOriginalId = org.originalType === 'Laboratory' && org.originalId
      ? String(org.originalId)
      : null;
    const person = await prisma.person.findFirst({
      where: { userId: input.userId, organizationId: org.id },
      include: { personRoles: { include: { role: true } } },
    });

    if (person) {
      const roleKeys = person.personRoles
        .filter((pr) => pr.scopeType === 'organization' && pr.scopeId === org.id)
        .map((pr) => String(pr.role.key).toUpperCase());
      const preferred = roleKeys.find((key) =>
        key.startsWith('DIAGNOSTIC_')
        || key.startsWith('MEDICAL_LAB_')
        || key.startsWith('DENTAL_LAB_')
        || key === 'DENTAL_TECHNICIAN'
        || key === 'SUPPLIER'
        || key === 'SELLER'
        || key === 'LECTURER'
        || key === 'ACADEMY'
        || key === 'OWNER'
        || key === 'ADMIN'
        || key === 'MANAGER'
        || key.startsWith('EMPLOYER_'),
      );

      if (org.type === 'SUPPLIER_COMPANY' || person.personType === 'SUPPLIER_REP') {
        const verifiedSupplierId = org.originalId ? String(org.originalId) : null;
        if (input.supplierId && input.supplierId !== verifiedSupplierId) return guestAccess();
        role = 'SUPPLIER';
        supplierId = verifiedSupplierId;
      } else if (person.personType === 'LECTURER') {
        const verifiedLecturerId = input.lecturerId || (person.originalId ? String(person.originalId) : null);
        if (input.lecturerId && person.originalId && input.lecturerId !== person.originalId) return guestAccess();
        if (verifiedLecturerId) {
          const lecturer = await prisma.lecturer.findFirst({
            where: { id: verifiedLecturerId, userId: input.userId },
            select: { id: true },
          });
          if (!lecturer) return guestAccess();
          lecturerId = verifiedLecturerId;
        }
        role = 'LECTURER';
      } else {
        // Never fall back to global User.role when the active Person has no
        // organization-scoped role/person type. That could widen a former
        // clinic OWNER into an unrelated partner workspace.
        const scopedRole = preferred || String(person.personType || '').toUpperCase();
        if (!scopedRole) return guestAccess();
        role = scopedRole;
      }
      if (role === 'SELLER') role = 'SUPPLIER';
    } else if (input.supplierId && org.originalId === input.supplierId) {
      // Compatibility for supplier workspaces still backed by SupplierMember
      // while their Person/PersonRole migration is being completed.
      const membership = await prisma.supplierMember.findUnique({
        where: { userId_supplierId: { userId: input.userId, supplierId: input.supplierId } },
        select: { role: true },
      });
      if (!membership) return guestAccess();
      role = 'SUPPLIER';
      supplierId = input.supplierId;
    } else if (input.lecturerId) {
      // Lecturer ownership is independently checked; a raw token claim alone
      // can never grant an academy workspace.
      const lecturer = await prisma.lecturer.findFirst({
        where: { id: input.lecturerId, userId: input.userId },
        select: { id: true },
      });
      const lecturerPerson = lecturer
        ? await prisma.person.findFirst({
            where: { userId: input.userId, originalId: input.lecturerId, organizationId: org.id },
            select: { id: true },
          })
        : null;
      if (!lecturer || !lecturerPerson) return guestAccess();
      role = 'LECTURER';
      lecturerId = input.lecturerId;
    } else {
      return guestAccess();
    }
  } else if (input.supplierId) {
    const membership = await prisma.supplierMember.findUnique({
      where: { userId_supplierId: { userId: input.userId, supplierId: input.supplierId } },
      select: { role: true },
    });
    if (!membership) return guestAccess();

    role = 'SUPPLIER';
    supplierId = input.supplierId;
    const org = await prisma.organization.findFirst({
      where: { originalId: input.supplierId },
      select: { id: true, type: true, originalType: true, originalId: true },
    });
    organizationId = org?.id || null;
    organizationType = org ? String(org.type) : null;
    organizationOriginalId = org?.originalType === 'Laboratory' && org.originalId
      ? String(org.originalId)
      : null;
  } else if (input.lecturerId) {
    const lecturer = await prisma.lecturer.findFirst({
      where: { id: input.lecturerId, userId: input.userId },
      select: { id: true },
    });
    if (!lecturer) return guestAccess();

    role = 'LECTURER';
    lecturerId = input.lecturerId;
    const person = await prisma.person.findFirst({
      where: { userId: input.userId, originalId: input.lecturerId },
      select: { organizationId: true },
    });
    if (person?.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: person.organizationId },
        select: { id: true, type: true },
      });
      if (org) {
        organizationId = org.id;
        organizationType = String(org.type);
      }
    }
  }

  // Clinic migrations may still be incomplete; only verified clinic membership
  // may use that fallback. Partner scopes always use their verified org id.
  const permissionScopeId = organizationId || clinicId;
  const permissions = new Set(
    permissionScopeId
      ? await resolveUserPermissions(input.userId, permissionScopeId, role).catch(() => [])
      : [],
  );

  const allowed = new Set<string>();
  for (const tool of toolsForRole(role)) {
    const required = TOOL_PERMISSIONS[tool];
    if (!required || permissionsSatisfy(permissions, required)) allowed.add(tool);
  }

  return {
    role,
    clinicId,
    organizationId,
    organizationType,
    organizationOriginalId,
    supplierId,
    lecturerId,
    allowed,
    employee: employeeContractForRole(role),
  };
}
