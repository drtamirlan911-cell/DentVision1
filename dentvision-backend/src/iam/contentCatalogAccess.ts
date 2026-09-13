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
  const raw = String(req.get('x-dentvision-context') || req.query.context || '').trim().toUpperCase();
  if (raw === 'PATIENT' || raw === 'DOCTOR' || raw === 'DENTAL_STUDENT' || raw === 'ASSISTANT' || raw === 'LAB' || raw === 'DIAGNOSTIC' || raw === 'SELLER' || raw === 'LECTURER') {
    return raw;
  }

  const role = String((req as Request & { user?: { role?: string } }).user?.role || '').toUpperCase();
  if (role === 'STUDENT') return 'DENTAL_STUDENT';
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
