/**
 * AI tool access resolver — the single entry point that decides which tools a
 * caller may invoke.
 *
 * Replaces the previous `toolsForRole(req.user.role)` calls, which trusted a
 * raw role string. Three problems with that:
 *
 *   1. `req.user.role` is the *global* `User.role`. A user who is OWNER of one
 *      clinic and DOCTOR in another got the owner tool set everywhere, and
 *      staff that exist only in the unified model (Person/PersonRole, no
 *      ClinicMember) got whatever their legacy column happened to say.
 *   2. On `/query` and `/query/stream` the router runs under `optionalAuth`,
 *      which decodes the JWT without touching the database — so both the role
 *      and the clinicId were unverified claims: stale after a role change or a
 *      revoked session, and never checked for membership.
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
}

export interface AiToolAccessInput {
  userId: string;
  /** Requested clinic scope (JWT claim) — verified here, not trusted. */
  clinicId?: string | null;
  isGuest?: boolean;
}

/**
 * Guests never touch clinic data: their agent set is static and no database
 * lookup is warranted (the guest JWT carries no membership to verify).
 */
function guestAccess(): AiToolAccess {
  return { role: 'GUEST', clinicId: null, allowed: toolsForRole('GUEST') };
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
    };
  }

  // Verify the requested clinic scope before anything is allowed to read it.
  let role = String(user.role);
  let clinicId: string | null = null;
  let organizationId: string | null = null;
  if (input.clinicId) {
    const access = await resolveClinicAccess(input.userId, input.clinicId);
    if (access) {
      role = access.role;
      clinicId = input.clinicId;
      // `resolveUserPermissions` scopes by Organization.id, and a clinic id is
      // a different value — the Person lookup matched nothing, so the DB
      // permission graph never contributed here and every AI tool decision
      // fell back to the hardcoded role matrix. The same mistake was already
      // found and fixed in auth.routes.ts.
      organizationId = await resolveOrganizationIdForClinic(input.clinicId);
    }
  }

  const permissions = new Set(
    await resolveUserPermissions(input.userId, organizationId ?? clinicId, role),
  );

  const allowed = new Set<string>();
  for (const tool of toolsForRole(role)) {
    const required = TOOL_PERMISSIONS[tool];
    if (!required || permissionsSatisfy(permissions, required)) allowed.add(tool);
  }

  return { role, clinicId, allowed };
}
