import prisma from './prisma.js';
import { permissionsForRole } from './permissions.js';

/**
 * Effective permissions for a user in a given org scope.
 *
 * Source of truth: the DB Person → PersonRole → Role → Permission graph
 * (backfilled by migrate-unified-schema.ts). Falls back to the shared role
 * matrix when no Person/PersonRole exists yet, so the response is always a
 * complete, usable permission set.
 *
 * Note: for SUPERADMIN the role matrix is already a wildcard (all keys).
 *
 * `fallbackRole` lets a caller that has already resolved the *scoped* role
 * (e.g. via resolveClinicAccess) drive the matrix fallback with it instead of
 * the user's global User.role — a user can be OWNER of one clinic and DOCTOR
 * in another, and the fallback must not hand them the wider set.
 */
export async function resolveUserPermissions(
  userId: string,
  scopeId?: string | null,
  fallbackRole?: string | null,
): Promise<string[]> {
  try {
    const person = await prisma.person.findFirst({
      where: scopeId ? { userId, organizationId: scopeId } : { userId },
      include: {
        personRoles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
      // A user can now hold a Person in several organizations, so an unscoped
      // lookup must not depend on whatever row the database returns first —
      // pin it to the oldest membership.
      orderBy: { createdAt: 'asc' },
    });
    if (person) {
      const perms = new Set<string>();
      for (const pr of person.personRoles) {
        for (const rp of pr.role.permissions) perms.add(rp.permission.key);
      }
      if (perms.size > 0) return Array.from(perms);
    }
  } catch {
    // Fall through to the role matrix.
  }

  if (fallbackRole) return permissionsForRole(fallbackRole);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return permissionsForRole(user?.role);
}
