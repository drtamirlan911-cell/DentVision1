/**
 * Canonical client routes for ecosystem actions.
 * Workspace definitions describe intent; this resolver keeps navigation aligned
 * with the actual application route tree and prevents conceptual paths from
 * becoming dead links.
 */
const ROUTE_ALIASES: Record<string, string> = {
  '/dashboard': '/',
  '/appointments': '/crm/schedule',
  '/crm/team': '/crm/staff',
  '/settings/branches': '/my-clinics',
  '/analytics': '/analytics',
};

export function resolveEcosystemRoute(path: string): string {
  return ROUTE_ALIASES[path] || path;
}
