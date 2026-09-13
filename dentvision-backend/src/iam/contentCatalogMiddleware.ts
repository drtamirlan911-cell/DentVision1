import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  audiencesFromCourseMeta,
  audiencesFromProductTags,
  canExposeCatalogItem,
  resolveActiveContentContext,
} from './contentCatalogAccess.js';

function isCatalogPath(path: string): 'ACADEMY' | 'MARKETPLACE' | null {
  if (path.startsWith('/api/school')) return 'ACADEMY';
  if (path.startsWith('/api/shop')) return 'MARKETPLACE';
  return null;
}

function filterItems<T>(items: unknown, surface: 'ACADEMY' | 'MARKETPLACE', context: ReturnType<typeof resolveActiveContentContext>, getAudiences: (item: T) => readonly any[]): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => canExposeCatalogItem(surface, context, getAudiences(item as T)));
}

function filterAcademyCourseList(items: unknown, context: ReturnType<typeof resolveActiveContentContext>) {
  return filterItems(items, 'ACADEMY', context, (item: any) => audiencesFromCourseMeta(item?.meta));
}

function filterAcademyHub(data: any, context: ReturnType<typeof resolveActiveContentContext>) {
  const out = { ...data };
  for (const key of ['webinars', 'officeCourses', 'textbooks', 'courses', 'live']) {
    if (Array.isArray(out[key])) out[key] = filterAcademyCourseList(out[key], context);
  }
  // Clinical cases and the library are professional-only until they carry
  // explicit audience metadata of their own.
  if (Array.isArray(out.cases) && !canExposeCatalogItem('ACADEMY', context, ['PROFESSIONAL'])) out.cases = [];
  if (Array.isArray(out.library) && !canExposeCatalogItem('ACADEMY', context, ['PROFESSIONAL'])) out.library = [];
  if (Array.isArray(out.certificates)) out.certificates = filterAcademyCourseList(out.certificates, context);
  return out;
}

function filterMarketplaceList(items: unknown, context: ReturnType<typeof resolveActiveContentContext>) {
  return filterItems(items, 'MARKETPLACE', context, (item: any) => audiencesFromProductTags(item?.tags));
}

/**
 * Final server-side enforcement for the real Academy/Marketplace HTTP APIs.
 * Routes remain unchanged for compatibility; this middleware wraps res.json
 * before route execution and filters the exact catalog payloads that leave the
 * process. A denied detail item becomes 404, preventing existence probing.
 */
export function contentCatalogMiddleware(req: Request, res: Response, next: NextFunction) {
  const surface = isCatalogPath(req.path);
  if (!surface) return next();

  const context = resolveActiveContentContext(req);
  const originalJson = res.json.bind(res);

  res.json = ((body: any) => {
    if (!body || body.ok !== true) return originalJson(body);

    const isAcademy = surface === 'ACADEMY';
    const isHub = isAcademy && req.path === '/api/school/hub';
    const isCourseList = isAcademy && req.path === '/api/school/courses';
    const isCourseDetail = isAcademy && /^\/api\/school\/courses\/[^/]+$/.test(req.path);
    const isProductList = !isAcademy && req.path === '/api/shop/products';
    const isProductDetail = !isAcademy && /^\/api\/shop\/products\/[^/]+$/.test(req.path);

    if (isHub) {
      body = { ...body, data: filterAcademyHub(body.data || {}, context) };
    } else if (isCourseList) {
      body = { ...body, data: filterAcademyCourseList(body.data, context) };
    } else if (isCourseDetail) {
      const course = body.data;
      if (!course || !canExposeCatalogItem('ACADEMY', context, audiencesFromCourseMeta(course.meta))) {
        res.status(404);
        body = { ok: false, error: 'Course not found' };
      }
    } else if (isProductList) {
      body = { ...body, data: filterMarketplaceList(body.data, context) };
    } else if (isProductDetail) {
      const product = body.data;
      if (!product || !canExposeCatalogItem('MARKETPLACE', context, audiencesFromProductTags(product.tags))) {
        res.status(404);
        body = { ok: false, error: 'Product not found' };
      }
    }

    return originalJson(body);
  }) as Response['json'];

  return next();
}

/**
 * app.ts is intentionally kept free of catalog-specific wiring. The IAM
 * contexts module is loaded during application startup, so install the same
 * guard on Express' response prototype once. This guarantees that every real
 * /api/school and /api/shop endpoint is protected, including routes mounted
 * by compatibility modules, without duplicating route logic.
 */
export function installContentCatalogJsonGuard(): void {
  const response = express.response as Response & { __dentvisionCatalogGuard?: boolean };
  if (response.__dentvisionCatalogGuard) return;

  const originalJson = response.json;
  response.json = function guardedJson(this: Response, body: any) {
    const req = this.req as Request;
    const surface = isCatalogPath(req.path);
    if (!surface || !body || body.ok !== true) return originalJson.call(this, body);

    const context = resolveActiveContentContext(req);
    const isAcademy = surface === 'ACADEMY';
    const isHub = isAcademy && req.path === '/api/school/hub';
    const isCourseList = isAcademy && req.path === '/api/school/courses';
    const isCourseDetail = isAcademy && /^\/api\/school\/courses\/[^/]+$/.test(req.path);
    const isProductList = !isAcademy && req.path === '/api/shop/products';
    const isProductDetail = !isAcademy && /^\/api\/shop\/products\/[^/]+$/.test(req.path);

    if (isHub) {
      body = { ...body, data: filterAcademyHub(body.data || {}, context) };
    } else if (isCourseList) {
      body = { ...body, data: filterAcademyCourseList(body.data, context) };
    } else if (isCourseDetail) {
      const course = body.data;
      if (!course || !canExposeCatalogItem('ACADEMY', context, audiencesFromCourseMeta(course.meta))) {
        this.status(404);
        body = { ok: false, error: 'Course not found' };
      }
    } else if (isProductList) {
      body = { ...body, data: filterMarketplaceList(body.data, context) };
    } else if (isProductDetail) {
      const product = body.data;
      if (!product || !canExposeCatalogItem('MARKETPLACE', context, audiencesFromProductTags(product.tags))) {
        this.status(404);
        body = { ok: false, error: 'Product not found' };
      }
    }

    return originalJson.call(this, body);
  } as Response['json'];
  response.__dentvisionCatalogGuard = true;
}
