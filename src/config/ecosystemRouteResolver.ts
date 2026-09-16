/**
 * Canonical client routes for ecosystem actions.
 * Workspace definitions describe intent; this resolver keeps navigation aligned
 * with the actual application route tree and prevents conceptual paths from
 * becoming dead links.
 *
 * Keep this map deliberately small: only aliases for routes that are known to
 * exist elsewhere in the product belong here. Domain-specific context is
 * appended by ecosystemContextLink rather than encoded in these aliases.
 */
const ROUTE_ALIASES: Record<string, string> = {
  '/dashboard': '/',
  '/appointments': '/crm/schedule',
  '/crm/team': '/crm/staff',
  '/crm/cases': '/crm/treatment-plans',
  '/settings/branches': '/my-clinics',
  '/analytics': '/analytics',
};

export function resolveEcosystemRoute(path: string): string {
  return ROUTE_ALIASES[path] || path;
}
