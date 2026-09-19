import prisma from './prisma.js';
import { permissionsForRole } from './permissions.js';

/**
 * Effective permissions for a user in a given org scope.
 *
 * Source of truth: the DB Person → PersonRole → Role → Permission graph
 * (backfilled by migrate-unified-schema.ts). The shared role matrix is the
 * baseline for the resolved role; DB grants are additive to it.
 *
 * `fallbackRole` lets a caller that has already resolved the *scoped* role
 * (e.g. via resolveClinicAccess) drive the matrix with it instead of the
 * user's global User.role — a user can be OWNER of one clinic and DOCTOR
 * in another, and the baseline must follow the scoped role.
 */
export async function resolveUserPermissions(
  userId: string,
  scopeId?: string | null,
  fallbackRole?: string | null,
): Promise<string[]> {
  // An explicitly scoped lookup must preserve the existing PersonRole contract
  // unless the caller supplies the already-resolved scoped role. Only an
  // unscoped lookup lacks role context, so it may safely use User.role as its
  // baseline to avoid sparse PersonRole data narrowing the global contract.
  let baselineRole = fallbackRole || null;
  if (!baselineRole && !scopeId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      baselineRole = user?.role || null;
    } catch {
      // Fall through to the DB graph / empty baseline below.
    }
  }
  const roleBaseline = baselineRole
    ? permissionsForRole(String(baselineRole).toUpperCase())
    : [];

  try {
    const person = await prisma.person.findFirst({
      where: scopeId ? { userId, organizationId: scopeId } : { userId },
      include: {
        personRoles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
      // A user can hold a Person in several organizations, so an unscoped
      // lookup must not depend on whatever row the database returns first —
      // pin it to the oldest membership.
      orderBy: { createdAt: 'asc' },
    });

    if (person) {
      const perms = new Set<string>(roleBaseline);
      for (const pr of person.personRoles) {
        // PersonRole is scoped: never leak permissions from another organization
        // into the active access context. Global/unscoped roles remain applicable;
        // organization-scoped roles must match the requested organization.
        if (scopeId && pr.scopeId && pr.scopeId !== scopeId) continue;
        for (const rp of pr.role.permissions) perms.add(rp.permission.key);
      }
      if (perms.size > 0) return Array.from(perms);
    }
  } catch {
    // Fall through to the role matrix.
  }

  // For scoped calls without a fallback role, preserve the historical DB-first
  // behavior; role lookup is only a fallback when no Person grants are usable.
  if (!baselineRole) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      return permissionsForRole(user?.role ? String(user.role).toUpperCase() : user?.role);
    } catch {
      return roleBaseline;
    }
  }

  return roleBaseline;
}
