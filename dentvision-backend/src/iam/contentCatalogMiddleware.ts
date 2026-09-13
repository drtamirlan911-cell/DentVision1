import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  audiencesFromCourseMeta,
  audiencesFromProductTags,
  canExposeCatalogItem,
  resolveActiveContentContext,
} from './contentCatalogAccess.js';

function requestPath(req: Request): string {
  const raw = req.originalUrl || req.url || req.path;
  return raw.split('?')[0];
}

function isCatalogPath(path: string): 'ACADEMY' | 'MARKETPLACE' | null {
  if (path.startsWith('/api/school')) return 'ACADEMY';
  if (path.startsWith('/api/shop')) return 'MARKETPLACE';
  return null;
}

function filterItems<T>(
  items: unknown,
  surface: 'ACADEMY' | 'MARKETPLACE',
  context: ReturnType<typeof resolveActiveContentContext>,
  getAudiences: (item: T) => readonly any[],
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => canExposeCatalogItem(surface, context, getAudiences(item as T)));
}

function filterAcademyCourseList(items: unknown, context: ReturnType<typeof resolveActiveContentContext>) {
  return filterItems(items, 'ACADEMY', context, (item: any) => audiencesFromCourseMeta(item?.meta));
}

function filterAcademyCoursePayload(data: any, context: ReturnType<typeof resolveActiveContentContext>) {
  if (Array.isArray(data)) return filterAcademyCourseList(data, context);
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  if (Array.isArray(out.courses)) out.courses = filterAcademyCourseList(out.courses, context);
  if (Array.isArray(out.items)) out.items = filterAcademyCourseList(out.items, context);
  return out;
}

function filterAcademyHub(data: any, context: ReturnType<typeof resolveActiveContentContext>) {
  const out = { ...data };
  for (const key of ['webinars', 'officeCourses', 'textbooks', 'courses', 'live']) {
    if (Array.isArray(out[key])) out[key] = filterAcademyCourseList(out[key], context);
  }
  if (Array.isArray(out.cases) && !canExposeCatalogItem('ACADEMY', context, ['PROFESSIONAL'])) out.cases = [];
  if (Array.isArray(out.library) && !canExposeCatalogItem('ACADEMY', context, ['PROFESSIONAL'])) out.library = [];
  if (Array.isArray(out.certificates)) out.certificates = filterAcademyCourseList(out.certificates, context);
  return out;
}

function filterMarketplaceList(items: unknown, context: ReturnType<typeof resolveActiveContentContext>) {
  return filterItems(items, 'MARKETPLACE', context, (item: any) => audiencesFromProductTags(item?.tags));
}

function filterMarketplacePayload(data: any, context: ReturnType<typeof resolveActiveContentContext>) {
  if (Array.isArray(data)) return filterMarketplaceList(data, context);
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  if (Array.isArray(out.products)) out.products = filterMarketplaceList(out.products, context);
  if (Array.isArray(out.items)) out.items = filterMarketplaceList(out.items, context);
  return out;
}

function guardCatalogResponse(req: Request, res: Response, body: any) {
  const path = requestPath(req);
  const surface = isCatalogPath(path);
  if (!surface || !body) return body;

  const context = resolveActiveContentContext(req);
  const isAcademy = surface === 'ACADEMY';
  const isHub = isAcademy && path === '/api/school/hub';
  const isCourseList = isAcademy && path === '/api/school/courses';
  const isCourseDetail = isAcademy && /^\/api\/school\/courses\/[^/]+$/.test(path);
  const isProductList = !isAcademy && path === '/api/shop/products';
  const isProductDetail = !isAcademy && /^\/api\/shop\/products\/[^/]+$/.test(path);

  if (isHub) {
    body = { ...body, data: filterAcademyHub(body.data || {}, context) };
  } else if (isCourseList) {
    body = { ...body, data: filterAcademyCoursePayload(body.data, context) };
  } else if (isCourseDetail) {
    const course = body.data;
    if (!course || !canExposeCatalogItem('ACADEMY', context, audiencesFromCourseMeta(course.meta))) {
      res.status(404);
      body = { ok: false, error: 'Course not found' };
    }
  } else if (isProductList) {
    body = { ...body, data: filterMarketplacePayload(body.data, context) };
  } else if (isProductDetail) {
    const product = body.data;
    if (!product || !canExposeCatalogItem('MARKETPLACE', context, audiencesFromProductTags(product.tags))) {
      res.status(404);
      body = { ok: false, error: 'Product not found' };
    }
  }

  return body;
}

/**
 * Route middleware variant retained for compatibility with callers that mount
 * it explicitly. The application-wide response guard below is the canonical
 * enforcement point so mounted/compatibility catalog routes cannot bypass it.
 */
export function contentCatalogMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => originalJson(guardCatalogResponse(req, res, body))) as Response['json'];
  return next();
}

/** Install the server-side catalog policy exactly once for every Express response. */
export function installContentCatalogJsonGuard(): void {
  const response = express.response as Response & { __dentvisionCatalogGuard?: boolean };
  if (response.__dentvisionCatalogGuard) return;

  const originalJson = response.json;
  response.json = function guardedJson(this: Response, body: any) {
    return originalJson.call(this, guardCatalogResponse(this.req as Request, this, body));
  } as Response['json'];
  response.__dentvisionCatalogGuard = true;
}
