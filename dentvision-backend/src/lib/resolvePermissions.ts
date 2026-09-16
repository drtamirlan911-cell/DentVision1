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
  // When a caller does not provide a scoped role, still establish the global
  // User.role baseline before reading the DB graph. Returning only whatever
  // PersonRole rows happen to be seeded would make a valid OWNER/DOCTOR/etc.
  // appear to have a narrower permission set than the role contract.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const baselineRole = fallbackRole || user?.role || null;
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
        for (const rp of pr.role.permissions) perms.add(rp.permission.key);
      }
      if (perms.size > 0) return Array.from(perms);
    }
  } catch {
    // Fall through to the role matrix.
  }

  return roleBaseline;
}
