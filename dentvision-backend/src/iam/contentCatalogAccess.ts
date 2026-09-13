import type { Request } from 'express';
import {
  canAccessContent,
  type ActiveContentContext,
  type ContentAudience,
  type ContentSurface,
} from './contentAccessPolicy.js';

const VALID_AUDIENCES: ReadonlySet<string> = new Set<ContentAudience>([
  'GENERAL',
  'PATIENT',
  'PROFESSIONAL',
  'DOCTOR',
  'DENTAL_STUDENT',
  'ASSISTANT',
  'LAB',
  'DIAGNOSTIC',
  'SELLER',
]);

const PROFESSIONAL_USER_ROLES = new Set([
  'OWNER',
  'DOCTOR',
  'ASSISTANT',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'LAB',
  'SUPERADMIN',
]);

/**
 * Resolve the active content workspace from the explicit client context.
 * The explicit header/query wins over the user's other roles, so a Person who
 * is both a doctor and a patient stays in the selected PATIENT boundary.
 */
export function resolveActiveContentContext(req: Request): ActiveContentContext {
  const raw = String(req.get('x-dentvision-context') || req.query.context || '').trim().toUpperCase();
  if (raw === 'PATIENT' || raw === 'DOCTOR' || raw === 'DENTAL_STUDENT' || raw === 'ASSISTANT' || raw === 'LAB' || raw === 'DIAGNOSTIC' || raw === 'SELLER' || raw === 'LECTURER') {
    return raw;
  }

  const role = String((req as Request & { user?: { role?: string } }).user?.role || '').toUpperCase();
  if (role === 'STUDENT') return 'DENTAL_STUDENT';
  if (PROFESSIONAL_USER_ROLES.has(role)) return 'DOCTOR';
  return 'PUBLIC';
}

/**
 * Academy audience metadata lives in Course.meta to avoid a duplicate content
 * table. Existing courses without an explicit audience are treated as
 * PROFESSIONAL by default: an unclassified clinical course must never become
 * visible to a patient merely because old data predates the policy.
 */
export function audiencesFromCourseMeta(meta: unknown): readonly ContentAudience[] {
  const audiences = meta && typeof meta === 'object' && Array.isArray((meta as { audiences?: unknown }).audiences)
    ? (meta as { audiences: unknown[] }).audiences.filter((v): v is string => typeof v === 'string').map((v) => v.toUpperCase()).filter((v) => VALID_AUDIENCES.has(v)) as ContentAudience[]
    : [];
  return audiences.length ? audiences : ['PROFESSIONAL'];
}

/**
 * Marketplace Product already has a tags[] field. Audience tags are explicit
 * `audience:<value>` entries. Existing unclassified dental products are
 * treated as PROFESSIONAL by default, preventing patient leakage until a
 * seller/platform operator deliberately marks an item GENERAL/PATIENT.
 */
export function audiencesFromProductTags(tags: unknown): readonly ContentAudience[] {
  if (!Array.isArray(tags)) return ['PROFESSIONAL'];
  const audiences = tags
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toUpperCase())
    .filter((v) => v.startsWith('AUDIENCE:'))
    .map((v) => v.slice('AUDIENCE:'.length))
    .filter((v) => VALID_AUDIENCES.has(v)) as ContentAudience[];
  return audiences.length ? audiences : ['PROFESSIONAL'];
}

export function canExposeCatalogItem(surface: ContentSurface, activeContext: ActiveContentContext, audiences: readonly ContentAudience[]): boolean {
  return canAccessContent({ surface, activeContext, audiences });
}

export function filterCatalogItems<T>(
  items: readonly T[],
  surface: ContentSurface,
  activeContext: ActiveContentContext,
  getAudiences: (item: T) => readonly ContentAudience[],
): T[] {
  return items.filter((item) => canExposeCatalogItem(surface, activeContext, getAudiences(item)));
}
