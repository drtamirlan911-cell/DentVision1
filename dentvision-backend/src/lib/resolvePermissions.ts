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
 */
export async function resolveUserPermissions(userId: string, scopeId?: string | null): Promise<string[]> {
  try {
    const person = await prisma.person.findFirst({
      where: scopeId ? { userId, organizationId: scopeId } : { userId },
      include: {
        personRoles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
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

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return permissionsForRole(user?.role);
}
