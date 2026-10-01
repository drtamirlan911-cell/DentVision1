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

export function resolveActiveContentContext(req: Request): ActiveContentContext {
  // Catalog audience is a server-authorized property. Never let an anonymous
  // query/header value elevate PUBLIC into a professional workspace.
  const user = (req as Request & { user?: {
    role?: string;
    organizationType?: string;
  } }).user;
  if (!user) return 'PUBLIC';

  // The canonical workspace contract is carried by the JWT after
  // /iam/switch-context. Do not collapse every partner role into DOCTOR:
  // diagnostic/lab/supplier/academy workspaces need their own catalog audience.
  const organizationType = String(user.organizationType || '').toUpperCase();
  if (organizationType === 'DIAGNOSTIC_CENTER') return 'DIAGNOSTIC';
  if (organizationType === 'LABORATORY') {
    const role = String(user.role || '').toUpperCase();
    return role === 'DOCTOR' ? 'DOCTOR' : 'LAB';
  }
  if (organizationType === 'SUPPLIER' || organizationType === 'SUPPLIER_COMPANY') return 'SELLER';
  if (organizationType === 'ACADEMY') return 'LECTURER';

  const role = String(user.role || '').toUpperCase();
  if (role === 'STUDENT') return 'DENTAL_STUDENT';
  if (role === 'BUYER') return 'BUYER';
  if (PROFESSIONAL_USER_ROLES.has(role)) return 'DOCTOR';
  return 'PUBLIC';
}
function normalizeAudienceTags(tags: unknown): ContentAudience[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toUpperCase())
    .filter((v) => v.startsWith('AUDIENCE:'))
    .map((v) => v.slice('AUDIENCE:'.length))
    .filter((v) => VALID_AUDIENCES.has(v)) as ContentAudience[];
}

/**
 * Course audience is stored in Course.meta. Both `audiences: [...]` and the
 * existing Academy `tags: ['audience:...']` authoring path are accepted so the
 * current course CRUD API can classify content without a schema migration.
 * Missing metadata is PROFESSIONAL by default (fail closed for patients).
 */
export function audiencesFromCourseMeta(meta: unknown): readonly ContentAudience[] {
  if (!meta || typeof meta !== 'object') return ['PROFESSIONAL'];
  const record = meta as { audiences?: unknown; tags?: unknown };
  const explicit = Array.isArray(record.audiences)
    ? record.audiences.filter((v): v is string => typeof v === 'string').map((v) => v.toUpperCase()).filter((v) => VALID_AUDIENCES.has(v)) as ContentAudience[]
    : [];
  if (explicit.length) return explicit;

  const tagged = normalizeAudienceTags(record.tags);
  return tagged.length ? tagged : ['PROFESSIONAL'];
}

/**
 * Product audience uses the existing Product.tags JSON field with explicit
 * `audience:<value>` entries. Existing unclassified dental products are
 * PROFESSIONAL by default, preventing patient leakage until deliberately
 * marked GENERAL/PATIENT.
 */
export function audiencesFromProductTags(tags: unknown): readonly ContentAudience[] {
  const audiences = normalizeAudienceTags(tags);
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
