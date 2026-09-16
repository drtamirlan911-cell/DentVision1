import prisma from './prisma.js';
import { permissionsForRole } from './permissions.js';

/**
 * Effective permissions for a user in a given org scope.
 *
 * Source of truth: the DB Person → PersonRole → Role → Permission graph
 * (backfilled by migrate-unified-schema.ts). The shared role matrix is the
 * baseline for the resolved scoped role; DB grants are additive to it.
 *
 * Note: for SUPERADMIN the role matrix is already a wildcard (all keys).
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
  const scopedRole = fallbackRole ? String(fallbackRole).toUpperCase() : null;
  const roleBaseline = scopedRole ? permissionsForRole(scopedRole) : null;

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
      const perms = new Set<string>(roleBaseline || []);
      for (const pr of person.personRoles) {
        for (const rp of pr.role.permissions) perms.add(rp.permission.key);
      }
      if (perms.size > 0) return Array.from(perms);
    }
  } catch {
    // Fall through to the role matrix.
  }

  if (roleBaseline) return roleBaseline;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return permissionsForRole(user?.role ? String(user.role).toUpperCase() : user?.role);
}
