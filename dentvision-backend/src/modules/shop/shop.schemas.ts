import { z } from 'zod';

/**
 * Whitelist for supplier-writable Product fields. Deliberately excludes `id`,
 * `supplierId`, `sharedProductId`, `rating`, `reviewCount`, `createdAt`,
 * `updatedAt` — those are either server-assigned or derived, never supplied
 * by the request body. The route previously spread `...req.body` straight
 * into `prisma.product.create`/`update`, which let any of those be set (or
 * overridden) by whoever's making the request — including `supplierId`
 * itself, since the spread came *after* the trusted value in the object
 * literal and later keys win.
 */
export const productBodySchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  categoryId: z.string().optional(),
  price: z.union([z.number(), z.string()]),
  oldPrice: z.union([z.number(), z.string()]).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().max(2000).optional(),
  images: z.array(z.string()).optional(),
  ownBrand: z.boolean().optional(),
  sku: z.string().max(100).optional(),
  unit: z.string().max(50).optional(),
  currency: z.string().max(10).optional(),
  tags: z.array(z.string()).optional(),
  specs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  videoUrl: z.string().max(2000).optional(),
  model3dUrl: z.string().max(2000).optional(),
  weight: z.number().optional(),
  manufacturer: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  expiryDate: z.string().optional(),
  compatibility: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const productCreateSchema = productBodySchema;
export const productUpdateSchema = productBodySchema.partial();

export type ProductBody = z.infer<typeof productBodySchema>;

/** Build a Prisma-safe data object from a validated body — never a raw spread. */
export function productDataFromBody(body: Partial<ProductBody>) {
  return {
    name: body.name,
    brand: body.brand,
    category: body.category,
    categoryId: body.categoryId,
    price: body.price !== undefined ? Number(body.price) : undefined,
    oldPrice: body.oldPrice != null ? Number(body.oldPrice) : body.oldPrice === null ? null : undefined,
    stock: body.stock,
    minStock: body.minStock,
    description: body.description,
    imageUrl: body.imageUrl,
    images: body.images,
    ownBrand: body.ownBrand,
    sku: body.sku,
    unit: body.unit,
    currency: body.currency,
    tags: body.tags,
    specs: body.specs,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    videoUrl: body.videoUrl,
    model3dUrl: body.model3dUrl,
    weight: body.weight,
    manufacturer: body.manufacturer,
    country: body.country,
    expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    compatibility: body.compatibility,
    isActive: body.isActive,
  };
}
