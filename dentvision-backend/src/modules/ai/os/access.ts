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
  /** Effective role driving agent selection and prompt wording. */
  role: string;
  /**
   * Clinic scope the tools may touch — null unless membership was verified.
   * Callers must build the ToolContext from this, never from the JWT claim.
   */
  clinicId: string | null;
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
  return { role: 'GUEST', clinicId: null, allowed: toolsForRole('GUEST'), employee: employeeContractForRole('GUEST') };
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
      allowed: toolsForRole('SUPERADMIN'),
      employee: employeeContractForRole('SUPERADMIN'),
    };
  }

  // Resolve the active workspace, not the user's historical/global role.
  // A single identity may be OWNER in a clinic, SUPPLIER in a supplier company
  // and LECTURER in an academy; using User.role here collapses those contexts.
  let role = String(user.role);
  let clinicId: string | null = null;
  let organizationId: string | null = input.organizationId || null;

  if (input.clinicId) {
    const access = await resolveClinicAccess(input.userId, input.clinicId);
    if (access) {
      role = access.role;
      clinicId = input.clinicId;
      organizationId = await resolveOrganizationIdForClinic(input.clinicId);
    }
  } else if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, type: true },
    });
    if (!org) {
      return { role: String(user.role), clinicId: null, allowed: new Set(), employee: employeeContractForRole(String(user.role)) };
    }
    const person = await prisma.person.findFirst({
      where: { userId: input.userId, organizationId },
      include: { personRoles: { include: { role: true } } },
    });
    if (person) {
      const roleKeys = person.personRoles.map((pr) => String(pr.role.key).toUpperCase());
      const preferred = roleKeys.find((key) =>
        key.startsWith('DIAGNOSTIC_')
        || key.startsWith('MEDICAL_LAB_')
        || key.startsWith('DENTAL_LAB_')
        || key === 'SUPPLIER'
        || key === 'SELLER'
        || key === 'LECTURER'
        || key === 'ACADEMY'
        || key === 'OWNER'
        || key === 'ADMIN'
        || key === 'MANAGER',
      );
      if (org.type === 'SUPPLIER_COMPANY' || person.personType === 'SUPPLIER_REP') {
        role = 'SUPPLIER';
      } else if (person.personType === 'LECTURER') {
        role = 'LECTURER';
      } else {
        role = preferred || String(person.personType || user.role);
      }
      if (role === 'SELLER') role = 'SUPPLIER';
    }
  } else if (input.supplierId) {
    const member = await prisma.supplierMember.findUnique({
      where: { userId_supplierId: { userId: input.userId, supplierId: input.supplierId } },
      select: { role: true },
    });
    if (!member) {
      return { role: 'GUEST', clinicId: null, allowed: new Set(), employee: employeeContractForRole('GUEST') };
    }
    role = 'SUPPLIER';
    const org = await prisma.organization.findFirst({ where: { originalId: input.supplierId } });
    organizationId = org?.id || null;
  } else if (input.lecturerId) {
    const lecturer = await prisma.lecturer.findFirst({
      where: { id: input.lecturerId, userId: input.userId },
      select: { id: true },
    });
    if (!lecturer) {
      return { role: 'GUEST', clinicId: null, allowed: new Set(), employee: employeeContractForRole('GUEST') };
    }
    role = 'LECTURER';
    const person = await prisma.person.findFirst({
      where: { userId: input.userId, originalId: input.lecturerId },
      select: { organizationId: true },
    });
    organizationId = person?.organizationId || null;
  }

  const permissions = new Set(
    organizationId
      ? await resolveUserPermissions(input.userId, organizationId, role).catch(() => [])
      : [],
  );

  const allowed = new Set<string>();
  for (const tool of toolsForRole(role)) {
    const required = TOOL_PERMISSIONS[tool];
    if (!required || permissionsSatisfy(permissions, required)) allowed.add(tool);
  }

  return { role, clinicId, allowed, employee: employeeContractForRole(role) };
}
